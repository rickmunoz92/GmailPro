(() => {
  "use strict";
  const app = (globalThis.GmailPro ??= {});
  if (app.contentInitialized) return;
  app.contentInitialized = true;
  let alive = true;
  let loaded = false;
  let changes = {};
  const unsubscribe = app.settings.subscribe(patch => {
    if (!alive) return;
    if (!loaded) Object.assign(changes, patch);
    else app.autoBcc.update(patch);
  });
  window.addEventListener("pagehide", () => {
    alive = false;
    unsubscribe();
    app.autoBcc.stop();
  }, { once: true });
  app.settings.load().then(settings => {
    if (!alive) return;
    app.autoBcc.start({ ...settings, ...changes });
    changes = {};
    loaded = true;
    app.debug.log("content-ready");
  }).catch(() => {
    // A failed initial read must never result in guessed recipient settings.
    unsubscribe();
    app.debug.log("settings-load-failed");
  });
})();
