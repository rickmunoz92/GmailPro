(() => {
  "use strict";
  const app = (globalThis.GmailPro ??= {});
  if (app.keyboardShortcuts) return;
  const S = app.selectors;
  const bindings = {
    "shift+a": ["archiveShortcutEnabled", "archive"],
    backspace: ["deleteShortcutEnabled", "delete"],
    delete: ["deleteShortcutEnabled", "delete"],
    "shift+u": ["readShortcutEnabled", "toggleRead"],
    "shift+o": ["expandShortcutEnabled", "toggleExpand"],
    "shift+d": ["sendShortcutEnabled", "send"],
    z: ["undoShortcutEnabled", "undo"],
    "shift+r": ["replyAllShortcutEnabled", "replyAll"],
    "shift+f": ["forwardShortcutEnabled", "forward"]
  };
  const preferences = [...new Set(Object.values(bindings).map(([preference]) => preference))];
  const conversationPreferences = ["expandShortcutEnabled", "replyAllShortcutEnabled", "forwardShortcutEnabled"];
  const mailboxActionNames = {
    archive: ["Archive"],
    delete: ["Delete"],
    toggleRead: ["Mark as read", "Mark as unread", "Mark unread"]
  };
  const options = { ...app.settings.defaults };
  const held = new Set();
  const events = ["keydown", "keypress", "keyup"];
  const listenerOptions = { capture: true, passive: false };
  const isMac = /mac/i.test(navigator.userAgentData?.platform || navigator.platform);
  let running = false;
  let unsubscribeConversation;

  const visible = node => !!node?.isConnected && node.checkVisibility({ visibilityProperty: true, opacityProperty: true }) &&
    !node.closest('[hidden], [aria-hidden="true"], [inert]');
  const usable = node => visible(node) && !node.matches('[disabled], [aria-disabled="true"]');
  const name = node => (node.getAttribute("aria-label") || node.getAttribute("data-tooltip") || node.textContent || "")
    .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, "").trim();
  const one = nodes => nodes.length === 1 ? nodes[0] : null;
  const buttons = root => [...root.querySelectorAll(S.nativeActionButton)]
    .filter(button => usable(button) && !button.closest(S.composeExcluded));
  function overlayOpen() {
    return [...document.querySelectorAll('[role="menu"], [role="alertdialog"], [role="dialog"]')]
      .some(node => visible(node) && !node.querySelector(S.composeForm));
  }

  function mailboxBlocked(event) {
    return [document.activeElement, event.composedPath()[0]].some(node =>
      node instanceof Element && node.closest(S.shortcutArchiveExcluded)) || overlayOpen();
  }

  function mailboxToolbar(focus) {
    if (!(focus instanceof Element)) return null;
    const main = one([...document.querySelectorAll(S.main)].filter(node => visible(node) && !node.closest(S.readingExcluded)));
    if (!main) return null;
    if (!main.contains(focus) && !focus.contains(main)) {
      // Gmail may leave focus on a page-level proxy after leaving a composer.
      if (!focus.matches('div[tabindex]:not([role]):empty') ||
          focus.closest('header, nav, aside, [role="banner"], [role="navigation"], [role="complementary"], [role="region"], [role="main"]')) return null;
    }
    return one([...main.querySelectorAll(S.primaryToolbar)].filter(toolbar => visible(toolbar) && !toolbar.closest(S.readingExcluded)));
  }

  function mailboxButton(action, toolbar) {
    // Gmail exposes the action appropriate to its current read state (and
    // bulk selection). Resolve it on every press; never store a second state.
    // Match only recoverable Delete, never Gmail's Delete forever action.
    return toolbar && one(buttons(toolbar).filter(button => mailboxActionNames[action].includes(name(button))));
  }

  function sendButton(focus) {
    if (focus.closest('[role="menu"]') || overlayOpen()) return null;
    // The addressing form and editor are native siblings. Resolve their common
    // region/dialog from focus; never guess from the most recent open draft.
    for (let host = focus.closest(S.region); host; host = host.parentElement?.closest(S.region)) {
      if (!visible(host)) return null;
      const forms = host.querySelectorAll(S.composeForm);
      if (forms.length > 1) return null;
      if (forms.length !== 1 || ![...host.querySelectorAll(S.editor)].some(visible)) continue;
      // Exact action name, allowing Gmail's displayed shortcut annotation.
      // Excludes Send & archive and More send options.
      return one(buttons(host).filter(button => /^Send(?:\s+\([^)]*\))?$/.test(name(button))));
    }
    return null;
  }

  function undoButton() {
    return one([...document.querySelectorAll(S.nativeUndo)].filter(control => usable(control) &&
      !control.closest(`${S.composeExcluded}, .inboxsdk__butterbar, [data-inboxsdk-id]`) &&
      /^(Undo|Undo link)$/.test(name(control)) && control.textContent.trim() === "Undo"));
  }

  function conversationButton(action) {
    const thread = app.reverseThreads?.currentConversation();
    const shell = thread?.heading.closest(S.readingShell), main = shell?.closest(S.main);
    // Gmail may keep keyboard focus in its page-level proxy after closing a
    // draft. The current visible conversation, not focus ancestry, owns replies.
    if (!visible(shell) || !visible(thread.list) || !main ||
        main.querySelector('[role="row"] [role="checkbox"]:is([aria-checked="true"], [aria-checked="mixed"])')) return null;
    if (action === "toggleExpand") {
      // Gmail's own label owns the current expand/collapse state. Restrict the
      // action to the conversation header, never controls inside received mail.
      return one([...shell.querySelectorAll(S.threadToggle)].filter(control => usable(control) &&
        control.closest(S.readingShell) === shell && !control.closest(`${S.readingExcluded}, ${S.threadList}`)));
    }
    const toolbar = one([...main.querySelectorAll(S.primaryToolbar)].filter(visible));
    if (!toolbar) return null;
    // Reuse the existing reading-pane bridge when it owns the native footer.
    // Its click handler resolves Gmail's action again and preserves floating preferences.
    const bridged = [...toolbar.querySelectorAll(`.gmail-pro-message-actions button[data-gp-message-action="${action}"]`)].filter(usable);
    if (bridged.length) return one(bridged);
    const ownsChrome = node => !node.closest(S.readingExcluded);
    const footers = [...shell.querySelectorAll(S.nativeFooter)].filter(footer => ownsChrome(footer) && visible(footer) &&
      footer.querySelector(`${S.nativeReply}, ${S.nativeReplyAll}, ${S.nativeForward}`));
    const sticky = footers.filter(footer => footer.closest('.btDi4d'));
    const footer = sticky.length === 1 ? sticky[0] : one(footers);
    const selector = { replyAll: S.nativeReplyAll, forward: S.nativeForward }[action];
    return footer && one([...footer.querySelectorAll(selector)].filter(control => ownsChrome(control) && usable(control)));
  }

  function activate(target) {
    if (!target) return;
    // Gmail's toolbar buttons use pressed state set on mousedown; .click()
    // alone does not activate them. Match one ordinary native mouse gesture.
    const box = target.getBoundingClientRect();
    for (const type of ["mousedown", "mouseup", "click"]) {
      if (!usable(target)) break;
      target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true,
        view: window, button: 0, buttons: type === "mousedown" ? 1 : 0, detail: 1,
        clientX: box.left + box.width / 2, clientY: box.top + box.height / 2 }));
    }
  }

  function reset() { held.clear(); }
  function consume(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  function keyboard(event) {
    const key = event.key.toLowerCase();
    const deleteKey = key === "backspace" || key === "delete";
    const plainKey = deleteKey || key === "z";
    const binding = !event.ctrlKey && !event.altKey && (plainKey ?
      !event.metaKey && !event.shiftKey && bindings[key] : event.metaKey && event.shiftKey && bindings["shift+" + key]);
    const down = event.type === "keydown";
    const fresh = down && !event.repeat;
    const claimed = held.has(key);
    // macOS can omit the letter's keyup. The next fresh down decides again.
    if (fresh || event.type === "keyup" || (down && !binding)) held.delete(key);
    if (event.isComposing || !event.cancelable) return;
    if (!fresh) {
      if (claimed && (!down || binding) && (!plainKey || !mailboxBlocked(event))) consume(event);
      return;
    }
    if (!binding || !options[binding[0]]) return;

    const action = binding[1];
    const focus = document.activeElement;
    const blocked = action !== "send" && mailboxBlocked(event);
    const prevented = event.defaultPrevented;

    if (action === "undo") {
      if (blocked || prevented) return;
      const canceledArchive = app.archiveRead?.cancelPendingForUndo?.();
      const target = canceledArchive ? null : undoButton();
      if (canceledArchive || target || mailboxToolbar(focus)) app.readingPane?.cancelFilingForShortcut?.(true);
      // Gmail can still own Undo without a toast. Pass the entire original
      // gesture through, even if a toast appears after keydown.
      if (!canceledArchive && !target) return;
      consume(event);
      held.add(key);
      activate(target);
      return;
    }

    const mailboxAction = Object.hasOwn(mailboxActionNames, action);
    const toolbar = mailboxAction && !blocked ? mailboxToolbar(focus) : null;
    if (deleteKey && !toolbar) return;
    // Reserve enabled chords even without an actionable target. In particular,
    // failed Send discovery must never fall through to Gmail's Discard shortcut.
    consume(event);
    held.add(key);
    if (prevented) return;
    app.readingPane?.cancelFilingForShortcut?.();
    let target;
    if (!blocked && focus instanceof Element) {
      if (mailboxAction) target = mailboxButton(action, toolbar);
      else if (action === "send") target = sendButton(focus);
      else target = conversationButton(action);
    }
    if (action !== "archive" || !target) app.archiveRead?.cancel?.();
    activate(target); // One native gesture, synchronously; no queued send or retry.
  }

  function stop() {
    unsubscribeConversation?.(); unsubscribeConversation = undefined;
    for (const type of events) window.removeEventListener(type, keyboard, true);
    window.removeEventListener("blur", reset);
    reset(); running = false;
  }
  function update(patch = {}) {
    for (const preference of preferences) if (Object.hasOwn(patch, preference)) options[preference] = patch[preference];
    if (!isMac || !preferences.some(preference => options[preference])) return stop();
    // Share thread discovery even when appearance, ordering, and zoom are off.
    // Resolve the live context on each key press; retain no message state.
    if (conversationPreferences.some(preference => options[preference])) {
      unsubscribeConversation ??= app.reverseThreads.subscribeConversation(() => {});
    } else { unsubscribeConversation?.(); unsubscribeConversation = undefined; }
    if (running) return;
    for (const type of events) window.addEventListener(type, keyboard, listenerOptions);
    window.addEventListener("blur", reset);
    running = true;
  }
  app.keyboardShortcuts = Object.freeze({ start: update, update, stop });
})();
