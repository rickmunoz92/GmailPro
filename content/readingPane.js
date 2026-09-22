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
  let pendingRead;
  let readNoticeObserver, readNoticeTimer;
  const readDelay = 300;
  const readExcluded = 'a, button, input, textarea, select, [contenteditable], [role="button"], [role="checkbox"], [role="menu"], [role="dialog"], .at';
  const markedFooters = new Set();
  const recipientLabels = new Map();
  const visible = node => !!node?.isConnected && node.checkVisibility({ visibilityProperty: true }) && !node.closest('[hidden], [aria-hidden="true"], [inert]');
  const usable = node => node && !node.matches('[disabled], [aria-disabled="true"]');
  const ownsChrome = node => !node.closest(S.readingExcluded);

  function nativeGesture(target) {
    const bounds = target.getBoundingClientRect();
    // Gmail controls need pressed state; a bare .click() can be ignored.
    for (const type of ["mousedown", "mouseup", "click"]) {
      if (!visible(target) || !usable(target)) break;
      target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true,
        view: window, button: 0, buttons: type === "mousedown" ? 1 : 0, detail: 1,
        clientX: bounds.left + bounds.width / 2, clientY: bounds.top + bounds.height / 2 }));
    }
  }

  function stopReadNoticeWatch() {
    readNoticeObserver?.disconnect(); readNoticeObserver = undefined;
    clearTimeout(readNoticeTimer); readNoticeTimer = undefined;
  }

  function quietReadNotice() {
    stopReadNoticeWatch();
    // Observe only Gmail's small native notification region while awaiting
    // this action's confirmation. Never hide the shared alert/Undo container.
    const roots = [...document.querySelectorAll(S.nativeNotice)].filter(ownsChrome);
    if (!roots.length) return;
    readNoticeObserver = new MutationObserver(() => {
      for (const root of roots) {
        for (const message of root.querySelectorAll(S.nativeNoticeMessage)) {
          if (message.textContent.trim() !== "Conversation marked as read.") continue;
          const close = message.closest('.vh').querySelector(':scope > .bBe[role="button"][aria-label="Close"]');
          if (!visible(close) || !usable(close)) continue;
          // Disconnect before Gmail dismisses/reuses the node. Archive,
          // delete, errors, and third-party notices retain their native UI.
          stopReadNoticeWatch();
          nativeGesture(close);
          return;
        }
      }
    });
    for (const root of roots) readNoticeObserver.observe(root, {
      childList: true, subtree: true, characterData: true, attributes: true,
      attributeFilter: ["class", "style", "role", "aria-label", "hidden", "aria-hidden", "aria-disabled"]
    });
    readNoticeTimer = setTimeout(stopReadNoticeWatch, 5000);
  }

  function cancelRead() {
    if (!pendingRead) return;
    clearTimeout(pendingRead.timer);
    clearTimeout(pendingRead.expiry);
    pendingRead = undefined;
    schedule(); // Release temporary row/table observation even without a DOM change.
  }

  function readIdentity(row) {
    return row.querySelector('[role="link"] [data-thread-id][data-legacy-thread-id]');
  }

  function readContext(pending) {
    const { row, main, thread, legacy, route } = pending;
    const identity = readIdentity(row);
    if (!enabled || document.hidden || location.hash !== route || !visible(row) ||
        !row.matches(S.readingRow) || row.closest(S.main) !== main ||
        !row.classList.contains("zE") || identity?.getAttribute("data-thread-id") !== thread ||
        identity.getAttribute("data-legacy-thread-id") !== legacy ||
        main.querySelector('table[role="grid"] [role="checkbox"]:is([aria-checked="true"], [aria-checked="mixed"])')) return null;
    const current = app.reverseThreads.currentConversation();
    if (!row.classList.contains("aps") || !current || !visible(current.list) ||
        ![...current.list.querySelectorAll(S.readingBody)].some(visible) ||
        current.heading.closest(S.main) !== main ||
        current.heading.getAttribute("data-thread-perm-id") !== thread.replace(/^#/, "") ||
        current.heading.getAttribute("data-legacy-thread-id") !== legacy) return null;
    return current;
  }

  function markRead(pending) {
    if (pendingRead !== pending) return;
    if (!readContext(pending)) return cancelRead();
    const remaining = readDelay - (performance.now() - pending.started);
    if (remaining > 0) {
      pending.timer = setTimeout(() => markRead(pending), remaining);
      return;
    }
    const toolbars = [...pending.main.querySelectorAll(S.primaryToolbar)].filter(visible);
    const actions = toolbars.length === 1
      ? [...toolbars[0].querySelectorAll(S.markRead)].filter(node => visible(node) && usable(node)) : [];
    // Consume the click before delegating. A later explicit Mark as unread
    // must never restart this timer, and no bulk toolbar action is allowed.
    cancelRead();
    if (actions.length !== 1) return;
    quietReadNotice();
    nativeGesture(actions[0]);
  }

  function refreshRead() {
    const pending = pendingRead;
    if (!pending) return;
    if (!pending.row.matches(S.readingRow) || pending.row.closest(S.main) !== pending.main) return cancelRead();
    // These watches exist only during a click's dwell, never across the inbox
    // while idle. Selection attributes stay owned by Gmail.
    if (pending.row.isConnected) {
      observer.observe(pending.row, { attributes: true, attributeFilter: ["class", "hidden", "style"] });
      observer.observe(pending.row.parentElement, { childList: true });
      observer.observe(pending.row.closest('table'), { attributes: true, subtree: true, attributeFilter: ["aria-checked"] });
      const identity = readIdentity(pending.row);
      if (identity) observer.observe(identity, { attributes: true, attributeFilter: ["data-thread-id", "data-legacy-thread-id"] });
    }
    const current = readContext(pending);
    if (!current) {
      if (pending.started !== undefined || !pending.row.isConnected || location.hash !== pending.route) cancelRead();
      return;
    }
    if (pending.started === undefined) {
      clearTimeout(pending.expiry);
      pending.started = performance.now();
      pending.timer = setTimeout(() => markRead(pending), readDelay);
    }
  }

  function openForRead(event) {
    if (!(event.target instanceof Element)) return;
    const row = event.target.closest(S.readingRow);
    if (!row || event.target.closest(readExcluded) || event.button !== 0 ||
        event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return;
    if (pendingRead?.row === row && readContext(pendingRead)) return;
    cancelRead();
    if (!row.classList.contains("zE") || document.hidden) return;
    const identity = readIdentity(row);
    const pending = { row, main: row.closest(S.main), route: location.hash,
      thread: identity.getAttribute("data-thread-id"), legacy: identity.getAttribute("data-legacy-thread-id") };
    if (!pending.thread || !pending.legacy) return;
    pendingRead = pending;
    // Bound a click whose message never opens; normal discovery supplies the
    // loaded conversation. Loading time never counts as reading time.
    pending.expiry = setTimeout(cancelRead, 10000);
    schedule();
  }

  function interruptRead(event) {
    if (!pendingRead || !(event.target instanceof Element)) return;
    const shell = readContext(pendingRead)?.heading.closest(S.readingShell);
    if (event.target.closest(readExcluded) ||
        (!shell?.contains(event.target) && !pendingRead.row.contains(event.target))) cancelRead();
  }

  function updateRecipientLabels(shell) {
    for (const [node, change] of recipientLabels) {
      if (!shell?.contains(node) || node.data !== change.after) {
        if (node.data === change.after) node.data = change.before;
        recipientLabels.delete(node);
      }
    }
    for (const summary of shell?.querySelectorAll(S.readingRecipients) || []) {
      if (!ownsChrome(summary)) continue;
      // Only Gmail's direct English label fragments, never recipient nodes or
      // received HTML. Preserve native nodes, contact handlers and punctuation.
      for (const node of summary.childNodes) {
        if (node.nodeType !== Node.TEXT_NODE || recipientLabels.has(node)) continue;
        const match = /^(\s*(?:,\s*)?)(to|cc|bcc):?(\s*)$/i.exec(node.data);
        if (!match) continue;
        const after = match[1] + ({ to: "To:", cc: "CC:", bcc: "BCC:" })[match[2].toLowerCase()] + match[3];
        if (node.data === after) continue;
        recipientLabels.set(node, { before: node.data, after });
        node.data = after;
      }
    }
  }

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
    // Gmail omits Reply all for single-recipient messages. Keep our toolbar
    // stable and delegate to its ordinary Reply without constructing recipients.
    if (!actions.has('replyAll') && actions.has('reply')) actions.set('replyAll', actions.get('reply'));
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
    if (current) observedContext = { shell: current.shell, toolbar: current.toolbar, toolbarHost: current.toolbarHost };
    // Keep the small shell/toolbar spine alive while Gmail temporarily hides
    // the thread or removes its toolbar, so restoration needs no polling.
    if (!observedContext?.shell.isConnected) return;
    const { shell, toolbar, toolbarHost } = observedContext;
    for (const summary of shell.querySelectorAll(S.readingRecipients)) {
      if (ownsChrome(summary)) observer.observe(summary, { childList: true, subtree: true, characterData: true });
    }
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
    refreshRead();
    const current = context();
    updateRecipientLabels(current?.shell || app.reverseThreads.currentConversation()?.heading.closest(S.readingShell));
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
    cancelRead();
    stopReadNoticeWatch();
    document.removeEventListener("click", openForRead, true);
    document.removeEventListener("pointerdown", interruptRead, true);
    document.removeEventListener("keydown", cancelRead, true);
    document.removeEventListener("visibilitychange", cancelRead);
    for (const type of ["hashchange", "popstate", "blur"]) window.removeEventListener(type, cancelRead);
    unsubscribe?.(); unsubscribe = undefined;
    observer?.disconnect(); observer = undefined;
    updateRecipientLabels(null);
    window.removeEventListener("resize", schedule);
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
    document.addEventListener("click", openForRead, true);
    document.addEventListener("pointerdown", interruptRead, true);
    document.addEventListener("keydown", cancelRead, true);
    document.addEventListener("visibilitychange", cancelRead);
    for (const type of ["hashchange", "popstate", "blur"]) window.addEventListener(type, cancelRead);
    window.addEventListener("resize", schedule);
    unsubscribe = app.reverseThreads.subscribeConversation(schedule);
    refresh();
  }
  app.readingPane = Object.freeze({ start: update, update, stop });
})();
