(() => {
  "use strict";

  const app = (globalThis.GmailPro ??= {});
  if (app.contentInitialized) return;
  app.contentInitialized = true;

  // Deliberately inert in Phase 1, regardless of saved toggles:
  // no DOM reads/writes, observers, event listeners, timers, or storage access.
  // Phase 2 will coordinate feature start/stop and settings subscription here.
  app.debug.log("content-ready");
})();
