(() => {
  "use strict";
  const app = (globalThis.GmailPro ??= {});
  if (app.messageZoom) return;
  const S = app.selectors;
  const levels = Object.freeze([80, 90, 100, 110, 125, 150, 175, 200]);
  const marker = "gmail-pro-message-zoom";
  let enabled = false;
  let level = 100;
  let bootstrap;
  let unsubscribeConversation;
  let conversation = null;

  function apply() {
    const root = document.documentElement;
    if (!root) return;
    bootstrap?.disconnect();
    bootstrap = undefined;
    root.classList.toggle(marker, enabled && level !== 100);
    if (enabled) root.style.setProperty("--gmail-pro-message-zoom", String(level / 100));
    else root.style.removeProperty("--gmail-pro-message-zoom");
  }

  function visible(element) {
    return element.checkVisibility({ visibilityProperty: true, opacityProperty: true }) &&
      !element.closest('[aria-hidden="true"], [inert]');
  }

  function readingContext(event) {
    const focus = document.activeElement;
    if (focus instanceof Element && (focus.isContentEditable || focus.closest(S.zoomExcluded))) return false;
    if (event.composedPath().some(node => node instanceof Element &&
        (node.isContentEditable || node.matches(S.zoomExcluded)))) return false;
    // Overlays make the reading context ambiguous, even when focus was left behind.
    if ([...document.querySelectorAll('[role="dialog"], [role="menu"]')].some(visible)) return false;
    const lists = new Set();
    const owners = new Map();
    let main;
    for (const body of document.querySelectorAll(S.readingBody)) {
      const list = body.closest(S.threadList);
      if (lists.has(list)) continue; // One visible body proves this list is readable.
      if (body.closest(S.zoomExcluded) || body.querySelector('[contenteditable]:not([contenteditable="false"])') || !visible(body)) continue;
      const owner = body.closest(S.main);
      if (!owner) continue;
      if (!owners.has(owner)) owners.set(owner, [...owner.querySelectorAll(S.threadHeading)].filter(visible).length === 1);
      if (!owners.get(owner)) continue;
      lists.add(list);
      main = owner;
      if (lists.size > 1) return false;
    }
    if (lists.size !== 1) return false;
    // Body focus is normal after opening a thread. Focus in another pane or
    // extension control should leave browser shortcuts alone.
    return !focus || focus === document.body || focus === document.documentElement || main.contains(focus);
  }

  function keydown(event) {
    if (!enabled || !event.metaKey || event.ctrlKey || event.altKey ||
        event.isComposing || event.defaultPrevented || !event.cancelable) return;
    let direction;
    if (event.key === "+" || event.key === "=") direction = 1;
    else if (event.key === "-" && !event.shiftKey) direction = -1;
    else if (event.key === "0" && !event.shiftKey) direction = 0;
    else return;
    if (!readingContext(event)) return;
    event.preventDefault();
    if (!event.defaultPrevented) return;
    // Do not suppress unrelated listeners or Gmail's normal event propagation.
    const next = direction === 0 ? 100 : levels[Math.max(0, Math.min(levels.length - 1, levels.indexOf(level) + direction))];
    if (next === level) return; // Still consume at the clamps.
    level = next;
    apply();
  }

  function stop() {
    enabled = false;
    window.removeEventListener("keydown", keydown, true);
    unsubscribeConversation?.();
    unsubscribeConversation = undefined;
    bootstrap?.disconnect();
    bootstrap = undefined;
    conversation = null;
    level = 100;
    apply();
  }

  function update(patch = {}) {
    if (!Object.hasOwn(patch, "messageZoomEnabled") || !!patch.messageZoomEnabled === enabled) return;
    if (!patch.messageZoomEnabled) return stop();
    enabled = true;
    window.addEventListener("keydown", keydown, { capture: true, passive: false });
    unsubscribeConversation = app.reverseThreads.subscribeConversation(identity => {
      if (identity === conversation) return;
      conversation = identity;
      level = 100;
      apply();
    });
    if (document.documentElement) apply();
    else {
      // Only document_start bootstrap; CSS follows all subsequent SPA changes.
      bootstrap = new MutationObserver(apply);
      bootstrap.observe(document, { childList: true });
    }
  }

  app.messageZoom = Object.freeze({ levels, start: update, update, stop });
})();
