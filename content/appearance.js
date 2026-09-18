(() => {
  "use strict";
  const app = (globalThis.GmailPro ??= {});
  if (app.appearance) return;

  const marker = "gmail-pro-apple-mail-mode";
  let current = { ...app.settings.defaults };
  let bootstrap;
  let media;
  let listening = false;
  let anchor;
  let handledPointer = false;
  const gestureEvents = ["pointerdown", "mousedown", "click", "contextmenu"];
  // Same fail-closed structure as the CSS row gate. Only discover rendered rows
  // on a user gesture; Gmail's checkbox remains the selection source of truth.
  const rowSelector = '[role="main"] table[role="grid"] > tbody > tr[role="row"]:has(> td > [role="checkbox"]):has(> td[role="gridcell"] [role="link"] [data-thread-id]):has(> td.yX[role="gridcell"]):has(> td.xW[role="gridcell"] > span[title]):not([data-message-id] *)';
  const excluded = 'a, button, input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="button"], [role="checkbox"], [role="switch"], [role="menu"], [role="dialog"], .at';
  const checkbox = row => row.querySelector(':scope > td > [role="checkbox"]');
  const threadId = row => row.querySelector('[role="link"] [data-thread-id]')?.getAttribute("data-thread-id");
  const remember = row => { anchor = { row, thread: threadId(row), route: location.hash }; };
  function selectRow(row, selected) {
    if (!row.isConnected) return;
    const box = checkbox(row);
    if (box && (box.getAttribute("aria-checked") === "true") !== selected) box.click();
  }
  function clearFromBlankArea(event) {
    if (event.type !== "click" || event.shiftKey || event.ctrlKey || event.metaKey) return;
    const pane = event.target.closest('[role="main"] .Nu.tf');
    if (!pane || event.target.closest('[role="contentinfo"], [role="toolbar"], [role="link"], .ii, .a3s, [data-message-id]')) return;
    const rows = [...pane.querySelectorAll(rowSelector)].filter(node => node.getClientRects().length);
    if (!rows.length || event.clientY < Math.max(...rows.map(node => node.getBoundingClientRect().bottom))) return;
    const bounds = pane.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX >= bounds.right || event.clientY >= bounds.bottom) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    rows.forEach(node => selectRow(node, false));
    // Gmail keeps its open preview after clearing checkboxes. Its native
    // back-to-list command clears that preview and its toolbar state together.
    const opened = rows.find(node => node.classList.contains("aps"));
    if (opened) {
      opened.focus({ preventScroll: true });
      for (const type of ["keydown", "keypress", "keyup"]) opened.dispatchEvent(new KeyboardEvent(type, {
        key: "u", code: "KeyU", keyCode: type === "keypress" ? 117 : 85,
        charCode: type === "keypress" ? 117 : 0, which: type === "keypress" ? 117 : 85,
        bubbles: true, cancelable: true
      }));
    }
    anchor = undefined;
  }
  function onRowGesture(event) {
    if (event.type === "pointerdown") handledPointer = false;
    // macOS also emits contextmenu for Control-click. Suppress that companion
    // event without toggling twice; ordinary right-click stays Gmail's.
    const controlMenu = event.type === "contextmenu" && event.ctrlKey;
    if (!current.appleMailModeEnabled || (event.type === "contextmenu" && !controlMenu) || (!controlMenu && event.button !== 0) || event.altKey || !(event.target instanceof Element)) return;
    if (event.target.closest(excluded)) return;
    const row = event.target.closest(rowSelector);
    if (!row) return clearFromBlankArea(event);
    const modified = event.shiftKey || event.ctrlKey || event.metaKey;
    if (!modified) {
      if (event.type === "click") remember(row);
      return; // Ordinary opening, dragging and keyboard navigation stay native.
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    if (event.type === "mousedown" || event.type === "contextmenu") return;
    if (event.type === "click" && handledPointer) { handledPointer = false; return; }
    // Handle the press itself: Mac Control-click may emit contextmenu instead
    // of click. Ignore its eventual click companion to avoid toggling twice.
    if (event.type === "pointerdown") handledPointer = true;
    if (event.shiftKey) {
      const rows = [...row.parentElement.children].filter(candidate => candidate.matches(rowSelector) && candidate.getClientRects().length);
      const validAnchor = anchor?.route === location.hash && rows.includes(anchor.row) && threadId(anchor.row) === anchor.thread;
      const start = validAnchor ? anchor.row : rows.find(candidate => candidate.classList.contains("aps")) || rows.find(candidate => checkbox(candidate).getAttribute("aria-checked") === "true") || row;
      if (!validAnchor) remember(start);
      const first = rows.indexOf(start), last = rows.indexOf(row);
      if (first < 0 || last < 0) return;
      const lower = Math.min(first, last), upper = Math.max(first, last);
      rows.forEach((candidate, index) => {
        const inRange = index >= lower && index <= upper;
        if (inRange || !(event.ctrlKey || event.metaKey)) selectRow(candidate, inRange);
      });
    } else {
      selectRow(row, checkbox(row).getAttribute("aria-checked") !== "true");
      remember(row);
    }
    if (row.isConnected) row.focus({ preventScroll: true });
  }

  // Only Gmail-owned scroll containers; never authored message/editor nodes.
  const scrollSelector = '[role="main"] :is(.Nu, .Nr, .ii:has(> .a3s)), .nH:has(> [role="main"]), .V3:has(.aim)';
  let scrollPositions = new WeakMap();
  const scrolling = new Map();
  const scrollOptions = { capture: true, passive: true };
  function scrollPane(node) {
    return node instanceof Element && node.matches(scrollSelector) && !node.closest('.a3s, [contenteditable], [role="dialog"]');
  }
  function rememberScroll(event) {
    // Capture positions before wheel/keyboard/scrollbar input. No DOM scans.
    for (let node = event.target; node instanceof Element; node = node.parentElement) {
      if (scrollPane(node)) scrollPositions.set(node, { x: node.scrollLeft, y: node.scrollTop });
    }
  }
  function onScroll(event) {
    const node = event.target;
    if (!current.appleMailModeEnabled || !scrollPane(node)) return;
    const previous = scrollPositions.get(node) || { x: 0, y: 0 };
    const next = { x: node.scrollLeft, y: node.scrollTop };
    scrollPositions.set(node, next);
    for (const axis of ['x', 'y']) {
      if (next[axis] === previous[axis]) continue;
      let timers = scrolling.get(node);
      if (!timers) { timers = {}; scrolling.set(node, timers); }
      clearTimeout(timers[axis]);
      node.setAttribute(`data-gp-scroll-${axis}`, '');
      timers[axis] = setTimeout(() => {
        node.removeAttribute(`data-gp-scroll-${axis}`);
        delete timers[axis];
        if (!Object.keys(timers).length) scrolling.delete(node);
      }, 700);
    }
  }
  function clearScrolling() {
    for (const [node, timers] of scrolling) for (const axis of ['x', 'y']) {
      clearTimeout(timers[axis]);
      node.removeAttribute(`data-gp-scroll-${axis}`);
    }
    scrolling.clear();
    scrollPositions = new WeakMap();
  }

  function apply() {
    if (!current.appleMailModeEnabled) return;
    const root = document.documentElement;
    if (!root) return;
    bootstrap?.disconnect();
    bootstrap = undefined;
    root.classList.add(marker);
    root.dataset.gpTheme = current.appearanceTheme === "system"
      ? (media.matches ? "dark" : "light") : current.appearanceTheme;
    root.dataset.gpAccent = current.accentColor;
  }

  function stop() {
    current.appleMailModeEnabled = false;
    bootstrap?.disconnect();
    bootstrap = undefined;
    media?.removeEventListener("change", apply);
    media = undefined;
    for (const type of gestureEvents) document.removeEventListener(type, onRowGesture, true);
    document.removeEventListener("scroll", onScroll, true);
    for (const type of ["wheel", "keydown", "pointerdown"]) document.removeEventListener(type, rememberScroll, true);
    clearScrolling();
    listening = false;
    anchor = undefined;
    handledPointer = false;
    const root = document.documentElement;
    if (!root) return;
    root.classList.remove(marker);
    delete root.dataset.gpTheme;
    delete root.dataset.gpAccent;
  }

  function update(patch = {}) {
    for (const name of ["appleMailModeEnabled", "appearanceTheme", "accentColor"]) {
      if (Object.hasOwn(patch, name)) current[name] = patch[name];
    }
    if (!current.appleMailModeEnabled) return stop();
    if (!listening) {
      for (const type of gestureEvents) document.addEventListener(type, onRowGesture, true);
      document.addEventListener("scroll", onScroll, scrollOptions);
      for (const type of ["wheel", "keydown", "pointerdown"]) document.addEventListener(type, rememberScroll, scrollOptions);
      listening = true;
    }
    // No per-row listeners or ongoing DOM observers. Follow OS changes only
    // while needed; delegated selection handlers are removed on mode OFF.
    if (current.appearanceTheme === "system" && !media) {
      media = matchMedia("(prefers-color-scheme: dark)");
      media.addEventListener("change", apply);
    } else if (current.appearanceTheme !== "system" && media) {
      media.removeEventListener("change", apply);
      media = undefined;
    }
    if (document.documentElement) apply();
    else if (!bootstrap) {
      bootstrap = new MutationObserver(apply);
      bootstrap.observe(document, { childList: true });
    }
  }

  app.appearance = Object.freeze({ start: update, update, stop });
})();
