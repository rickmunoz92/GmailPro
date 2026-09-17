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
    else {
      app.autoBcc.update(patch);
      app.reverseThreads.update(patch);
    }
  });
  window.addEventListener("pagehide", () => {
    alive = false;
    unsubscribe();
    app.autoBcc.stop();
    app.reverseThreads.stop();
  }, { once: true });
  app.settings.load().then(settings => {
    if (!alive) return;
    const initial = { ...settings, ...changes };
    app.autoBcc.start(initial);
    app.reverseThreads.start(initial);
    changes = {};
    loaded = true;
    app.debug.log("content-ready");
  }).catch(() => {
    // A failed initial read must never result in guessed recipient settings.
    unsubscribe();
    app.debug.log("settings-load-failed");
  });
})();
