(() => {
  "use strict";
  const app = (globalThis.GmailPro ??= {});
  if (app.messageList) return;

  const marker = "gmail-pro-message-list";
  let enabled = false;
  let bootstrap;

  function apply() {
    if (!document.documentElement) return;
    bootstrap?.disconnect();
    bootstrap = undefined;
    document.documentElement.classList.toggle(marker, enabled);
  }

  function stop() {
    enabled = false;
    bootstrap?.disconnect();
    bootstrap = undefined;
    document.documentElement?.classList.remove(marker);
  }

  function update(patch = {}) {
    if (!Object.hasOwn(patch, "appleMailMessageListEnabled")) return;
    if (!patch.appleMailMessageListEnabled) return stop();
    if (enabled) return;
    enabled = true;
    if (document.documentElement) apply();
    else {
      // document_start can precede <html>. Watch only the document's direct
      // children, once. CSS handles every subsequent Gmail/SPA row change.
      bootstrap = new MutationObserver(apply);
      bootstrap.observe(document, { childList: true });
    }
  }

  app.messageList = Object.freeze({ start: update, update, stop });
})();
