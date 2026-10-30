(() => {
  "use strict";
  const app = (globalThis.GmailPro ??= {});
  if (app.entitlement) return;
  const required = globalThis.GmailProBillingConfig?.required !== false;
  const listeners = new Set();
  const changed = message => {
    if (message?.type !== "gmail-pro-entitlement-changed") return;
    for (const listener of listeners) listener();
  };
  app.entitlement = Object.freeze({
    required,
    async getStatus() {
      if (!required) return { active: true, development: true };
      const result = await chrome.runtime.sendMessage({ type: "gmail-pro-billing", action: "status" });
      if (!result?.ok) throw new Error("Subscription check unavailable.");
      return result.status;
    },
    subscribe(listener) {
      if (!required) return () => {};
      if (!listeners.size) chrome.runtime.onMessage.addListener(changed);
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
        if (!listeners.size) {
          try { chrome.runtime.onMessage.removeListener(changed); } catch { /* old extension context */ }
        }
      };
    }
  });
})();
