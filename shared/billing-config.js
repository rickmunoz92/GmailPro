(() => {
  "use strict";
  // Public free release. Returning to paid access requires a new reviewed build
  // and a separate affirmative purchase; never auto-charge free users.
  const config = Object.freeze({
    required: false,
    free: true,
    apiOrigin: "https://gmail-pro.netlify.app"
  });
  if (typeof module === "object" && module.exports) module.exports = config;
  else globalThis.GmailProBillingConfig = config;
})();
