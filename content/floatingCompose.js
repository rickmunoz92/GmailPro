(() => {
  "use strict";
  const app = (globalThis.GmailPro ??= {});
  if (app.floatingCompose) return;
  const S = app.selectors;
  const options = { ...app.settings.defaults };
  const preferences = { reply: 'floatingReplyEnabled', replyAll: 'floatingReplyAllEnabled', forward: 'floatingForwardEnabled' };
  const events = ['pointerdown', 'mousedown', 'mouseup', 'click'];
  let running = false, forwarding = false;

  function forward(event) {
    if (forwarding || event.defaultPrevented || event.button !== 0 || event.shiftKey ||
        event.ctrlKey || event.metaKey || event.altKey || !(event.target instanceof Element)) return;
    const target = event.target.closest(S.composeAction);
    if (!target || target.closest(S.composeExcluded + ', [role="dialog"], [role="region"]') ||
        target.matches('[disabled], [aria-disabled="true"]')) return;
    const name = (target.getAttribute('aria-label') || target.getAttribute('data-tooltip') || target.textContent || '').trim().toLowerCase();
    const kind = target.dataset.gpMessageAction ||
      (target.matches(S.nativeReplyAll) || /^(reply all|reply to all)$/.test(name) ? 'replyAll' :
       target.matches(S.nativeReply) || name === 'reply' ? 'reply' :
       target.matches(S.nativeForward) || name === 'forward' ? 'forward' : null);
    if (!options[preferences[kind]]) return;
    // Only reading-pane actions, our toolbar, and Gmail's detached message menu.
    // A similarly named button in Chat or another extension must stay untouched.
    const shell = target.closest(S.readingShell) ||
      ((target.hasAttribute('data-gp-message-action') || target.matches('[role="menuitem"]')) &&
       app.reverseThreads.currentConversation()?.heading.closest(S.readingShell));
    if (!shell?.isConnected) return;

    // Gmail reads Shift before click on some header controls. Put it in native
    // event data: an expando on an isolated-world event is invisible to Gmail.
    // No editor discovery, hiding, timers, Pop Out clicks, or draft ownership.
    const init = { bubbles: event.bubbles, cancelable: event.cancelable, composed: event.composed,
      view: window, shiftKey: true, button: event.button, buttons: event.buttons,
      detail: event.detail, clientX: event.clientX, clientY: event.clientY,
      screenX: event.screenX, screenY: event.screenY, relatedTarget: event.relatedTarget };
    const nativeEvent = event instanceof PointerEvent ? new PointerEvent(event.type, { ...init,
      pointerId: event.pointerId, pointerType: event.pointerType, isPrimary: event.isPrimary,
      width: event.width, height: event.height, pressure: event.pressure }) : new MouseEvent(event.type, init);
    event.stopImmediatePropagation();
    forwarding = true;
    try { if (!event.target.dispatchEvent(nativeEvent)) event.preventDefault(); }
    finally { forwarding = false; }
  }

  function stop() {
    for (const type of events) document.removeEventListener(type, forward, true);
    running = false;
  }
  function update(patch = {}) {
    for (const name of Object.values(preferences)) if (Object.hasOwn(patch, name)) options[name] = patch[name];
    if (!Object.values(preferences).some(name => options[name])) return stop();
    if (running) return;
    for (const type of events) document.addEventListener(type, forward, true);
    running = true;
  }
  app.floatingCompose = Object.freeze({ start: update, update, stop });
})();
