(() => {
  'use strict';
  // Material revisions need new versions, archived pages, and fresh acceptance.
  const legal = Object.freeze({
    termsVersion: '2026-11-04.2', privacyVersion: '2026-11-04.1',
    termsURL: 'https://gmail-pro.netlify.app/legal/terms-2026-11-04-2',
    privacyURL: 'https://gmail-pro.netlify.app/legal/privacy-2026-11-04-1'
  });
  if (typeof module === 'object' && module.exports) module.exports = legal;
  else globalThis.GmailProLegal = legal;
})();
