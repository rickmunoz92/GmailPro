/* Test-only native-row retention probe. Never include in the shipped manifest.
   Keeps original page subtrees and handlers; stores identities only in memory. */
(() => {
  "use strict";
  const app = (globalThis.GmailPro ??= {});
  if (app.retentionProbe) return;
  const live = location.hostname === "mail.google.com" &&
    new URLSearchParams(location.search).get("gmail-pro-retention-probe") === "1";
  const fixture = location.pathname === "/tests/endlessScrollProbe.html";
  if (!live && !fixture) return;
  const visible = node => !!node?.isConnected && node.getClientRects().length > 0 &&
    !node.closest('[hidden], [aria-hidden="true"]');
  const owned = "[data-gmail-pro-retention-probe]";
  const retainGrid = live && new URLSearchParams(location.search).get("retained-subtree") === "grid";
  const state = { batches: [], pending: null, host: null, panel: null, status: null,
    button: null, current: null, observer: null, frame: 0, stopped: false };
  const one = nodes => nodes.length === 1 ? nodes[0] : null;
  function identities(grid) {
    return [...grid.tBodies[0].querySelectorAll(':scope > tr[role="row"]')]
      .map(row => row.querySelector('[role="link"] [data-thread-id][data-legacy-thread-id]')?.getAttribute("data-thread-id"));
  }
  function discover() {
    const main = one([...document.querySelectorAll('[role="main"]')].filter(node => visible(node) && !node.closest(owned)));
    const root = main && one([...main.querySelectorAll('.Nu.tf')].filter(visible));
    const grid = root && one([...root.querySelectorAll('table[role="grid"]')].filter(visible));
    const pager = main && one([...main.querySelectorAll('.Di')].filter(node => visible(node) && node.querySelector('.ts')));
    const older = pager?.querySelector(':scope > [role="button"]:is([aria-label="Older"], [aria-label="Next results"])');
    const nums = pager && [...pager.querySelectorAll('.ts')].slice(0, 2).map(node => Number(node.textContent.replace(/[,\s]/g, "")));
    if (!root || !grid || grid.tBodies.length !== 1 || !older || nums.length !== 2) return null;
    const keys = identities(grid);
    if (!keys.length || keys.some(key => !key) || new Set(keys).size !== keys.length || nums[1] - nums[0] + 1 !== keys.length) return null;
    return { main, root, grid, pager, older, first: nums[0], end: nums[1], keys };
  }
  function summary(extra = "") {
    const intact = state.batches.every(batch => batch.grid.isConnected &&
      JSON.stringify(identities(batch.grid)) === JSON.stringify(batch.keys));
    const count = state.batches.reduce((n, batch) => n + batch.keys.length, 0);
    state.panel.dataset.batches = String(state.batches.length);
    state.panel.dataset.conversations = String(count);
    state.panel.dataset.intact = String(intact);
    state.status.textContent = `${state.batches.length} batches · ${count} conversations · retained rows ${intact ? "intact" : "CHANGED"}${extra ? " · " + extra : ""}`;
    return intact;
  }
  function clearPending() {
    if (!state.pending) return;
    clearTimeout(state.pending.timeout); state.pending = null;
    state.observer?.disconnect(); cancelAnimationFrame(state.frame); state.frame = 0;
    state.button.disabled = false;
  }
  function retain(now) {
    const placeholder = document.createComment("Gmail Pro test-only retained page");
    const retained = retainGrid ? now.grid : now.root;
    retained.before(placeholder);
    const originalStyle = retained.getAttribute("style");
    const batch = { ...now, retained, placeholder, originalStyle };
    retained.dataset.gmailProProbeBatch = String(state.batches.length + 1);
    retained.style.setProperty("height", "auto", "important");
    retained.style.setProperty("min-height", "0", "important");
    retained.style.setProperty("width", "100%", "important");
    retained.style.setProperty("overflow", "visible", "important");
    state.host.append(retained); state.batches.push(batch); state.current = batch;
  }
  function check() {
    state.frame = 0;
    const pending = state.pending;
    if (!pending) return;
    if (!summary("loading next native page")) {
      clearPending(); state.panel.dataset.result = "retention-failed";
      summary("STOPPED: Gmail invalidated retained rows"); return;
    }
    const now = discover();
    if (!now || now.first <= pending.first || now.end <= pending.end ||
        now.keys.every(key => pending.keys.has(key))) { pending.candidate = null; return; }
    const signature = JSON.stringify([now.first, now.end, now.keys]);
    if (pending.candidate !== signature) { pending.candidate = signature; schedule(); return; }
    const previousScroll = state.host.scrollTop;
    retain(now); clearPending(); state.host.scrollTop = previousScroll;
    state.panel.dataset.result = "batch-loaded"; summary("test older-row actions before release");
    state.button.disabled = now.older.getAttribute("aria-disabled") === "true";
  }
  function schedule() {
    if (state.pending && !state.frame) state.frame = requestAnimationFrame(check);
  }
  function loadNext() {
    if (state.pending || state.stopped) return;
    const now = state.current || discover();
    if (!now || !visible(now.older) || now.older.getAttribute("aria-disabled") === "true") return;
    const reading = now.main.querySelector('.Nu.S3');
    if (!reading || !visible(reading)) { summary("unsupported layout"); return; }
    if (!state.batches.length) {
      const box = now.root.getBoundingClientRect();
      Object.assign(state.host.style, { left: `${box.left}px`, top: `${box.top}px`,
        width: `${box.width}px`, height: `${box.height}px` });
      state.host.hidden = false;
      retain(now);
    }
    state.pending = { first: now.first, end: now.end, keys: new Set(now.keys), candidate: null, timeout: setTimeout(() => {
      clearPending(); state.panel.dataset.result = "timeout"; summary("STOPPED: native page did not settle");
    }, 15000) };
    state.button.disabled = true; summary("loading next native page");
    state.observer = new MutationObserver(schedule);
    state.observer.observe(document.body, { childList: true, subtree: true,
      characterData: true, attributes: true, attributeFilter: ["aria-disabled", "data-thread-id"] });
    const box = now.older.getBoundingClientRect();
    for (const type of ["mousedown", "mouseup", "click"]) {
      if (!now.older.isConnected) break;
      now.older.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true,
        view: window, button: 0, buttons: type === "mousedown" ? 1 : 0, detail: 1,
        clientX: box.left + box.width / 2, clientY: box.top + box.height / 2 }));
    }
    schedule();
  }
  function stop() {
    clearPending(); state.stopped = true;
    const current = state.current;
    if (current?.placeholder.isConnected) {
      current.placeholder.replaceWith(current.retained);
      if (current.originalStyle === null) current.retained.removeAttribute("style");
      else current.retained.setAttribute("style", current.originalStyle);
      delete current.retained.dataset.gmailProProbeBatch;
    }
    for (const batch of state.batches) batch.placeholder.remove();
    state.host?.remove(); state.panel?.remove(); state.batches.length = 0;
    state.current = null; state.observer = null;
  }
  function mount() {
    if (state.panel || state.stopped || !document.body) return;
    if (live) app.autoPaging?.stop();
    state.host = document.createElement("div"); state.host.setAttribute("role", "main");
    state.host.setAttribute("data-gmail-pro-retention-probe", "host"); state.host.hidden = true;
    Object.assign(state.host.style, { position: "fixed", overflow: "auto", zIndex: "10000",
      background: "var(--gp-bg-primary, #fff)", color: "var(--gp-text-primary, #111)" });
    state.panel = document.createElement("section"); state.panel.setAttribute("data-gmail-pro-retention-probe", "controls");
    Object.assign(state.panel.style, { position: "fixed", bottom: "8px", right: "8px", zIndex: "10001",
      padding: "12px", background: "#fff", color: "#111", border: "2px solid #3754a1", borderRadius: "8px", font: "13px system-ui" });
    const title = document.createElement("strong"); title.textContent = "Endless scroll — TEST ONLY";
    state.status = document.createElement("p"); state.status.setAttribute("role", "status");
    state.button = document.createElement("button"); state.button.type = "button"; state.button.textContent = "Retain and load next batch";
    state.button.addEventListener("click", loadNext);
    const close = document.createElement("button"); close.type = "button"; close.textContent = "Stop probe"; close.addEventListener("click", stop);
    state.panel.append(title, state.status, state.button, " ", close); document.body.append(state.host, state.panel); summary("ready");
  }
  app.retentionProbe = Object.freeze({ loadNext, stop });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount, { once: true });
  else mount();
})();
