(() => {
  "use strict";

  const app = (globalThis.GmailPro ??= {});
  if (app.selectors) return;

  // Candidate landmarks only: NOT verified against live Gmail and unused in Phase 1.
  // These broad selectors cannot identify a compose window or message on their own.
  // Validate scoped structure before adding any feature-specific selectors here.
  app.selectors = Object.freeze({
    mainLandmark: '[role="main"]',
    dialogLandmark: '[role="dialog"]',
    editableTextbox: '[role="textbox"][contenteditable="true"]'
  });
})();
