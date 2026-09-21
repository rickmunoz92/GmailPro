(() => {
  "use strict";
  const app = (globalThis.GmailPro ??= {});
  if (app.autoPaging) return;
  const S = app.selectors;
  const options = { autoPagingEnabled: false, appleMailModeEnabled: false };
  const passive = { capture: true, passive: true };
  const visible = node => !!node?.isConnected && node.getClientRects().length > 0 &&
    node.checkVisibility({ visibilityProperty: true }) && !node.closest('[hidden], [aria-hidden="true"], [inert]');
  const one = nodes => nodes.length === 1 ? nodes[0] : null;
  const usable = node => visible(node) && !node.matches('[disabled], [aria-disabled="true"]');
  let running = false, pending = null, frame = 0, blockedPage = null, notice = null, activating = null;
  let edge = null, edgeIdle = 0, hintHide = 0, lastInput = null;
  const HOLD_MS = 750, DISTANCE = 180, RELEASE_MS = 240;

  function route() {
    const base = location.hash.replace(/\/p[1-9]\d*$/, "");
    return /^#(?:inbox|all|sent|starred|important|spam|trash|label\/[^#]+|search\/[^#]+)$/.test(base) ? base : null;
  }
  function range(counter) {
    // The first two numeric spans are the native start/end, irrespective of an
    // approximate total. Unknown/localized markup fails closed.
    const parts = [...counter.querySelectorAll(S.pagingRangeNumber)].slice(0, 2)
      .map(node => node.textContent.replace(/[,\s\u200e\u200f]/g, ""));
    if (parts.length !== 2 || parts.some(text => !/^\d+$/.test(text))) return null;
    const [first, end] = parts.map(Number);
    return Number.isSafeInteger(first) && Number.isSafeInteger(end) && first > 0 && end >= first ? { first, end } : null;
  }
  function discover() {
    if (!route() || !document.documentElement.classList.contains("gmail-pro-apple-mail-mode")) return null;
    const main = one([...document.querySelectorAll(S.main)].filter(visible));
    if (!main) return null;
    const root = one([...main.querySelectorAll(S.pagingList)].filter(visible));
    const reading = one([...main.querySelectorAll(S.pagingReadingPane)].filter(visible));
    if (!root || !reading || root.contains(reading)) return null;
    const a = root.getBoundingClientRect(), b = reading.getBoundingClientRect();
    if (b.left < a.right - 2 || Math.abs(a.top - b.top) > 4 || Math.abs(a.height - b.height) > 4) return null;
    const grid = one([...main.querySelectorAll(S.pagingGrid)].filter(visible));
    if (!grid || !root.contains(grid) || grid.tBodies.length !== 1) return null;
    const rows = [...grid.tBodies[0].querySelectorAll(S.pagingRow)];
    const keys = rows.map(row => {
      const link = one([...row.querySelectorAll(S.pagingIdentity)]);
      return link?.getAttribute("data-thread-id") || null;
    });
    if (!keys.length || keys.some(key => !key) || new Set(keys).size !== keys.length) return null;
    const pager = one([...main.querySelectorAll(S.pagingPager)].filter(node => visible(node) &&
      !root.contains(node) && !reading.contains(node) && one([...node.querySelectorAll(S.pagingRange)]) &&
      one([...node.querySelectorAll(S.pagingOlder)]) && one([...node.querySelectorAll(S.pagingNewer)])));
    if (!pager) return null;
    const page = range(pager.querySelector(S.pagingRange));
    if (!page || page.end - page.first + 1 !== rows.length) return null;
    return { main, root, pager, page, keys, older: pager.querySelector(S.pagingOlder), newer: pager.querySelector(S.pagingNewer),
      token: `${route()}:${page.first}:${page.end}` };
  }
  function paused(main) {
    return document.hidden ||
      main.querySelector('tr[role="row"] [role="checkbox"][aria-checked="true"], [gh="tm"] [role="checkbox"]:is([aria-checked="true"], [aria-checked="mixed"])') ||
      [...document.querySelectorAll(`${S.composeForm}, [contenteditable="true"], [role="menu"], [role="dialog"], [role="alertdialog"]`)].some(visible) ||
      document.activeElement?.matches('input, textarea, select, [contenteditable="true"], [role="textbox"], [role="combobox"]');
  }
  function atEdge(root, direction) {
    return direction < 0 ? root.scrollTop <= 2 : root.scrollHeight - root.clientHeight - root.scrollTop <= 2;
  }
  function clearEdge() {
    clearTimeout(edgeIdle); clearTimeout(hintHide);
    edge?.card.remove(); edge = null; lastInput = null;
  }
  function showEdge(now, direction) {
    if (edge?.token === now.token && edge.root === now.root && edge.direction === direction) return edge;
    clearEdge();
    const card = document.createElement("div"), label = document.createElement("span"), button = document.createElement("button"), track = document.createElement("div"), fill = document.createElement("div");
    card.className = "gmail-pro-page-edge"; card.dataset.direction = direction > 0 ? "next" : "previous";
    card.setAttribute("role", "group"); card.setAttribute("aria-label", "Page navigation");
    label.textContent = direction > 0 ? "Keep scrolling down to continue" : "Keep scrolling up to go back";
    button.type = "button"; button.textContent = direction > 0 ? "Next page →" : "← Previous page";
    track.className = "gmail-pro-page-progress"; track.setAttribute("aria-hidden", "true"); track.append(fill);
    card.append(label, button, track); document.body.append(card);
    const box = now.root.getBoundingClientRect(), width = Math.min(320, box.width - 24);
    card.style.width = `${width}px`; card.style.left = `${box.left + (box.width - width) / 2}px`;
    card.style.top = `${direction > 0 ? box.bottom - card.offsetHeight - 12 : box.top + 12}px`;
    const e = edge = { root: now.root, token: now.token, direction, card, fill, started: null, distance: 0 };
    button.addEventListener("click", () => {
      const current = discover();
      if (edge === e && current?.token === e.token && current.root === e.root && !paused(current.main)) requestPage(current, direction);
    });
    return e;
  }
  function idleEdge(e) {
    clearTimeout(edgeIdle); clearTimeout(hintHide);
    // Only input can complete the gesture. A timer never loads a page.
    edgeIdle = setTimeout(() => {
      if (edge !== e) return;
      e.started = null; e.distance = 0; e.fill.style.transform = "scaleX(0)";
    }, RELEASE_MS);
    hintHide = setTimeout(() => {
      if (edge === e && !e.card.contains(document.activeElement)) clearEdge();
    }, 2400);
  }
  function signal(root, direction, pixels = 0) {
    if (pending) return;
    if (!root || !direction) { clearEdge(); return; }
    const now = discover();
    if (!now || root !== now.root || paused(now.main) || !atEdge(root, direction) ||
        !usable(direction > 0 ? now.older : now.newer) || (direction < 0 && now.page.first === 1) ||
        blockedPage === `${now.token}:${direction}`) { clearEdge(); return; }
    const existing = edge?.root === root && edge.token === now.token && edge.direction === direction;
    const e = showEdge(now, direction); idleEdge(e);
    if (!existing || pixels < 3) return; // Arrival and a tiny momentum tail never count.
    const time = performance.now();
    if (e.started === null) e.started = time;
    e.distance += Math.min(pixels, 60);
    const progress = Math.min(1, (time - e.started) / HOLD_MS, e.distance / DISTANCE);
    e.fill.style.transform = `scaleX(${progress})`;
    if (progress === 1) requestPage(now, direction);
  }
  function message(text) {
    notice?.remove(); notice = null;
    if (!text || !document.body) return;
    notice = document.createElement("div"); notice.className = "gmail-pro-page-notice";
    notice.setAttribute("role", "status"); notice.setAttribute("data-gmail-pro-auto-paging", "status");
    notice.textContent = text; document.body.append(notice);
  }
  function cancel() {
    if (pending) { pending.observer.disconnect(); clearTimeout(pending.timeout); }
    pending = null; clearEdge(); cancelAnimationFrame(frame); frame = 0; message(null);
  }
  function schedule() { if (running && !frame) frame = requestAnimationFrame(check); }
  function check() {
    frame = 0;
    const p = pending;
    if (!p) return;
    if (document.hidden || route() !== p.route || ![p.hash, ...p.expectedHashes].includes(location.hash)) return cancel();
    const now = discover();
    // Gmail can shift page boundaries when mail arrives. Reject an entirely
    // stale render, but a shared conversation does not invalidate native paging.
    if (!now || (p.direction > 0 ? now.page.first !== p.end + 1 : now.page.end !== p.first - 1) ||
        now.keys.every(key => p.keys.has(key))) { p.candidate = null; return; }
    if (p.automatic && paused(now.main)) return cancel();
    const signature = JSON.stringify([now.page, now.keys]);
    if (p.candidate !== signature) { p.candidate = signature; schedule(); return; }
    cancel(); blockedPage = null;
    if (p.automatic) now.root.scrollTop = p.direction > 0 ? 0 : now.root.scrollHeight - now.root.clientHeight;
  }
  function watchPage(now, direction, automatic) {
    cancel();
    const hash = location.hash, ordinal = Number(/\/p([1-9]\d*)$/.exec(hash)?.[1] || 1), nextOrdinal = ordinal + direction;
    const expectedHashes = nextOrdinal <= 1 ? [route(), route() + "/p1"] : [route() + `/p${nextOrdinal}`];
    const p = pending = { hash, route: route(), expectedHashes, direction, automatic,
      first: now.page.first, end: now.page.end, keys: new Set(now.keys), candidate: null, observer: new MutationObserver(schedule) };
    message(direction > 0 ? "Loading next page…" : "Loading previous page…");
    // Gmail replaces list ancestors. This coalesced observer exists only for
    // one pending native navigation, with a 15-second deadline and no retries.
    p.observer.observe(document.body, { childList: true, subtree: true, characterData: true,
      attributes: true, attributeFilter: ["aria-disabled", "aria-checked", "data-thread-id"] });
    p.timeout = setTimeout(() => {
      if (pending !== p) return;
      cancel(); blockedPage = `${now.token}:${direction}`;
      message("Page load paused. Use Gmail’s page arrows to try again.");
    }, 15000);
    return p;
  }
  function requestPage(now, direction) {
    const target = direction > 0 ? now.older : now.newer;
    if (pending || !usable(target) || paused(now.main)) return;
    watchPage(now, direction, true);
    const box = target.getBoundingClientRect(); activating = target;
    try {
      // Finish a started native gesture even if Gmail changes history or its
      // disabled state synchronously. An interrupted press can leave controls
      // pressed. Never dispatch a second gesture or replay a user's click.
      for (const type of ["mousedown", "mouseup", "click"]) {
        if (!target.isConnected) break;
        target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true,
          view: window, button: 0, buttons: type === "mousedown" ? 1 : 0, detail: 1,
          clientX: box.left + box.width / 2, clientY: box.top + box.height / 2 }));
      }
    } finally { activating = null; }
    schedule();
  }
  function wheel(event) {
    if (!event.deltaY || event.ctrlKey || event.altKey || event.metaKey) { clearEdge(); return; }
    const root = event.target instanceof Element && event.target.closest(S.pagingList), direction = Math.sign(event.deltaY);
    // Wheel magnitude is normalized, then capped; a single large flick is not a hold.
    const pixels = Math.abs(event.deltaY) * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? root?.clientHeight || 0 : 1);
    signal(root, direction, pixels);
    lastInput = root ? { root, direction, until: performance.now() + RELEASE_MS } : null;
  }
  function scroll(event) {
    if (edge && event.target === edge.root && !atEdge(edge.root, edge.direction)) clearEdge();
    if (lastInput?.root === event.target && performance.now() <= lastInput.until) signal(lastInput.root, lastInput.direction);
  }
  function manualPager(event) {
    if (!(event.target instanceof Element) || activating?.contains(event.target) || !event.target.closest(S.pagingPager)) return false;
    if (event.type === "click") {
      const now = discover(), control = event.target.closest('[role="button"]');
      const direction = control === now?.older ? 1 : control === now?.newer ? -1 : 0;
      if (now && direction && usable(control)) { watchPage(now, direction, false); schedule(); return true; }
    }
    cancel(); blockedPage = null;
    return true; // Native events and aria-disabled state are never modified.
  }
  function pointer(event) {
    if (event.target instanceof Element && event.target.closest('.gmail-pro-page-edge')) return;
    if (!manualPager(event)) cancel();
  }
  function keyboard(event) {
    if (event.target instanceof Element && event.target.closest('.gmail-pro-page-edge')) return;
    if (manualPager(event)) return;
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || (event.shiftKey && event.key !== " ")) { clearEdge(); return; }
    const direction = ["ArrowUp", "PageUp", "Home"].includes(event.key) || (event.key === " " && event.shiftKey) ? -1 :
      ["ArrowDown", "PageDown", "End", " "].includes(event.key) ? 1 : 0;
    const root = event.target instanceof Element && event.target.closest(S.pagingList);
    if (!direction) return cancel();
    signal(root, direction, event.repeat ? 30 : 0);
    lastInput = root ? { root, direction, until: performance.now() + RELEASE_MS } : null;
  }
  function navigation() {
    clearEdge();
    // Gmail can publish popstate before updating the hash. The starting route
    // remains valid while our one request is pending.
    if (pending && [pending.hash, ...pending.expectedHashes].includes(location.hash)) schedule();
    else { cancel(); blockedPage = null; }
  }
  function visibility() { if (document.hidden) cancel(); }
  function stop() {
    cancel(); blockedPage = null;
    for (const [type, fn] of listeners) document.removeEventListener(type, fn, true);
    window.removeEventListener("hashchange", navigation); window.removeEventListener("popstate", navigation);
    window.removeEventListener("resize", cancel); running = false;
  }
  const listeners = [["wheel", wheel], ["scroll", scroll], ["pointerdown", pointer], ["click", manualPager], ["keydown", keyboard], ["visibilitychange", visibility]];
  function update(patch = {}) {
    for (const key of Object.keys(options)) if (Object.hasOwn(patch, key)) options[key] = patch[key];
    if (!options.autoPagingEnabled || !options.appleMailModeEnabled) return stop();
    if (running) return;
    for (const [type, fn] of listeners) document.addEventListener(type, fn, passive);
    window.addEventListener("hashchange", navigation); window.addEventListener("popstate", navigation);
    window.addEventListener("resize", cancel); running = true;
  }
  app.autoPaging = Object.freeze({ start: update, update, stop });
})();
