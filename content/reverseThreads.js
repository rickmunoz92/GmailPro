(() => {
  "use strict";
  const app = (globalThis.GmailPro ??= {});
  if (app.reverseThreads) return;
  const S = app.selectors;
  const active = new Map();
  const mains = new Set();
  const pendingRoots = new Set();
  const discoveryOptions = { childList: true, attributes: true,
    attributeFilter: ["role", "data-thread-perm-id", "data-legacy-thread-id"] };
  const attributes = ["role", "aria-expanded", "tabindex", "jsaction", "style", "class", "hidden", "data-gmail-pro-thread-order"];
  const discoveryExcluded = `${S.threadMessage}, ${S.threadRow}, form, [contenteditable], .ii, .a3s`;
  let enabled = false;
  let reverseEnabled = false;
  const conversationListeners = new Set();
  let discovery;
  const marker = "data-gmail-pro-thread-order";

  function headerFor(list) {
    if (list.closest(`${S.threadMessage}, [role="tooltip"]`) || !list.closest(S.main)) return null;
    for (let parent = list.parentElement; parent; parent = parent.parentElement) {
      // Gmail's native importance tooltip also uses h2. Tooltip headings and
      // lists describe chrome; they cannot identify a conversation pane.
      const headings = [...parent.querySelectorAll("h2")]
        .filter(heading => !heading.closest(`${S.threadList}, [role="tooltip"]`));
      // A nearby heading awaiting its IDs belongs to this pane. Do not borrow
      // the identity of another, cached conversation higher in the main shell.
      if (headings.length) {
        if (headings.length !== 1 || !headings[0].matches(S.threadHeading)) return null;
        const lists = [...parent.querySelectorAll(S.threadList)]
          .filter(node => !node.parentElement.closest(S.threadList) && !node.closest(`${S.threadMessage}, [role="tooltip"]`));
        return lists.length === 1 && lists[0] === list ? headings[0] : null;
      }
      if (parent.matches(S.main)) break;
    }
    return null;
  }

  // Shared SPA discovery: consumers receive only a visible thread identity and
  // its validated DOM context, never copied message content or recipient data.
  function currentConversation() {
    const contexts = new Map();
    for (const state of active.values()) {
      const heading = headerFor(state.list);
      if (heading && state.list.isConnected && heading.checkVisibility({ visibilityProperty: true }) &&
          !heading.closest('[aria-hidden="true"], [inert]')) contexts.set(heading, { heading, list: state.list });
    }
    return contexts.size === 1 ? [...contexts.values()][0] : null;
  }

  function notifyConversation() {
    if (!conversationListeners.size) return;
    const context = currentConversation();
    const identity = context?.heading.getAttribute("data-thread-perm-id") || null;
    for (const listener of conversationListeners) listener(identity, context);
  }

  function ordering(list) {
    const children = [...list.children];
    const items = children.filter(node => node.matches(S.threadItem));
    // Revealed older summaries have a listitem role but no aria-expanded.
    // Keep a fully identified neighboring message as the action anchor, and
    // reject invalid explicit states rather than treating them as summaries.
    const identified = items.filter(node => ["true", "false"].includes(node.getAttribute("aria-expanded")));
    if (!identified.length || items.some(node => node.hasAttribute("aria-expanded") &&
        !["true", "false"].includes(node.getAttribute("aria-expanded")))) return null;
    const action = identified[0].getAttribute("jsaction");
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
      state.list.removeAttribute(marker);
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
      // Gmail can clear our marker or hide/rebuild a cached list after replying.
      // Release stale baselines, then validate the current native layout again.
      // A live competing layout still fails the checks below; a temporary one
      // must not disable this conversation for the rest of the page session.
      if (conflicted(state)) restore(state);
      const plan = state.list.matches(S.threadList) && headerFor(state.list) && ordering(state.list);
      if (!plan) {
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
      if (state.list.hidden) return restore(state);
      if (plan.children.length === state.originalOrder.length &&
          plan.children.every((node, i) => node === state.originalOrder[i]) &&
          plan.visual.every((node, i) => node === state.visualOrder[i])) return;
      if (!state.mode) {
        // Batch style reads before writes. Avoid taking over an existing layout
        // reversal from another extension or a redesigned Gmail message list.
        const layout = getComputedStyle(state.list);
        if (!["block", "flow-root"].includes(layout.display) || state.list.hasAttribute(marker)) {
          app.debug.log("thread-selector-failure");
          return;
        }
      }
      const mode = plan.messages.length === plan.children.length ? "reverse" : "slots";
      const changed = state.mode !== mode || mode === "slots";
      // A new child could belong to another layout owner. Check before writing.
      for (const node of plan.children) {
        if (!state.nativeStyles.has(node) && !state.styles.has(node) && getComputedStyle(node).order !== "0") {
          restore(state);
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
      app.debug.log("thread-selector-failure");
    } finally {
      if (enabled && active.has(state.list)) observeThread(state);
      notifyConversation();
    }
  }

  function register(list) {
    const existing = active.get(list);
    if (existing) {
      if (existing.invalid) apply(existing);
      return;
    }
    if (!headerFor(list)) return;
    const state = { list, styles: new Map(), nativeStyles: new Map(), mode: null, originalOrder: [], visualOrder: [], invalid: false };
    state.observer = new MutationObserver(() => apply(state));
    active.set(list, state);
    observeThread(state);
    app.debug.log("thread-detected");
    apply(state);
  }

  function scan(root) {
    if (!(root instanceof Element) || !root.isConnected || root.closest(discoveryExcluded)) return;
    const foundMains = root.matches(S.main) ? [root] : [...root.querySelectorAll(S.main)];
    for (const main of foundMains) mains.add(main);
    const enclosing = root.closest(S.threadList);
    if (enclosing && active.has(enclosing)) return;
    // Heading metadata and auxiliary tooltip roles can finish after the list.
    // Revisit only this main; headerFor remains the conversation identity gate.
    if (root.matches("h2") || root.querySelector("h2")) {
      const main = root.closest(S.main);
      if (main) for (const list of main.querySelectorAll(S.threadList)) register(list);
    }
    if (root.matches(S.threadList)) register(root);
    for (const list of root.querySelectorAll(S.threadList)) register(list);
  }

  function watchScaffold() {
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
      if (!main.isConnected) { mains.delete(main); continue; }
      watch(main);
      // Watch the conversation scaffold, including empty pane containers and
      // headings whose IDs arrive later. Stop at message lists owned by their
      // thread observer, message bodies, mailbox rows and compose editors.
      // Keeping these shallow watches alive lets a new pane finish loading
      // even when Gmail retains a valid cached conversation beside it.
      const pending = [main];
      while (pending.length) {
        const node = pending.pop();
        if (active.has(node) || node.matches(discoveryExcluded)) continue;
        discovery.observe(node, discoveryOptions);
        watched.add(node);
        pending.push(...node.children);
      }
    }
    for (const state of active.values()) watch(state.list.parentElement);
    if (!watched.size) watch(document.body || document.documentElement);
  }

  function discover() {
    if (!enabled) return;
    for (const state of active.values()) if (!state.list.isConnected) release(state);
    // Revalidate a reused list when its heading is temporarily replaced.
    for (const state of active.values()) if (!headerFor(state.list)) apply(state);
    for (const root of pendingRoots) {
      let parent = root.parentElement;
      while (parent && !pendingRoots.has(parent)) parent = parent.parentElement;
      if (!parent) scan(root); // One scan per added subtree, not each descendant.
    }
    pendingRoots.clear();
    watchScaffold();
    notifyConversation();
  }

  function queue(mutations) {
    let relevant = false;
    for (const mutation of mutations) {
      if (mutation.target instanceof Element && mutation.target.closest(S.threadList) &&
          active.has(mutation.target.closest(S.threadList))) continue;
      relevant = true;
      if (mutation.type === "attributes") pendingRoots.add(mutation.target);
      for (const node of mutation.addedNodes) if (node instanceof Element) pendingRoots.add(node);
    }
    if (!relevant) return;
    // MutationObserver delivery is a microtask: finish validation/style changes
    // here, before rendering. No timers or animation frames defer the first paint.
    discover();
  }

  function navigation() {
    if (!enabled) return;
    for (const main of document.querySelectorAll(S.main)) {
      mains.add(main);
      pendingRoots.add(main);
    }
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
    window.addEventListener("hashchange", navigation);
    window.addEventListener("popstate", navigation);
    document.addEventListener("focusin", focus, true);
    document.addEventListener("click", openRow, true);
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", navigation, { once: true });
    navigation();
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

  app.reverseThreads = Object.freeze({ implemented: true, start: update, update, stop, subscribeConversation, currentConversation });
})();
