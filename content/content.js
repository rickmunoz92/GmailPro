(() => {
  "use strict";
  const app = (globalThis.GmailPro ??= {});
  if (app.contentInitialized) return;
  app.contentInitialized = true;
  let alive = true;
  let loaded = false;
  let idle = false;
  let current = {};
  let changes = {};
  const unsubscribe = app.settings.subscribe(patch => {
    if (!alive) return;
    if (!loaded) Object.assign(changes, patch);
    else {
      Object.assign(current, patch);
      if (idle) app.autoBcc.update(patch);
      app.reverseThreads.update(patch);
      app.messageList.update(patch);
      app.labelOrder.update(patch);
    }
  });
  app.startAutoBcc = () => {
    if (!alive || idle) return;
    idle = true;
    if (loaded) app.autoBcc.start(current);
  };
  window.addEventListener("pagehide", () => {
    alive = false;
    unsubscribe();
    if (idle) app.autoBcc.stop();
    app.reverseThreads.stop();
    app.messageList.stop();
    app.labelOrder.stop();
  }, { once: true });
  app.settings.load().then(settings => {
    if (!alive) return;
    current = { ...settings, ...changes };
    if (idle) app.autoBcc.start(current);
    app.reverseThreads.start(current);
    app.messageList.start(current);
    app.labelOrder.start(current);
    changes = {};
    loaded = true;
    app.debug.log("content-ready");
  }).catch(() => {
    // A failed initial read must never result in guessed recipient settings.
    unsubscribe();
    app.debug.log("settings-load-failed");
  });
})();
