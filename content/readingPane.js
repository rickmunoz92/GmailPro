(() => {
  "use strict";
  const app = (globalThis.GmailPro ??= {});
  if (app.readingPane) return;
  const S = app.selectors;
  const definitions = [
    ["replyAll", "Reply all", S.nativeReplyAll, "M10 6 4 12l6 6M16 6l-6 6 6 6M10 12h5c4 0 6 3 6 7"],
    ["reply", "Reply", S.nativeReply, "m10 6-6 6 6 6M4 12h9c4 0 7 3 7 7"],
    ["forward", "Forward", S.nativeForward, "m14 6 6 6-6 6M20 12h-9c-4 0-7 3-7 7"],
    ["reaction", "Add reaction", S.nativeReaction, "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM8 14c2 3 6 3 8 0M8 9h.01M16 9h.01"]
  ];
  let enabled = false, unsubscribe, observer, group, markedShell;
  let queued = false;
  let observedContext;
  const markedFooters = new Set();
  const visible = node => !!node?.isConnected && node.checkVisibility({ visibilityProperty: true }) && !node.closest('[hidden], [aria-hidden="true"], [inert]');
  const usable = node => node && !node.matches('[disabled], [aria-disabled="true"]');
  const ownsChrome = node => !node.closest(S.readingExcluded);

  function restore() {
    markedShell?.removeAttribute("data-gp-actions-ready");
    markedShell = undefined;
    for (const footer of markedFooters) footer.removeAttribute("data-gp-native-actions");
    markedFooters.clear();
  }

  // Fresh resolution is also performed at activation time. No captured native
  // button, message ID or guessed recipient count can outlive Gmail's target.
  function context() {
    const thread = app.reverseThreads.currentConversation();
    const shell = thread?.heading.closest(S.readingShell);
    if (!shell || !visible(shell)) return null;
    const main = shell.closest(S.main);
    const toolbars = [...main.querySelectorAll(S.primaryToolbar)].filter(visible);
    if (toolbars.length !== 1) return null;
    const toolbar = toolbars[0], more = toolbar.querySelector(S.toolbarMore);
    if (!visible(more)) return null;
    // The thread-level sticky footer is Gmail's source of truth, even when
    // CSS visually reverses messages. Fall back only to one unambiguous footer.
    const footers = [...shell.querySelectorAll(S.nativeFooter)].filter(footer =>
      ownsChrome(footer) && visible(footer) && footer.querySelector(S.nativeReply + ', ' + S.nativeReplyAll + ', ' + S.nativeForward));
    const sticky = footers.filter(footer => footer.closest('.btDi4d'));
    const footer = sticky.length === 1 ? sticky[0] : footers.length === 1 ? footers[0] : null;
    const actions = new Map();
    if (footer) for (const [key, , selector] of definitions) {
      const nodes = [...footer.querySelectorAll(selector)].filter(node => ownsChrome(node) && visible(node) && usable(node));
      if (nodes.length === 1) actions.set(key, nodes[0]);
    }
    const known = [...actions.values()];
    const replaceable = footer && [...footer.querySelectorAll('button, [role="button"], [role="link"]')]
      .every(node => !usable(node) || known.includes(node) || !visible(node));
    return { shell, toolbar, toolbarHost: toolbar.closest('[gh="tm"]'), more, footer, actions, replaceable };
  }

  function activate(event) {
    const button = event.target.closest('button[data-gp-message-action]');
    if (!enabled || !button || !group?.contains(button)) return;
    event.preventDefault(); event.stopPropagation();
    // Temporarily release our hiding marker for native availability checks.
    // This entire operation is synchronous; there is no intermediate paint.
    restore();
    const current = context();
    const target = current?.actions.get(button.dataset.gpMessageAction);
    if (target) target.dispatchEvent(new MouseEvent("click", {
      bubbles: true, cancelable: true, view: window,
      shiftKey: event.shiftKey, ctrlKey: event.ctrlKey, metaKey: event.metaKey, altKey: event.altKey
    }));
    refresh();
  }

  function createGroup() {
    const node = document.createElement("div");
    node.className = "gmail-pro-message-actions";
    node.setAttribute("role", "group"); node.setAttribute("aria-label", "Message actions");
    for (const [key, label, , path] of definitions) {
      const button = document.createElement("button");
      button.type = "button"; button.dataset.gpMessageAction = key;
      button.title = label; button.setAttribute("aria-label", label);
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("viewBox", "0 0 24 24"); svg.setAttribute("aria-hidden", "true");
      const shape = document.createElementNS(svg.namespaceURI, "path");
      shape.setAttribute("d", path); svg.append(shape); button.append(svg); node.append(button);
    }
    node.addEventListener("click", activate);
    return node;
  }

  function schedule() {
    if (!enabled || queued) return;
    queued = true;
    queueMicrotask(() => { queued = false; if (enabled) refresh(); });
  }

  function watch(current) {
    if (current) observedContext = current;
    // Keep the small shell/toolbar spine alive while Gmail temporarily hides
    // the thread or removes its toolbar, so restoration needs no polling.
    if (!observedContext?.shell.isConnected) return;
    const { shell, toolbar, toolbarHost } = observedContext;
    const watched = new Set();
    const watchNode = node => {
      if (!node || watched.has(node) || !ownsChrome(node)) return;
      watched.add(node);
      observer.observe(node, { childList: true, attributes: true,
        attributeFilter: ["class", "style", "hidden", "aria-hidden", "disabled", "aria-disabled"] });
    };
    // Observe chrome and its ancestor spine, never received message documents
    // or compose editors. Toolbar subtree is small and contains only controls.
    for (const node of [shell, ...shell.children, ...shell.querySelectorAll(S.readingChrome)]) {
      if (!ownsChrome(node)) continue;
      for (let parent = node; parent && parent !== shell.parentElement; parent = parent.parentElement) watchNode(parent);
      for (const control of node.matches('.amn, .gE') ? node.querySelectorAll('button, [role="link"], [role="button"]') : []) {
        if (ownsChrome(control)) for (let parent = control; parent && parent !== node; parent = parent.parentElement) watchNode(parent);
      }
    }
    for (let parent = shell.parentElement; parent; parent = parent.parentElement) {
      watchNode(parent); if (parent.matches(S.main)) break;
    }
    observer.observe(toolbar, { childList: true, subtree: true, attributes: true,
      attributeFilter: ["style", "hidden", "aria-hidden", "disabled", "aria-disabled"] });
    for (let parent = toolbarHost; parent; parent = parent.parentElement) {
      watchNode(parent); if (parent.matches(S.main)) break;
    }
  }

  function refresh() {
    if (!enabled) return;
    observer.disconnect();
    restore();
    const current = context();
    if (!current?.actions.size) { group?.remove(); watch(current); return; }
    if (!group) group = createGroup();
    for (const button of group.children) button.hidden = !current.actions.has(button.dataset.gpMessageAction);
    // Find the direct action-group sibling containing More. This naturally
    // follows native Labels / third-party hooks without knowing their classes.
    let slot = current.more;
    while (slot.parentElement !== current.toolbar && !slot.parentElement.classList.contains("G-tF")) slot = slot.parentElement;
    if (group.parentElement !== slot.parentElement || group.nextElementSibling !== slot) slot.before(group);
    const bounds = group.getBoundingClientRect(), available = current.toolbar.getBoundingClientRect();
    if (current.replaceable && visible(group) && bounds.width > 0 &&
        bounds.left >= available.left && bounds.right <= available.right && bounds.bottom <= available.bottom + 2) {
      current.footer.setAttribute("data-gp-native-actions", "");
      markedFooters.add(current.footer);
      current.shell.setAttribute("data-gp-actions-ready", "");
      markedShell = current.shell;
    }
    watch(current);
  }

  function stop() {
    enabled = false;
    unsubscribe?.(); unsubscribe = undefined;
    observer?.disconnect(); observer = undefined;
    group?.remove(); group = undefined;
    observedContext = undefined;
    restore();
  }
  function update(patch = {}) {
    if (!Object.hasOwn(patch, "appleMailModeEnabled")) return;
    if (!patch.appleMailModeEnabled) return stop();
    if (enabled) return;
    enabled = true;
    observer = new MutationObserver(schedule);
    unsubscribe = app.reverseThreads.subscribeConversation(schedule);
    refresh();
  }
  app.readingPane = Object.freeze({ start: update, update, stop });
})();
