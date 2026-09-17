(() => {
  "use strict";

  const app = (globalThis.GmailPro ??= {});
  if (app.debug) return;

  // Local development only. Never log addresses, message content, DOM nodes,
  // settings objects, or raw errors; the allowlist accepts lifecycle codes only.
  const DEBUG = false;
  const events = new Set(["content-ready", "settings-load-failed", "settings-save-failed",
    "compose-detected", "bcc-insertion-attempted", "bcc-already-present",
    "bcc-user-removal", "bcc-selector-failure"]);

  app.debug = Object.freeze({
    log(event) {
      if (DEBUG && events.has(event)) console.debug(`[Gmail Pro] ${event}`);
    }
  });
})();
