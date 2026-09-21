(() => {
  "use strict";
  const app = (globalThis.GmailPro ??= {});
  if (app.messageList) return;

  const marker = "gmail-pro-message-list";
  const dateMarker = "data-gmail-pro-date";
  // Same conservative row contract as messageList.css. Never inspect authored mail.
  const excluded = '[data-message-id], .ii, .a3s, [contenteditable], form, [role="dialog"], [role="region"]';
  const gridSelector = 'table[role="grid"]';
  const rowSelector = 'table[role="grid"] > tbody > tr[role="row"]:has(> td > [role="checkbox"]):has(> td[role="gridcell"] [role="link"] [data-thread-id]):has(> td.yX[role="gridcell"]):has(> td.xW[role="gridcell"] > span[title])';
  const months = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ");
  const weekdays = "Sun Mon Tue Wed Thu Fri Sat".split(" ");
  const mains = new Set();
  const grids = new Map();
  const dates = new Map();
  let standalone = false, appleMail = false, running = false;
  let bootstrap, discovery, spines, midnight;

  function format(title, now) {
    const parts = /^(\w{3}), (\w{3}) (\d{1,2}), (\d{4}), (\d{1,2}):(\d{2}) (AM|PM)$/.exec(title.replace(/\s+/g, " ").trim());
    if (!parts) return null;
    const [, weekday, monthName, dayText, yearText, hourText, minuteText, period] = parts;
    const month = months.indexOf(monthName), day = Number(dayText), year = Number(yearText);
    const hour = Number(hourText), minute = Number(minuteText);
    if (month < 0 || year < 1000 || hour < 1 || hour > 12 || minute > 59) return null;
    // Validate civil dates in UTC so a local DST gap cannot normalize the input.
    const civil = new Date(Date.UTC(year, month, day));
    if (civil.getUTCFullYear() !== year || civil.getUTCMonth() !== month || civil.getUTCDate() !== day || weekdays[civil.getUTCDay()] !== weekday) return null;
    const time = `${hour}:${minuteText} ${period}`;
    const matches = date => year === date.getFullYear() && month === date.getMonth() && day === date.getDate();
    if (matches(now)) return `Today, ${time}`;
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 12);
    if (matches(yesterday)) return `Yesterday, ${time}`;
    return `${weekday}, ${month + 1}/${day}/${yearText.slice(-2)}, ${time}`;
  }

  function restore(row) {
    const state = dates.get(row);
    if (state && state.span.getAttribute(dateMarker) === state.text) state.span.removeAttribute(dateMarker);
    dates.delete(row);
  }

  function formatRow(row, now = new Date()) {
    const valid = row.isConnected && row.closest('[role="main"]') && !row.closest(excluded) && row.matches(rowSelector);
    const span = valid && row.querySelector(':scope > td.xW[role="gridcell"] > span[title]');
    // Gmail's outer span owns the tooltip/accessible name; its single inner span
    // owns native display text. Unknown variants remain entirely native.
    const known = span && span.children.length === 1 && span.firstElementChild.tagName === "SPAN" &&
      [...span.childNodes].every(node => node.nodeType !== Node.TEXT_NODE || !node.textContent.trim());
    const text = known ? format(span.getAttribute("title"), now) : null;
    if (dates.get(row)?.span !== span || !text) restore(row);
    if (!text) return;
    if (span.getAttribute(dateMarker) !== text) span.setAttribute(dateMarker, text);
    dates.set(row, { span, text });
  }

  function collectRows(root, rows) {
    if (!(root instanceof Element) || root.closest(excluded)) return;
    const row = root.closest("tr");
    if (row) rows.add(row);
    else for (const candidate of root.querySelectorAll("tr")) rows.add(candidate);
  }

  function observeMains() {
    discovery.disconnect();
    for (const main of mains) discovery.observe(main, { childList: true, subtree: true, attributes: true, attributeFilter: ["role"] });
  }

  function prune() {
    for (const [grid, observer] of grids) if (!grid.isConnected || !grid.matches(gridSelector) || !grid.closest('[role="main"]') || grid.closest(excluded)) {
      observer.disconnect(); grids.delete(grid);
    }
    for (const [row, state] of dates) if (!state.span.isConnected || !grids.has(row.closest(gridSelector))) restore(row);
    let changed = false;
    for (const main of mains) if (!main.isConnected || !main.matches('[role="main"]')) { mains.delete(main); changed = true; }
    if (changed) observeMains(); // Do not retain detached Gmail pages through an observer.
  }

  function register(grid) {
    if (grids.has(grid) || !grid.closest('[role="main"]') || grid.closest(excluded)) return;
    const observer = new MutationObserver(records => {
      if (!running) return;
      const rows = new Set();
      let removed = false;
      for (const record of records) {
        // Cell classes can arrive late; read/unread/selection class changes on
        // rows are CSS-only and must not trigger timestamp work.
        if (record.attributeName === "class" && record.target.tagName !== "TD") continue;
        if (record.removedNodes.length) removed = true;
        const row = record.target instanceof Element && record.target.closest("tr");
        if (row) rows.add(row);
        else if (record.type === "attributes") collectRows(record.target, rows);
        for (const node of record.addedNodes) collectRows(node, rows);
      }
      if (!rows.size && !removed) return;
      prune();
      const now = new Date();
      for (const row of rows) formatRow(row, now);
    });
    grids.set(grid, observer);
    observer.observe(grid, { subtree: true, childList: true, attributes: true,
      attributeFilter: ["title", "role", "data-thread-id", "class"] });
    const now = new Date();
    for (const row of grid.querySelectorAll("tr")) formatRow(row, now);
  }

  function scan(root) {
    if (!(root instanceof Element) || !root.isConnected || root.closest(excluded)) return;
    const found = root.matches('[role="main"]') ? [root] : root.querySelectorAll('[role="main"]');
    for (const main of found) if (!main.closest(excluded) && !mains.has(main)) {
      mains.add(main);
      discovery.observe(main, { childList: true, subtree: true, attributes: true, attributeFilter: ["role"] });
    }
    if (root.matches(gridSelector)) register(root);
    for (const grid of root.querySelectorAll(gridSelector)) register(grid);
  }

  function watchSpines() {
    spines.disconnect();
    const watched = new Set();
    for (const main of mains) for (let node = main.parentElement; node && !watched.has(node); node = node.parentElement) {
      watched.add(node); spines.observe(node, { childList: true });
    }
    // Before Gmail mounts its main region, observe additions until one appears.
    if (!mains.size) spines.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["role"] });
  }

  function discover(records) {
    if (!running) return;
    const roots = new Set();
    let removed = false;
    for (const record of records) {
      if (record.target instanceof Element && (record.target.closest(excluded) || grids.has(record.target.closest(gridSelector)))) continue;
      if (record.removedNodes.length) removed = true;
      if (record.type === "attributes") roots.add(record.target);
      for (const node of record.addedNodes) if (node instanceof Element) roots.add(node);
    }
    if (removed || roots.size) prune();
    for (const root of roots) {
      let parent = root.parentElement;
      while (parent && !roots.has(parent)) parent = parent.parentElement;
      if (!parent) scan(root);
    }
    if (removed || roots.size) watchSpines();
  }

  function scheduleMidnight() {
    clearTimeout(midnight);
    if (!running || document.hidden) return;
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    midnight = setTimeout(refresh, next.getTime() - now.getTime() + 50);
  }

  function refresh() {
    if (!running) return;
    prune();
    const now = new Date();
    for (const grid of grids.keys()) for (const row of grid.querySelectorAll("tr")) formatRow(row, now);
    scheduleMidnight();
  }

  function navigation() {
    if (!running) return;
    prune();
    for (const main of document.querySelectorAll('[role="main"]')) scan(main);
    watchSpines();
    refresh();
  }

  function apply() {
    if (!document.documentElement || !(standalone || appleMail)) return;
    bootstrap?.disconnect(); bootstrap = undefined;
    document.documentElement.classList.toggle(marker, standalone);
    if (running) return;
    running = true;
    discovery = new MutationObserver(discover);
    spines = new MutationObserver(discover);
    window.addEventListener("hashchange", navigation);
    window.addEventListener("popstate", navigation);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    navigation();
  }

  function stop() {
    standalone = false; appleMail = false; running = false;
    bootstrap?.disconnect(); bootstrap = undefined;
    discovery?.disconnect(); spines?.disconnect();
    discovery = undefined; spines = undefined;
    for (const observer of grids.values()) observer.disconnect();
    grids.clear(); mains.clear();
    for (const row of dates.keys()) restore(row);
    clearTimeout(midnight); midnight = undefined;
    window.removeEventListener("hashchange", navigation);
    window.removeEventListener("popstate", navigation);
    window.removeEventListener("focus", refresh);
    document.removeEventListener("visibilitychange", refresh);
    document.documentElement?.classList.remove(marker);
  }

  function update(patch = {}) {
    if (!Object.hasOwn(patch, "appleMailMessageListEnabled") && !Object.hasOwn(patch, "appleMailModeEnabled")) return;
    if (Object.hasOwn(patch, "appleMailMessageListEnabled")) standalone = !!patch.appleMailMessageListEnabled;
    if (Object.hasOwn(patch, "appleMailModeEnabled")) appleMail = !!patch.appleMailModeEnabled;
    if (!(standalone || appleMail)) return stop();
    if (document.documentElement) apply();
    else if (!bootstrap) {
      bootstrap = new MutationObserver(apply);
      bootstrap.observe(document, { childList: true });
    }
  }

  app.messageList = Object.freeze({ start: update, update, stop });
})();
