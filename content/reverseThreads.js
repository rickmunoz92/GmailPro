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
  const attributes = ["role", "aria-expanded", "tabindex", "jsaction", "style", "data-gmail-pro-thread-order"];
  let enabled = false;
  let reverseEnabled = false;
  const conversationListeners = new Set();
  let discovery;
  const marker = "data-gmail-pro-thread-order";

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

  // One SPA discovery owner for ordering and temporary message zoom. Consumers
  // receive only the currently visible thread identity; never body/header text.
  function notifyConversation() {
    if (!conversationListeners.size) return;
    const headings = new Set();
    for (const state of active.values()) {
      const heading = headerFor(state.list);
      if (heading && state.list.isConnected && heading.checkVisibility({ visibilityProperty: true }) &&
          !heading.closest('[aria-hidden="true"], [inert]')) headings.add(heading);
    }
    const heading = headings.size === 1 ? [...headings][0] : null;
    const identity = heading?.getAttribute("data-thread-perm-id") || null;
    for (const listener of conversationListeners) listener(identity);
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
    const changed = state.mode !== null;
    if (state.mode && state.list.getAttribute(marker) === state.mode) {
      if (state.originalMarker === null) state.list.removeAttribute(marker);
      else state.list.setAttribute(marker, state.originalMarker);
    }
    state.mode = null;
    state.nativeStyles.clear();
    for (const node of state.styles.keys()) restoreNode(state, node);
    state.originalOrder = [];
    state.visualOrder = [];
    if (changed) app.debug.log("thread-original-restored");
  }

  function inlineSignature(node, properties) {
    return properties.map(property => `${node.style.getPropertyValue(property)}!${node.style.getPropertyPriority(property)}`).join(";");
  }

  function conflicted(state) {
    if (state.mode && state.list.getAttribute(marker) !== state.mode) return true;
    for (const [node, saved] of state.nativeStyles) {
      if (node !== state.list && node.parentElement !== state.list) continue;
      if (inlineSignature(node, saved.properties) !== saved.signature) return true;
    }
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
      state.observer.observe(node, { childList: true, attributes: true, attributeFilter: attributes });
    }
    const heading = headerFor(state.list);
    if (heading) state.observer.observe(heading, { attributes: true,
      attributeFilter: ["data-thread-perm-id", "data-legacy-thread-id", "hidden", "style", "aria-hidden"] });
    // No observation inside message bodies, attachments, or compose editors.
  }

  function release(state) {
    state.observer.disconnect();
    restore(state);
    active.delete(state.list);
  }

  function apply(state) {
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
      if (!reverseEnabled) return restore(state);
      if (plan.messages.length < 2) return restore(state);
      if (plan.children.length === state.originalOrder.length &&
          plan.children.every((node, i) => node === state.originalOrder[i]) &&
          plan.visual.every((node, i) => node === state.visualOrder[i])) return;
      if (!state.mode) {
        // Batch style reads before writes. Avoid taking over an existing layout
        // reversal from another extension or a redesigned Gmail message list.
        const layout = getComputedStyle(state.list);
        if (!["block", "flow-root"].includes(layout.display)) {
          state.blocked = true;
          app.debug.log("thread-selector-failure");
          return;
        }
      }
      const mode = plan.messages.length === plan.children.length ? "reverse" : "slots";
      const changed = state.mode !== mode || mode === "slots";
      // A new child could belong to another layout owner. Check before writing.
      for (const node of plan.children) {
        if (!state.nativeStyles.has(node) && !state.styles.has(node) && getComputedStyle(node).order !== "0") {
          restore(state); state.blocked = true;
          app.debug.log("thread-selector-failure");
          return;
        }
      }
      // Release per-child fallback styles before changing modes or recording baselines.
      if (state.mode !== mode) for (const node of state.styles.keys()) restoreNode(state, node);
      for (const node of state.nativeStyles.keys()) {
        if (node !== state.list && node.parentElement !== state.list) state.nativeStyles.delete(node);
      }
      const rememberNative = (node, properties) => {
        if (!state.nativeStyles.has(node)) state.nativeStyles.set(node, { properties, signature: inlineSignature(node, properties) });
      };
      rememberNative(state.list, ["display", "flex-direction"]);
      if (mode === "reverse") {
        for (const node of plan.children) rememberNative(node, ["order"]);
      } else {
        // Mixed lists retain fixed controls' native visual slots.
        for (const node of plan.children) state.nativeStyles.delete(node);
        plan.visual.forEach((node, index) => rememberStyle(state, node, "order", String(index)));
      }
      state.originalOrder = plan.children; // Gmail's DOM is always left in this order.
      state.visualOrder = plan.visual;
      state.mode = mode;
      if (state.list.getAttribute(marker) !== mode) state.list.setAttribute(marker, mode);
      if (changed) app.debug.log("thread-reordered");
    } catch {
      restore(state);
      state.blocked = true;
      app.debug.log("thread-selector-failure");
    } finally {
      if (enabled && active.has(state.list)) observeThread(state);
      notifyConversation();
    }
  }

  function register(list) {
    if (active.has(list) || !headerFor(list)) return;
    const state = { list, styles: new Map(), nativeStyles: new Map(), originalMarker: list.getAttribute(marker), mode: null, originalOrder: [], visualOrder: [], blocked: false, invalid: false };
    state.observer = new MutationObserver(() => apply(state));
    active.set(list, state);
    observeThread(state);
    app.debug.log("thread-detected");
    apply(state);
    bootstrap?.disconnect();
    clearTimeout(bootstrapTimer);
  }

  function scan(root) {
    if (!(root instanceof Element) || !root.isConnected || root.closest(S.threadMessage)) return;
    const foundMains = root.matches(S.main) ? [root] : [...root.querySelectorAll(S.main)];
    for (const main of foundMains) {
      if (!mains.has(main)) {
        mains.add(main);
        bootstrap.observe(main, { childList: true, subtree: true });
        clearTimeout(bootstrapTimer);
        bootstrapTimer = setTimeout(() => bootstrap.disconnect(), 5000);
      }
    }
    const enclosing = root.closest(S.threadList);
    if (enclosing && active.has(enclosing)) return;
    // A heading can arrive after an empty list. Revisit only its local main.
    if (root.matches(S.threadHeading) || root.querySelector(S.threadHeading)) {
      const main = root.closest(S.main);
      if (main) for (const list of main.querySelectorAll(S.threadList)) register(list);
    }
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
    if (!enabled) return;
    for (const state of active.values()) if (!state.list.isConnected) release(state);
    for (const root of pendingRoots) {
      let parent = root.parentElement;
      while (parent && !pendingRoots.has(parent)) parent = parent.parentElement;
      if (!parent) scan(root); // One scan per added subtree, not each descendant.
    }
    pendingRoots.clear();
    watchSpines();
    notifyConversation();
  }

  function queue(mutations) {
    let relevant = false;
    for (const mutation of mutations) {
      if (mutation.target instanceof Element && mutation.target.closest(S.threadList) &&
          active.has(mutation.target.closest(S.threadList))) continue;
      relevant = true;
      for (const node of mutation.addedNodes) if (node instanceof Element) pendingRoots.add(node);
    }
    if (!relevant) return;
    // MutationObserver delivery is a microtask: finish validation/style changes
    // here, before rendering. No timers or animation frames defer the first paint.
    discover();
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
    discover();
  }

  function focus(event) {
    const main = event.target instanceof Element && event.target.closest(S.main);
    if (main && !mains.has(main)) navigation(); // Late-built Gmail shell.
  }

  function openRow(event) {
    if (event.target instanceof Element && event.target.closest(S.threadRow)?.closest(S.main)) navigation();
  }

  function stopDiscovery() {
    if (!enabled) return;
    enabled = false;
    discovery?.disconnect();
    bootstrap?.disconnect();
    clearTimeout(bootstrapTimer);
    window.removeEventListener("hashchange", navigation);
    window.removeEventListener("popstate", navigation);
    document.removeEventListener("focusin", focus, true);
    document.removeEventListener("click", openRow, true);
    document.removeEventListener("DOMContentLoaded", navigation);
    for (const state of active.values()) release(state);
    mains.clear();
    pendingRoots.clear();
  }

  function startDiscovery() {
    if (enabled) return;
    enabled = true;
    discovery = new MutationObserver(queue);
    bootstrap = new MutationObserver(queue);
    window.addEventListener("hashchange", navigation);
    window.addEventListener("popstate", navigation);
    document.addEventListener("focusin", focus, true);
    document.addEventListener("click", openRow, true);
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", navigation, { once: true });
    navigation();
    watchSpines();
  }

  function update(patch = {}) {
    if (!Object.hasOwn(patch, "newestEmailFirstEnabled")) return;
    reverseEnabled = !!patch.newestEmailFirstEnabled;
    if (reverseEnabled || conversationListeners.size) {
      startDiscovery();
      for (const state of active.values()) apply(state);
    } else stopDiscovery();
  }

  function stop() { update({ newestEmailFirstEnabled: false }); }

  function subscribeConversation(listener) {
    conversationListeners.add(listener);
    startDiscovery();
    notifyConversation();
    return () => {
      conversationListeners.delete(listener);
      if (!reverseEnabled && !conversationListeners.size) stopDiscovery();
    };
  }

  app.reverseThreads = Object.freeze({ implemented: true, start: update, update, stop, subscribeConversation });
})();
