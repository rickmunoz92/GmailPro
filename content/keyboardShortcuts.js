(() => {
  "use strict";
  const app = (globalThis.GmailPro ??= {});
  if (app.keyboardShortcuts) return;
  const S = app.selectors;
  const preferences = { a: "archiveShortcutEnabled", d: "sendShortcutEnabled" };
  const options = { ...app.settings.defaults };
  const held = new Set();
  const events = ["keydown", "keypress", "keyup"];
  const listenerOptions = { capture: true, passive: false };
  const isMac = /mac/i.test(navigator.userAgentData?.platform || navigator.platform);
  let running = false;

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

  function archiveButton(focus) {
    if (focus.closest(S.shortcutArchiveExcluded) || overlayOpen()) return null;
    const mains = [...document.querySelectorAll(S.main)].filter(visible);
    const main = one(mains);
    if (!main || (focus !== document.body && focus !== document.documentElement && !main.contains(focus))) return null;
    const toolbar = one([...main.querySelectorAll(S.primaryToolbar)].filter(visible));
    return toolbar && one(buttons(toolbar).filter(button => name(button) === "Archive"));
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

  function reset() { held.clear(); }
  function keyboard(event) {
    const key = event.key.toLowerCase();
    // macOS can release Command before delivering the letter's keyup, or omit
    // that keyup. Release latches on modifier release and loss of focus as well.
    if (event.type === "keyup" && (key === "meta" || key === "shift")) reset();
    const exact = event.metaKey && event.shiftKey && !event.ctrlKey && !event.altKey;
    if (event.type === "keydown" && !exact) held.delete(key);
    const reserved = options[preferences[key]] && exact;
    const companion = event.type !== "keydown" && held.has(key);
    if ((!reserved && !companion) || event.isComposing || !event.cancelable) return;
    const prevented = event.defaultPrevented;
    // Reserve enabled chords even without an actionable target. In particular,
    // failed Send discovery must never fall through to Gmail's Discard shortcut.
    event.preventDefault();
    event.stopImmediatePropagation();
    if (event.type === "keyup") { held.delete(key); return; }
    // Native macOS may omit every release event for a Command chord. A fresh
    // non-repeating keydown is the next physical press, even without keyup.
    if (event.type !== "keydown" || event.repeat) return;
    held.add(key);
    if (prevented) return;
    const focus = document.activeElement;
    if (!(focus instanceof Element)) return;
    const target = key === "a" ? archiveButton(focus) : sendButton(focus);
    target?.click(); // One native action, synchronously; no queued send or retry.
  }

  function stop() {
    for (const type of events) window.removeEventListener(type, keyboard, true);
    window.removeEventListener("blur", reset, true);
    reset(); running = false;
  }
  function update(patch = {}) {
    for (const preference of Object.values(preferences)) if (Object.hasOwn(patch, preference)) options[preference] = patch[preference];
    if (!isMac || !Object.values(preferences).some(preference => options[preference])) return stop();
    if (running) return;
    for (const type of events) window.addEventListener(type, keyboard, listenerOptions);
    window.addEventListener("blur", reset, true);
    running = true;
  }
  app.keyboardShortcuts = Object.freeze({ start: update, update, stop });
})();
