(() => {
  "use strict";

  const app = (globalThis.GmailPro ??= {});
  if (app.autoBcc) return;

  // Phase 2: compose/reply/reply-all/forward support. Before activation, verify
  // one valid configured address, recipient identity, and each compose root.
  // Own scoped observers here; start/stop must remain safe to call repeatedly.
  app.autoBcc = Object.freeze({
    implemented: false,
    start() {},
    stop() {}
  });
})();
