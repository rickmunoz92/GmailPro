(() => {
  "use strict";
  const app = (globalThis.GmailPro ??= {});
  if (app.contentInitialized) return;
  app.contentInitialized = true;
  let alive = true;
  let loaded = false;
  let idle = false;
  let running = false;
  let accepted = false;
  let consentGeneration = 0;
  let settingsGeneration = 0;
  let loading = false;
  let entitled = globalThis.GmailProBillingConfig?.required === false;
  let licenseGeneration = 0;
  let licenseTimer = null;
  let current = {};
  let changes = {};
  let unsubscribe = () => {};
  const settingsChanged = patch => {
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
  };
  app.startAutoBcc = () => {
    if (!alive || idle) return;
    idle = true;
    if (running) app.autoBcc.start(current);
  };
  const startFeatures = () => {
    if (!alive || !accepted || !loaded || !entitled || running) return;
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
    if (!alive || !accepted) return;
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
  function pause() {
    accepted = false; loaded = false; loading = false;
    entitled = !required;
    settingsGeneration++; licenseGeneration++;
    if (licenseTimer !== null) clearTimeout(licenseTimer);
    licenseTimer = null;
    unsubscribe(); unsubscribe = () => {};
    stopFeatures(); current = {}; changes = {};
  }
  async function checkConsent() {
    const generation = ++consentGeneration;
    try {
      const state = await app.consent.getStatus();
      if (!alive || generation !== consentGeneration) return;
      if (state.accepted !== true) { pause(); return; }
      accepted = true;
      if (!loaded && !loading) {
        loading = true;
        const settingsRead = ++settingsGeneration;
        unsubscribe = app.settings.subscribe(settingsChanged);
        app.settings.load().then(settings => {
          if (!alive || !accepted || settingsRead !== settingsGeneration) return;
          current = { ...settings, ...changes }; changes = {};
          loaded = true; loading = false; startFeatures();
          app.debug.log('content-ready');
        }).catch(() => {
          if (settingsRead !== settingsGeneration) return;
          loading = false; unsubscribe(); unsubscribe = () => {};
          app.debug.log('settings-load-failed');
        });
      }
      if (required) await checkLicense();
      else startFeatures();
    } catch { if (alive && generation === consentGeneration) pause(); }
  }
  const unsubscribeConsent = app.consent.subscribe(checkConsent);
  const visibilityChanged = () => { if (document.visibilityState === 'visible') checkConsent(); };
  document.addEventListener('visibilitychange', visibilityChanged);
  checkConsent();
  window.addEventListener("pagehide", () => {
    alive = false;
    consentGeneration++; settingsGeneration++;
    licenseGeneration++;
    if (licenseTimer !== null) clearTimeout(licenseTimer);
    unsubscribeLicense();
    unsubscribeConsent();
    document.removeEventListener('visibilitychange', visibilityChanged);
    unsubscribe();
    stopFeatures();
  }, { once: true });
})();
