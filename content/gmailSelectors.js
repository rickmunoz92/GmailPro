(() => {
  "use strict";
  const app = (globalThis.GmailPro ??= {});
  if (app.selectors) return;

  // Verified with Gmail's English desktop UI, September 2026. No generated
  // classes for compose/thread discovery. The form owns addressing but NOT the editable message body.
  // Accessible names are localized; unknown layouts/locales fail closed.
  // Message-list layout needs no JS discovery: its structural gate and Gmail
  // presentation hooks are centralized/documented in content/messageList.css.
  app.selectors = Object.freeze({
    // Label hooks verified against desktop Gmail, September 2026. gh=cl
    // excludes system folders. Gmail currently uses flat .aim siblings inside
    // .TK; require href + matching data-label-name + explicit indentation too.
    // Unknown structures fail closed. Never treat all sidebar links as labels.
    labelContainer: '[gh="cl"]',
    labelList: ':scope > .TK',
    labelRow: '.aim',
    labelLine: '.TN',
    labelLink: 'a[href*="#label/"]',
    labelMenu: '[data-label-name][aria-haspopup="true"]',
    labelSection: '[aria-labelledby]',
    labelMoreCollapsed: '[gh="mll"][aria-label="More labels"]',
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
    addBcc: '[role="link"][aria-label^="Add Bcc recipients"]',
    // Live Gmail: complete message envelopes, not the nested body divs. Older
    // grouped messages temporarily lose role/aria-expanded but keep the same
    // action attribute and one-div wrapper as their neighboring message slots.
    threadHeading: 'h2[data-thread-perm-id][data-legacy-thread-id]',
    threadList: '[role="list"]',
    threadMessage: '[data-message-id][data-legacy-message-id]',
    threadItem: 'div[role="listitem"][tabindex="-1"][jsaction][aria-expanded]',
    threadPlaceholder: 'div[tabindex="-1"][jsaction]:not([role]):not([aria-expanded])',
    threadRow: '[role="row"]',
    threadFixed: 'button, [role="button"], [role="toolbar"], [role="region"], h1, h2, h3'
  });
})();
