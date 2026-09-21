(() => {
  "use strict";
  const app = (globalThis.GmailPro ??= {});
  if (app.selectors) return;

  // Verified with Gmail's English desktop UI, September 2026. No generated
  // classes for compose/thread discovery. The form owns addressing but NOT the editable message body.
  // Accessible names are localized; unknown layouts/locales fail closed.
  // Message-list layout needs no JS discovery: its structural gate and Gmail
  // presentation hooks are centralized/documented in content/messageList.css.
  // Apple Mail Mode chrome/state hooks live in appleMail.css; appearance.js
  // repeats the structural row gate solely for modifier-click selection.
  // .zE = native unread, .aps = open split-pane row, .TO.nZ = current mailbox.
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
    // Native addressing form and action boundaries, English desktop Gmail.
    composeForm: 'form:has(input[name="composeid"])',
    composeExcluded: '.ii, .a3s, [contenteditable], input, textarea, select',
    composeAction: 'button, [role="button"], [role="link"], [role="menuitem"]',
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
    // grouped messages lose role/aria-expanded; revealing them restores role
    // without necessarily restoring aria-expanded. They keep the same
    // action attribute and one-div wrapper as their neighboring message slots.
    threadHeading: 'h2[data-thread-perm-id][data-legacy-thread-id]',
    threadList: '[role="list"]',
    threadMessage: '[data-message-id][data-legacy-message-id]',
    threadItem: 'div[role="listitem"][tabindex="-1"][jsaction]',
    threadPlaceholder: 'div[tabindex="-1"][jsaction]:not([role]):not([aria-expanded])',
    // Message zoom's CSS repeats this structural contract. .a3s is the read
    // body only; .ii excludes compose and the outer message/header/attachments.
    readingBody: '[role="list"] [role="listitem"][aria-expanded="true"] [data-message-id][data-legacy-message-id] .ii > .a3s',
    zoomExcluded: 'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="combobox"], [role="search"], [role="searchbox"], [role="dialog"], [role="menu"], [data-gmail-pro-label-ui]',
    // Reading chrome / native thread-footer bridge, English desktop Gmail.
    // Structural/semantic guards accompany Gmail's presentation class hooks.
    readingShell: '.iY:has(h2[data-thread-perm-id][data-legacy-thread-id])',
    readingExcluded: '.ii, .a3s, [contenteditable], [role="dialog"], form',
    readingChrome: '.gE, .gA, .gB, .ip, .amr, .nr, .amn, .btDi4d',
    readingRecipients: '.gE .hb',
    primaryToolbar: '[gh="tm"] [gh="mtb"]',
    toolbarMore: '[role="button"][aria-label="More email options"]',
    nativeFooter: '.btDi4d .amn, .gA .amn',
    nativeReplyAll: '.ams.bkI[role="link"]',
    nativeReply: '.ams.bkH[role="link"]',
    nativeForward: '.ams.bkG[role="link"]',
    nativeReaction: 'button[aria-label="Add reaction"], [role="button"][aria-label="Add reaction"]',
    threadRow: '[role="row"]',
    threadFixed: 'button, [role="button"], [role="toolbar"], [role="region"], h1, h2, h3'
  });
})();
