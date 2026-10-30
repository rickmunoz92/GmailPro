(() => {
  "use strict";
  const app = (globalThis.GmailPro ??= {});
  if (app.contentInitialized) return;
  app.contentInitialized = true;
  let alive = true;
  let loaded = false;
  let idle = false;
  let running = false;
  let entitled = globalThis.GmailProBillingConfig?.required === false;
  let licenseGeneration = 0;
  let licenseTimer = null;
  let current = {};
  let changes = {};
  const unsubscribe = app.settings.subscribe(patch => {
    if (!alive) return;
    if (!loaded) Object.assign(changes, patch);
    else {
      Object.assign(current, patch);
      if (!running) return;
      if (idle) app.autoBcc.update(patch);
      app.reverseThreads.update(patch);
      app.messageList.update(patch);
      app.autoPaging.update(patch);
      app.appearance.update(patch);
      app.workspaceLayout.update(patch);
      app.headerLayout.update(patch);
      app.readingPane.update(patch);
      app.floatingCompose.update(patch);
      app.keyboardShortcuts.update(patch);
      app.messageZoom.update(patch);
      app.labelOrder.update(patch);
    }
  });
  app.startAutoBcc = () => {
    if (!alive || idle) return;
    idle = true;
    if (running) app.autoBcc.start(current);
  };
  const startFeatures = () => {
    if (!alive || !loaded || !entitled || running) return;
    running = true;
    if (idle) app.autoBcc.start(current);
    app.reverseThreads.start(current);
    app.messageList.start(current);
    app.autoPaging.start(current);
    app.appearance.start(current);
    app.workspaceLayout.start(current);
    app.headerLayout.start(current);
    app.readingPane.start(current);
    app.floatingCompose.start(current);
    app.keyboardShortcuts.start(current);
    app.messageZoom.start(current);
    app.labelOrder.start(current);
  };
  const stopFeatures = () => {
    if (!running) return;
    running = false;
    if (idle) app.autoBcc.stop();
    app.reverseThreads.stop();
    app.messageList.stop();
    app.autoPaging.stop();
    app.readingPane.stop();
    app.floatingCompose.stop();
    app.keyboardShortcuts.stop();
    app.workspaceLayout.stop();
    app.appearance.stop();
    app.headerLayout.stop();
    app.messageZoom.stop();
    app.labelOrder.stop();
  };
  async function checkLicense() {
    const generation = ++licenseGeneration;
    if (licenseTimer !== null) clearTimeout(licenseTimer);
    licenseTimer = null;
    try {
      const status = await app.entitlement.getStatus();
      if (!alive || generation !== licenseGeneration) return;
      entitled = status.active === true && status.validUntil > Date.now();
      if (entitled) {
        startFeatures();
        licenseTimer = setTimeout(checkLicense, Math.min(6 * 60 * 60 * 1000, Math.max(1000, status.validUntil - Date.now())));
      } else stopFeatures();
    } catch {
      if (!alive || generation !== licenseGeneration) return;
      entitled = false;
      stopFeatures();
    }
  }
  const required = globalThis.GmailProBillingConfig?.required !== false;
  const unsubscribeLicense = required ? app.entitlement.subscribe(checkLicense) : () => {};
  const visibilityChanged = () => { if (document.visibilityState === 'visible') checkLicense(); };
  if (required) { document.addEventListener('visibilitychange', visibilityChanged); checkLicense(); }
  window.addEventListener("pagehide", () => {
    alive = false;
    licenseGeneration++;
    if (licenseTimer !== null) clearTimeout(licenseTimer);
    unsubscribeLicense();
    if (required) document.removeEventListener('visibilitychange', visibilityChanged);
    unsubscribe();
    stopFeatures();
  }, { once: true });
  app.settings.load().then(settings => {
    if (!alive) return;
    current = { ...settings, ...changes };
    changes = {};
    loaded = true;
    startFeatures();
    app.debug.log("content-ready");
  }).catch(() => {
    // A failed initial read must never result in guessed recipient settings.
    unsubscribe();
    app.debug.log("settings-load-failed");
  });
})();
