(() => {
  "use strict";
  const app = (globalThis.GmailPro ??= {});
  if (app.reverseThreads) return;
  const S = app.selectors;
  const active = new Map();
  const mains = new Set();
  const pendingRoots = new Set();
  let bootstrap;
  let bootstrapTimer;
  const attributes = ["role", "aria-expanded", "tabindex", "jsaction", "style"];
  let enabled = false;
  let discovery;
  let discoveryTimer;

  function headerFor(list) {
    if (list.closest(S.threadMessage) || !list.closest(S.main)) return null;
    for (let parent = list.parentElement; parent; parent = parent.parentElement) {
      const headings = [...parent.querySelectorAll(S.threadHeading)]
        .filter(heading => !heading.closest(S.threadList));
      if (headings.length === 1) return headings[0];
      if (parent.matches(S.main)) break;
    }
    return null;
  }

  function ordering(list) {
    const children = [...list.children];
    const items = children.filter(node => node.matches(S.threadItem));
    if (!items.length || items.some(node => !["true", "false"].includes(node.getAttribute("aria-expanded")))) return null;
    const action = items[0].getAttribute("jsaction");
    if (!action) return null;
    const messages = [];
    for (const node of children) {
      const envelope = node.children.length === 1 && node.firstElementChild.tagName === "DIV";
      if (envelope && node.getAttribute("jsaction") === action &&
          (node.matches(S.threadItem) || node.matches(S.threadPlaceholder))) messages.push(node);
      else if (!node.matches(S.threadFixed)) return null; // Unknown children fail closed.
    }
    if (!messages.length) return null;
    // Preserve fixed controls' slots. Reverse ONLY validated message envelopes.
    const reversed = messages.slice().reverse();
    const messageSet = new Set(messages);
    let index = 0;
    return { children, messages, visual: children.map(node => messageSet.has(node) ? reversed[index++] : node) };
  }

  function rememberStyle(state, node, property, value) {
    let saved = state.styles.get(node);
    if (!saved) {
      saved = { hadAttribute: node.hasAttribute("style"), properties: new Map() };
      state.styles.set(node, saved);
    }
    let entry = saved.properties.get(property);
    if (!entry) {
      entry = { value: node.style.getPropertyValue(property), priority: node.style.getPropertyPriority(property) };
      saved.properties.set(property, entry);
    }
    entry.applied = value;
    if (node.style.getPropertyValue(property) !== value || node.style.getPropertyPriority(property) !== "important") {
      node.style.setProperty(property, value, "important");
    }
  }

  function restoreNode(state, node) {
    const saved = state.styles.get(node);
    if (!saved) return;
    for (const [property, entry] of saved.properties) {
      // Never overwrite a later Gmail/other-extension change to the same property.
      if (node.style.getPropertyValue(property) !== entry.applied || node.style.getPropertyPriority(property) !== "important") continue;
      if (entry.value) node.style.setProperty(property, entry.value, entry.priority);
      else node.style.removeProperty(property);
    }
    if (!saved.hadAttribute && node.getAttribute("style") === "") node.removeAttribute("style");
    state.styles.delete(node);
  }

  function restore(state) {
    const changed = state.styles.size > 0;
    for (const node of state.styles.keys()) restoreNode(state, node);
    state.originalOrder = [];
    state.visualOrder = [];
    if (changed) app.debug.log("thread-original-restored");
  }

  function conflicted(state) {
    for (const [node, saved] of state.styles) {
      if (node !== state.list && node.parentElement !== state.list) continue;
      for (const [property, entry] of saved.properties) {
        if (node.style.getPropertyValue(property) !== entry.applied || node.style.getPropertyPriority(property) !== "important") return true;
      }
    }
    return false;
  }

  function observeThread(state) {
    state.observer.observe(state.list, { childList: true, attributes: true, attributeFilter: attributes });
    for (const node of state.list.children) {
      state.observer.observe(node, { attributes: true, attributeFilter: attributes });
    }
    // No observation inside message bodies, attachments, or compose editors.
  }

  function release(state) {
    clearTimeout(state.timer);
    state.observer.disconnect();
    restore(state);
    active.delete(state.list);
  }

  function apply(state) {
    state.timer = null;
    if (!enabled || !state.list.isConnected) return release(state);
    state.observer.disconnect(); // Our style writes never feed this observer.
    try {
      if (conflicted(state)) {
        state.blocked = true; // Do not compete with another style owner this session.
        app.debug.log("thread-selector-failure");
      }
      const plan = state.list.matches(S.threadList) && headerFor(state.list) && ordering(state.list);
      if (!plan || state.blocked) {
        restore(state);
        if (!state.invalid) app.debug.log("thread-selector-failure");
        state.invalid = true;
        return;
      }
      state.invalid = false;
      for (const node of state.styles.keys()) {
        if (node !== state.list && node.parentElement !== state.list) restoreNode(state, node);
      }
      if (plan.messages.length < 2) return restore(state);
      if (plan.children.length === state.originalOrder.length &&
          plan.children.every((node, i) => node === state.originalOrder[i]) &&
          plan.visual.every((node, i) => node === state.visualOrder[i])) return;
      if (!state.styles.size) {
        // Batch style reads before writes. Avoid taking over an existing layout
        // reversal from another extension or a redesigned Gmail message list.
        const layout = getComputedStyle(state.list);
        if (!["block", "flow-root"].includes(layout.display) || plan.children.some(node => getComputedStyle(node).order !== "0")) {
          state.blocked = true;
          app.debug.log("thread-selector-failure");
          return;
        }
      }
      state.originalOrder = plan.children; // Gmail's DOM is always left in this order.
      state.visualOrder = plan.visual;
      rememberStyle(state, state.list, "display", "flex");
      rememberStyle(state, state.list, "flex-direction", "column");
      plan.visual.forEach((node, index) => {
        rememberStyle(state, node, "order", String(index));
        rememberStyle(state, node, "flex-shrink", "0");
      });
      app.debug.log("thread-reordered");
    } catch {
      restore(state);
      state.blocked = true;
      app.debug.log("thread-selector-failure");
    } finally {
      if (enabled && active.has(state.list)) observeThread(state);
    }
  }

  function schedule(state) {
    if (!state.timer) state.timer = setTimeout(() => apply(state), 80);
  }

  function register(list) {
    if (active.has(list) || !headerFor(list)) return;
    const state = { list, styles: new Map(), originalOrder: [], visualOrder: [], timer: null, blocked: false, invalid: false };
    state.observer = new MutationObserver(() => schedule(state));
    active.set(list, state);
    observeThread(state);
    app.debug.log("thread-detected");
    schedule(state);
    bootstrap?.disconnect();
    clearTimeout(bootstrapTimer);
  }

  function scan(root) {
    if (!(root instanceof Element) || !root.isConnected || root.closest(S.threadMessage)) return;
    const enclosing = root.closest(S.threadList);
    if (enclosing && active.has(enclosing)) return;
    if (root.matches(S.threadList)) register(root);
    for (const list of root.querySelectorAll(S.threadList)) register(list);
  }

  function watchSpines() {
    discovery.disconnect();
    const watched = new Set();
    const watch = start => {
      for (let node = start; node; node = node.parentElement) {
        if (watched.has(node)) break;
        watched.add(node);
        discovery.observe(node, { childList: true });
      }
    };
    for (const main of mains) {
      if (main.isConnected) watch(main); else mains.delete(main);
    }
    for (const state of active.values()) watch(state.list.parentElement);
    if (!watched.size) watch(document.body || document.documentElement);
  }

  function discover() {
    discoveryTimer = null;
    if (!enabled) return;
    for (const state of active.values()) if (!state.list.isConnected) release(state);
    for (const root of pendingRoots) scan(root);
    pendingRoots.clear();
    watchSpines();
  }

  function queue(mutations) {
    for (const mutation of mutations) {
      if (mutation.target instanceof Element && mutation.target.closest(S.threadList) &&
          active.has(mutation.target.closest(S.threadList))) continue;
      for (const node of mutation.addedNodes) if (node instanceof Element) pendingRoots.add(node);
    }
    if (!discoveryTimer) discoveryTimer = setTimeout(discover, 80);
  }

  function navigation() {
    if (!enabled) return;
    bootstrap?.disconnect();
    clearTimeout(bootstrapTimer);
    for (const main of document.querySelectorAll(S.main)) {
      // A newly opening pane can build deep descendants before a list exists.
      // Bootstrap briefly, then replace this with shallow ancestor/list watches.
      bootstrap.observe(main, { childList: true, subtree: true });
      mains.add(main);
      pendingRoots.add(main);
    }
    bootstrapTimer = setTimeout(() => bootstrap.disconnect(), 5000);
    clearTimeout(discoveryTimer);
    discoveryTimer = setTimeout(discover, 80);
  }

  function focus(event) {
    const main = event.target instanceof Element && event.target.closest(S.main);
    if (main && !mains.has(main)) navigation(); // Late-built Gmail shell.
  }

  function openRow(event) {
    if (event.target instanceof Element && event.target.closest(S.threadRow)?.closest(S.main)) navigation();
  }

  function stop() {
    enabled = false;
    clearTimeout(discoveryTimer);
    discoveryTimer = null;
    discovery?.disconnect();
    bootstrap?.disconnect();
    clearTimeout(bootstrapTimer);
    window.removeEventListener("hashchange", navigation);
    window.removeEventListener("popstate", navigation);
    document.removeEventListener("focusin", focus, true);
    document.removeEventListener("click", openRow, true);
    for (const state of active.values()) release(state);
    mains.clear();
    pendingRoots.clear();
  }

  function update(patch = {}) {
    if (!Object.hasOwn(patch, "newestEmailFirstEnabled") || !!patch.newestEmailFirstEnabled === enabled) return;
    if (!patch.newestEmailFirstEnabled) return stop();
    enabled = true;
    discovery = new MutationObserver(queue);
    bootstrap = new MutationObserver(queue);
    window.addEventListener("hashchange", navigation);
    window.addEventListener("popstate", navigation);
    document.addEventListener("focusin", focus, true);
    document.addEventListener("click", openRow, true);
    navigation();
    watchSpines();
  }

  app.reverseThreads = Object.freeze({ implemented: true, start: update, update, stop });
})();
