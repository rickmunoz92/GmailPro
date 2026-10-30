"use strict";

// The canonical unpacked owner/development copy stays usable during setup.
// package-store.cjs ALWAYS replaces this with required:true in the store ZIP.
globalThis.GmailProBillingConfig = Object.freeze({
  required: false,
  apiOrigin: "https://gmail-pro.netlify.app"
});
