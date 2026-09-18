(() => {
  "use strict";
  const app = (globalThis.GmailPro ??= {});
  if (app.floatingCompose) return;
  const S = app.selectors;
  const attempted = new WeakSet(), revealed = new WeakSet();
  const pending = new Map();
  const options = { ...app.settings.defaults };
  const setting = { reply: "floatingReplyEnabled", replyAll: "floatingReplyAllEnabled", forward: "floatingForwardEnabled" };
  let running = false, unsubscribe;

  function reveal(intent) {
    intent.region?.removeAttribute("data-gp-floating-pending");
    if (intent.region) revealed.add(intent.region);
  }
  function cancel(shell) {
    const intent = pending.get(shell);
    if (!intent) return;
    intent.observer.disconnect();
    clearTimeout(intent.deadline);
    cancelAnimationFrame(intent.frame);
    reveal(intent);
    pending.delete(shell);
  }
  function control(region) {
    if (!region.isConnected || region.closest('[role="dialog"]') ||
        !region.checkVisibility({ visibilityProperty: true }) ||
        region.querySelectorAll(S.composeForm).length !== 1 || !region.querySelector(S.composeEditor)) return null;
    const buttons = [...region.querySelectorAll(S.popOutReply)].filter(button =>
      button.closest(S.inlineCompose) === region && !button.closest(S.composeExcluded));
    // Current Gmail builds a temporary control, then adds its reply control and
    // hides the first. Activating the construction control silently does nothing.
    // Require that resolved pair; unknown layouts retain native inline behavior.
    const visible = buttons.filter(button => button.checkVisibility({ visibilityProperty: true }) &&
      button.getClientRects().length && !button.matches('[disabled], [aria-disabled="true"]'));
    return buttons.length === 2 && visible.length === 1 ? visible[0] : null;
  }
  function schedule(intent, region) {
    if (intent.frame || (intent.region && intent.region !== region)) return;
    intent.region = region;
    // Hide ONLY this new editor for at most one rendering opportunity. Opacity
    // permits Gmail's native autofocus. All exits reveal it, even failed clicks.
    if (!revealed.has(region)) region.setAttribute("data-gp-floating-pending", "");
    intent.frame = requestAnimationFrame(() => {
      intent.frame = null;
      try {
        if (pending.get(intent.shell) !== intent || !intent.shell.isConnected ||
            !intent.shell.contains(region) || !intent.heading.isConnected) return cancel(intent.shell);
        const button = control(region);
        // Live Gmail wires handlers around its native autofocus. One pre-paint
        // callback after focus lets setup finish; an early DOM-only click fails.
        // If focus isn't ready, reveal now and resume only on native DOM/focus events.
        if (!button || !region.contains(document.activeElement)) return;
        attempted.add(region);
        cancel(intent.shell); // Disconnect BEFORE dispatch; never repeat a transition.
        const box = button.getBoundingClientRect();
        for (const type of ["mousedown", "mouseup", "click"]) {
          if (!button.isConnected || region.closest('[role="dialog"]')) break;
          button.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window,
            button: 0, buttons: type === "mousedown" ? 1 : 0, detail: 1,
            clientX: box.x + box.width / 2, clientY: box.y + box.height / 2 }));
        }
      } catch { cancel(intent.shell); } // Native inline reply always stays usable.
      finally { reveal(intent); }
    });
  }
  function inspect(intent, node) {
    if (!(node instanceof Element) || node.closest(S.composeContent)) return;
    const owner = node.closest(S.inlineCompose);
    const candidates = owner ? [owner] : node.querySelectorAll(S.inlineCompose);
    for (const region of candidates) {
      if (!intent.shell.contains(region) || intent.existing.has(region) || attempted.has(region)) continue;
      if (control(region)) schedule(intent, region);
    }
  }
  function arm(kind, target, phase) {
    for (const shell of pending.keys()) if (!shell.isConnected) cancel(shell);
    const shell = target.closest(S.readingShell) ||
      app.reverseThreads.currentConversation()?.heading.closest(S.readingShell);
    if (!shell || target.closest(S.composeExcluded + ', [role="dialog"], ' + S.inlineCompose)) return;
    const current = pending.get(shell);
    // Keep the pre-pointer baseline for its click and the toolbar's synchronous
    // native delegation. A later user action gets its own fresh baseline.
    if (current?.kind === kind && phase === "click" &&
        ((current.pointer && current.target === target) || current.delegating)) {
      current.pointer = false;
      if (target.dataset.gpMessageAction) {
        current.delegating = true;
        queueMicrotask(() => { current.delegating = false; });
      }
      return;
    }
    cancel(shell);
    if (!options[setting[kind]]) return;
    const heading = shell.querySelector(S.threadHeading);
    if (!heading) return;
    const intent = { shell, heading, kind, target, pointer: phase === "pointerdown",
      delegating: !!target.dataset.gpMessageAction,
      existing: new WeakSet(shell.querySelectorAll(S.inlineCompose)) };
    queueMicrotask(() => { intent.delegating = false; });
    intent.observer = new MutationObserver(records => {
      if (!shell.isConnected || !heading.isConnected) return cancel(shell);
      const changed = new Set();
      for (const record of records) {
        if (record.type === "attributes" || record.target.closest?.(S.inlineCompose)) changed.add(record.target);
        for (const node of record.addedNodes) changed.add(node);
      }
      for (const node of changed) {
        if (!pending.has(shell)) break;
        inspect(intent, node);
      }
    });
    pending.set(shell, intent);
    intent.observer.observe(shell, { childList: true, subtree: true, attributes: true,
      attributeFilter: ["role", "aria-label", "data-tooltip", "contenteditable", "style", "class", "hidden"] });
    // Safety expiry only: never a delayed activation or polling loop.
    intent.deadline = setTimeout(() => cancel(shell), 2000);
  }
  function click(event) {
    if (!(event.target instanceof Element) || event.button > 0) return;
    const target = event.target.closest(S.composeAction);
    if (!target) return;
    const name = (target.getAttribute("aria-label") || target.getAttribute("data-tooltip") || target.textContent)
      .trim().toLowerCase();
    const kind = target.dataset.gpMessageAction || (target.matches(S.nativeReplyAll) || /^(reply all|reply to all)$/.test(name) ? "replyAll" :
      target.matches(S.nativeReply) || name === "reply" ? "reply" :
      target.matches(S.nativeForward) || name === "forward" ? "forward" : null);
    if (setting[kind]) arm(kind, target, event.type);
  }
  function keydown(event) {
    if (event.defaultPrevented || event.repeat || event.ctrlKey || event.metaKey || event.altKey ||
        !(event.target instanceof Element) || event.target.closest(S.zoomExcluded + ', [role="menuitem"]')) return;
    const kind = { r: "reply", a: "replyAll", f: "forward" }[event.key];
    if (kind) arm(kind, event.target, "keydown");
  }
  function focus(event) {
    if (!pending.size) return;
    const region = event.target.closest?.(S.inlineCompose);
    if (!region) return;
    queueMicrotask(() => { for (const intent of pending.values()) if (intent.shell.contains(region)) inspect(intent, region); });
  }
  function cancelAll() { for (const shell of pending.keys()) cancel(shell); }
  function stop() {
    running = false;
    unsubscribe?.(); unsubscribe = undefined;
    cancelAll();
    document.removeEventListener("focusin", focus, true);
    document.removeEventListener("pointerdown", click, true);
    document.removeEventListener("click", click, true);
    document.removeEventListener("keydown", keydown, true);
    window.removeEventListener("hashchange", cancelAll);
    window.removeEventListener("popstate", cancelAll);
    document.removeEventListener("visibilitychange", cancelAll);
  }
  function update(patch = {}) {
    if (running && !Object.values(setting).some(name => Object.hasOwn(patch, name))) return;
    Object.assign(options, patch);
    cancelAll();
    if (!Object.values(setting).some(name => options[name])) return stop();
    if (running) return;
    running = true;
    unsubscribe = app.reverseThreads.subscribeConversation(() => {
      for (const [shell, intent] of pending) if (!shell.isConnected || !intent.heading.isConnected || !shell.checkVisibility()) cancel(shell);
    });
    document.addEventListener("focusin", focus, true);
    document.addEventListener("pointerdown", click, true);
    document.addEventListener("click", click, true);
    document.addEventListener("keydown", keydown, true);
    window.addEventListener("hashchange", cancelAll);
    window.addEventListener("popstate", cancelAll);
    document.addEventListener("visibilitychange", cancelAll);
  }
  app.floatingCompose = Object.freeze({ start: update, update, stop });
})();
