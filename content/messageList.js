(() => {
  "use strict";
  const app = (globalThis.GmailPro ??= {});
  if (app.messageList) return;

  const marker = "gmail-pro-message-list";
  const dateMarker = "data-gmail-pro-date";
  const rowMarker = "data-gp-message-row";
  // Validate once per changed row; both stylesheets reuse our owned marker.
  // Never inspect authored mail.
  const excluded = '[data-message-id], .ii, .a3s, [contenteditable], form, [role="dialog"], [role="region"]';
  const badgeSelector = '.yi > .at[title], .yi > .ar > .at[title]';
  const gridSelector = 'table[role="grid"]';
  const rowSelector = 'table[role="grid"] > tbody > tr[role="row"]:has(> td > [role="checkbox"]):has(> td[role="gridcell"] [role="link"] [data-thread-id]):has(> td.yX[role="gridcell"]):has(> td.xW[role="gridcell"] > span[title])';
  const months = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ");
  const weekdays = "Sun Mon Tue Wed Thu Fri Sat".split(" ");
  const mains = new Set();
  const grids = new Map();
  const rows = new Map();
  const filingBadges = new Map();
  const labelRoots = new Set();
  const S = app.selectors;
  let standalone = false, appleMail = false, running = false;
  let bootstrap, discovery, spines, midnight;

  // Floating drafts add ?compose=... without changing the Inbox mailbox.
  // The filing controller still guards the full hash for in-flight cancellation.
  const inboxRoute = () => /^#inbox(?:\/p[1-9]\d*)?$/.test(location.hash.split('?')[0]);
  const visible = node => !!node?.isConnected && node.checkVisibility({ visibilityProperty: true }) &&
    !node.closest('[hidden], [aria-hidden="true"], [inert]');

  // Read native custom-label metadata afresh; this is not a label cache. Full
  // tooltip names must agree with the current account's sidebar route and menu.
  function customLabelNames() {
    const names = new Set();
    if (!appleMail || !S) return names;
    for (const node of document.querySelectorAll(`[role="navigation"] ${S.labelContainer} ${S.labelRow}`)) {
      if (node.closest(excluded)) continue;
      const links = node.querySelectorAll(S.labelLink), menu = node.querySelector(S.labelMenu);
      if (links.length !== 1 || !menu) continue;
      try {
        const url = new URL(links[0].getAttribute("href"), location.href);
        if (url.origin !== location.origin || url.pathname !== location.pathname || !url.hash.startsWith("#label/")) continue;
        const name = decodeURIComponent(url.hash.slice(7).replace(/\+/g, " "));
        if (name && menu.getAttribute("data-label-name") === name) names.add(name);
      } catch { /* Unknown or malformed routes remain native. */ }
    }
    return names;
  }

  function badgeInRow(badge, row, names) {
    return badge?.matches(badgeSelector) && badge.closest('tr') === row &&
      badge.closest('[role="link"]')?.querySelector('[data-thread-id][data-legacy-thread-id]') &&
      badge.querySelector(':scope > .au > .av') && !badge.querySelector('a, button, input, [role="button"], [role="link"], [contenteditable]') &&
      names.has(badge.getAttribute("title"));
  }

  function restoreBadge(badge) {
    const state = filingBadges.get(badge);
    if (!state) return;
    for (const [name, { before, after }] of state.attributes) if (badge.getAttribute(name) === after) {
      if (before === null) badge.removeAttribute(name); else badge.setAttribute(name, before);
    }
    filingBadges.delete(badge);
  }

  function decorateBadges(row, names, supported = supportedRow(row)) {
    const valid = appleMail && inboxRoute() && supported;
    const badges = valid ? [...row.querySelectorAll(badgeSelector)].filter(badge => badgeInRow(badge, row, names)) : [];
    for (const [badge, state] of filingBadges) if (state.row === row && !badges.includes(badge)) restoreBadge(badge);
    for (const badge of badges) {
      let state = filingBadges.get(badge);
      if (!state) { state = { row, attributes: new Map() }; filingBadges.set(badge, state); }
      const attributes = { "data-gp-file-label": "", role: "button", tabindex: "0",
        "aria-label": `Mark conversation as read and file under ${badge.getAttribute("title")}` };
      for (const [name, after] of Object.entries(attributes)) {
        const previous = state.attributes.get(name);
        // Do not overwrite a native/third-party change to an attribute we owned.
        if (previous && badge.getAttribute(name) !== previous.after) continue;
        state.attributes.set(name, { before: previous ? previous.before : badge.getAttribute(name), after });
        if (badge.getAttribute(name) !== after) badge.setAttribute(name, after);
      }
    }
  }

  function refreshBadges() {
    const names = customLabelNames();
    for (const grid of grids.keys()) for (const row of grid.querySelectorAll('tr')) decorateBadges(row, names);
  }

  function filingTarget(target) {
    if (!appleMail || !inboxRoute() || !(target instanceof Element) || target.closest(excluded)) return null;
    const badge = target.closest(badgeSelector), row = badge?.closest(rowSelector);
    if (!row || !visible(row) || !visible(badge) || !badgeInRow(badge, row, customLabelNames())) return null;
    const identity = row.querySelector('[role="link"] [data-thread-id][data-legacy-thread-id]');
    const box = row.querySelector(':scope > td > [role="checkbox"]');
    if (!identity || !box || box.matches('[disabled], [aria-disabled="true"]')) return null;
    return { badge, row, box, label: badge.getAttribute("title"), grid: row.closest(gridSelector), main: row.closest(S.main) };
  }

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

  function supportedRow(row) {
    return row.isConnected && row.closest('[role="main"]') && !row.closest(excluded) && row.matches(rowSelector);
  }

  function restoreDate(state) {
    if (state.span && state.span.getAttribute(dateMarker) === state.text) {
      if (state.dateBefore === null) state.span.removeAttribute(dateMarker);
      else state.span.setAttribute(dateMarker, state.dateBefore);
    }
    state.span = undefined; state.text = undefined;
  }

  function restore(row) {
    const state = rows.get(row);
    if (!state) {
      // Gmail may clone an already marked row before removing required metadata.
      if (row.getAttribute(rowMarker) === "") {
        row.removeAttribute(rowMarker);
        row.querySelector(':scope > td.xW[role="gridcell"] > span')?.removeAttribute(dateMarker);
      }
      return;
    }
    restoreDate(state);
    if (row.getAttribute(rowMarker) === "") {
      if (state.before === null) row.removeAttribute(rowMarker);
      else row.setAttribute(rowMarker, state.before);
    }
    rows.delete(row);
  }

  function formatRow(row, now = new Date(), names = customLabelNames()) {
    const valid = supportedRow(row);
    decorateBadges(row, names, valid);
    if (!valid) { restore(row); return; }
    let state = rows.get(row);
    const span = row.querySelector(':scope > td.xW[role="gridcell"] > span[title]');
    if (!state) {
      const before = row.getAttribute(rowMarker);
      // Empty is our reserved marker value. Clones inherit presentation, not
      // ownership; adopt it so invalidation/stop cannot restore a stale gate.
      state = { before: before === "" ? null : before };
      if (before === "") span.removeAttribute(dateMarker);
      rows.set(row, state);
    }
    if (row.getAttribute(rowMarker) !== "") row.setAttribute(rowMarker, "");
    // Gmail's outer span owns the tooltip/accessible name; its single inner span
    // owns native display text. Unknown date variants retain native text while
    // the independently validated row still receives the two-line layout.
    const known = span.children.length === 1 && span.firstElementChild.tagName === "SPAN" &&
      [...span.childNodes].every(node => node.nodeType !== Node.TEXT_NODE || !node.textContent.trim());
    const text = known ? format(span.getAttribute("title"), now) : null;
    if (state.span !== span || !text) restoreDate(state);
    if (!text) return;
    if (!state.span) state.dateBefore = span.getAttribute(dateMarker);
    if (span.getAttribute(dateMarker) !== text) span.setAttribute(dateMarker, text);
    state.span = span; state.text = text;
  }

  // Ignore native unread/open/selection classes, but reconcile boundaries when
  // Gmail reuses a wrapper as a message body or editor (including removal).
  function relevantAttribute(record) {
    if (record.attributeName !== "class" || record.target.tagName === "TD") return true;
    const boundary = value => /(?:^|\s)(?:ii|a3s)(?:\s|$)/.test(value || "");
    return boundary(record.oldValue) !== boundary(record.target.getAttribute("class"));
  }

  const discoveryAttributes = ["role", "contenteditable", "data-message-id", "class"];

  function collectRows(root, rows) {
    if (!(root instanceof Element)) return;
    const row = root.closest("tr");
    if (row) rows.add(row);
    else for (const candidate of root.querySelectorAll("tr")) rows.add(candidate);
  }

  function observeMains() {
    discovery.disconnect();
    for (const main of mains) discovery.observe(main, { childList: true, subtree: true, attributes: true, attributeFilter: discoveryAttributes, attributeOldValue: true });
    for (const root of labelRoots) discovery.observe(root, { childList: true, subtree: true, attributes: true,
      attributeFilter: ["href", "data-label-name"] });
  }

  function prune() {
    for (const [grid, observer] of grids) if (!grid.isConnected || !grid.matches(gridSelector) || !grid.closest('[role="main"]') || grid.closest(excluded)) {
      observer.disconnect(); grids.delete(grid);
    }
    for (const row of rows.keys()) if (!row.isConnected || row.closest(excluded) || !grids.has(row.closest(gridSelector))) restore(row);
    for (const [badge, state] of filingBadges) if (!badge.isConnected || badge.closest("tr") !== state.row || !grids.has(state.row.closest(gridSelector))) restoreBadge(badge);
    let changed = false;
    for (const root of labelRoots) if (!root.isConnected) { labelRoots.delete(root); changed = true; }
    for (const main of mains) if (!main.isConnected || !main.matches('[role="main"]')) { mains.delete(main); changed = true; }
    if (changed) observeMains(); // Do not retain detached Gmail pages through an observer.
  }

  function register(grid) {
    if (grids.has(grid) || !grid.closest('[role="main"]') || grid.closest(excluded)) return;
    const observer = new MutationObserver(records => {
      if (!running) return;
      const dirtyRows = new Set();
      let removed = false;
      for (const record of records) {
        // Cell classes can arrive late; read/unread/selection class changes on
        // rows are CSS-only and must not trigger timestamp work.
        if (record.type === "attributes" && !relevantAttribute(record)) continue;
        if (record.removedNodes.length) removed = true;
        const row = record.target instanceof Element && record.target.closest("tr");
        if (row) dirtyRows.add(row);
        else if (record.type === "attributes") collectRows(record.target, dirtyRows);
        for (const node of record.addedNodes) collectRows(node, dirtyRows);
      }
      if (!dirtyRows.size && !removed) return;
      prune();
      const now = new Date(), names = customLabelNames();
      for (const row of dirtyRows) formatRow(row, now, names);
    });
    grids.set(grid, observer);
    observer.observe(grid, { subtree: true, childList: true, attributes: true,
      attributeOldValue: true, attributeFilter: ["title", "role", "data-thread-id", "data-legacy-thread-id", "class", "contenteditable", "data-message-id"] });
    const now = new Date(), names = customLabelNames();
    for (const row of grid.querySelectorAll("tr")) formatRow(row, now, names);
  }

  function scan(root) {
    if (!(root instanceof Element) || !root.isConnected || root.closest(excluded)) return;
    const found = root.matches('[role="main"]') ? [root] : root.querySelectorAll('[role="main"]');
    for (const main of found) if (!main.closest(excluded) && !mains.has(main)) {
      mains.add(main);
      discovery.observe(main, { childList: true, subtree: true, attributes: true, attributeFilter: discoveryAttributes, attributeOldValue: true });
    }
    if (S && appleMail) for (const labels of root.matches('[role="navigation"]') ? [root] : root.querySelectorAll('[role="navigation"]')) if (!labelRoots.has(labels)) {
      labelRoots.add(labels);
      discovery.observe(labels, { childList: true, subtree: true, attributes: true, attributeFilter: ["href", "data-label-name"] });
    }
    if (root.matches(gridSelector)) register(root);
    for (const grid of root.querySelectorAll(gridSelector)) register(grid);
  }

  function watchSpines() {
    spines.disconnect();
    const watched = new Set();
    for (const owner of [...mains, ...labelRoots]) for (let node = owner.parentElement; node && !watched.has(node); node = node.parentElement) {
      watched.add(node); spines.observe(node, { childList: true, attributes: true, attributeFilter: discoveryAttributes, attributeOldValue: true });
    }
    // Before Gmail mounts its main region, observe additions until one appears.
    if (!mains.size) spines.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: discoveryAttributes, attributeOldValue: true });
  }

  function discover(records) {
    if (!running) return;
    const roots = new Set();
    let removed = false, labelsChanged = false;
    for (const record of records) {
      if (record.type === "attributes" && !relevantAttribute(record)) continue;
      if (S && record.target instanceof Element && record.target.closest('[role="navigation"]') && !record.target.closest(excluded)) labelsChanged = true;
      if (record.target instanceof Element && grids.has(record.target.closest(gridSelector))) continue;
      if (record.type !== "attributes" && record.target instanceof Element && record.target.closest(excluded)) continue;
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
    // Gmail can reveal a pre-existing main after startup gating has changed.
    // Recover through the same scan while none is registered, without polling.
    if (!mains.size) for (const main of document.querySelectorAll('[role="main"]')) scan(main);
    if (removed || roots.size) watchSpines();
    if (labelsChanged) refreshBadges();
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
    const now = new Date(), names = customLabelNames();
    for (const grid of grids.keys()) for (const row of grid.querySelectorAll("tr")) formatRow(row, now, names);
    scheduleMidnight();
  }

  function navigation() {
    if (!running) return;
    prune();
    for (const main of document.querySelectorAll('[role="main"]')) scan(main);
    if (S && appleMail) for (const navigation of document.querySelectorAll('[role="navigation"]')) scan(navigation);
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
    grids.clear(); mains.clear(); labelRoots.clear();
    for (const badge of filingBadges.keys()) restoreBadge(badge);
    for (const row of rows.keys()) restore(row);
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
    if (document.documentElement) {
      const wasRunning = running;
      apply();
      if (wasRunning) {
        if (!appleMail && labelRoots.size) { labelRoots.clear(); observeMains(); }
        navigation();
      }
    }
    else if (!bootstrap) {
      bootstrap = new MutationObserver(apply);
      bootstrap.observe(document, { childList: true });
    }
  }

  app.messageList = Object.freeze({ start: update, update, stop, filingTarget });
})();
