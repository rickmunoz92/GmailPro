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
  function onRowGesture(event) {
    if (event.type === "pointerdown") handledPointer = false;
    // macOS also emits contextmenu for Control-click. Suppress that companion
    // event without toggling twice; ordinary right-click stays Gmail's.
    const controlMenu = event.type === "contextmenu" && event.ctrlKey;
    if (!current.appleMailModeEnabled || (event.type === "contextmenu" && !controlMenu) || (!controlMenu && event.button !== 0) || event.altKey || !(event.target instanceof Element)) return;
    if (event.target.closest(excluded)) return;
    const row = event.target.closest(rowSelector);
    if (!row) return;
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
