(() => {
  "use strict";
  const app = (globalThis.GmailPro ??= {});
  if (app.selectors) return;

  // Verified with Gmail's English desktop UI, September 2026. No generated
  // classes. The form owns addressing but NOT the editable message body.
  // Accessible names are localized; unknown layouts/locales fail closed.
  app.selectors = Object.freeze({
    main: '[role="main"]',
    form: 'form',
    composeMarker: 'input[name="composeid"]',
    region: '[role="region"], [role="dialog"]',
    editor: '[contenteditable="true"]',
    recipientInput: 'input[role="combobox"][aria-label="To recipients" i], input[role="combobox"][aria-label="CC recipients" i], input[role="combobox"][aria-label="BCC recipients" i]',
    bccInput: 'input[role="combobox"][aria-label="BCC recipients" i]',
    recipientList: '[role="listbox"]',
    chip: '[role="option"][data-hovercard-id]',
    summaryRecipient: 'span[email], span[data-hovercard-id]',
    // Inline replies initially hide their addressing UI behind this focusable
    // summary. Require recipient metadata; never click a generic tabindex node.
    summary: '[tabindex]:not([role])',
    addBcc: '[role="link"][aria-label^="Add Bcc recipients"]'
  });
})();
