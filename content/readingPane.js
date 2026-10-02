(() => {
  "use strict";
  const app = (globalThis.GmailPro ??= {});
  if (app.readingPane) return;
  const S = app.selectors;
  const definitions = [
    ["replyAll", "Reply all", S.nativeReplyAll, "M10 6 4 12l6 6M16 6l-6 6 6 6M10 12h5c4 0 6 3 6 7"],
    ["reply", "Reply", S.nativeReply, "m10 6-6 6 6 6M4 12h9c4 0 7 3 7 7"],
    ["forward", "Forward", S.nativeForward, "m14 6 6 6-6 6M20 12h-9c-4 0-7 3-7 7"],
    ["reaction", "Add reaction", S.nativeReaction, "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM8 14c2 3 6 3 8 0M8 9h.01M16 9h.01"]
  ];
  let enabled = false, unsubscribe, observer, group, markedShell;
  let queued = false;
  let observedContext;
  let pendingRead, readVisit, restoringUnread = false;
  let pendingFiling, filingGesture = false, heldFilingKey;
  let filingNotice, filingNoticeTimer, filingNoticeContext, filingNoticeFrame, filingNoticeResize;
  const filingPointerEvents = ["pointerdown", "mousedown", "mouseup", "click"];
  const filingKeyEvents = ["keydown", "keypress", "keyup"];
  let nativeNoticeObserver, nativeNoticeTimer;
  const readRetryDelay = 250;
  const readTimeout = 10000;
  const readExcluded = 'a, button, input, textarea, select, [contenteditable], [role="button"], [role="checkbox"], [role="menu"], [role="dialog"], .at';
  const markedFooters = new Set();
  const recipientLabels = new Map();
  const visible = node => !!node?.isConnected && node.checkVisibility({ visibilityProperty: true }) && !node.closest('[hidden], [aria-hidden="true"], [inert]');
  const usable = node => node && !node.matches('[disabled], [aria-disabled="true"]');
  const ownsChrome = node => !node.closest(S.readingExcluded);

  function nativeGesture(target, guard = () => true) {
    const bounds = target.getBoundingClientRect();
    // Gmail controls need pressed state; a bare .click() can be ignored.
    for (const type of ["mousedown", "mouseup", "click"]) {
      if (!guard() || !visible(target) || !usable(target)) return false;
      target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true,
        view: window, button: 0, buttons: type === "mousedown" ? 1 : 0, detail: 1,
        clientX: bounds.left + bounds.width / 2, clientY: bounds.top + bounds.height / 2 }));
    }
    return true;
  }

  function stopNativeNoticeWatch() {
    nativeNoticeObserver?.disconnect(); nativeNoticeObserver = undefined;
    clearTimeout(nativeNoticeTimer); nativeNoticeTimer = undefined;
  }

  function quietReadNotice() {
    stopNativeNoticeWatch();
    // Observe only Gmail's small native notification region while awaiting
    // this action's confirmation. Never hide the shared alert/Undo container.
    const roots = [...document.querySelectorAll(S.nativeNotice)].filter(ownsChrome);
    if (!roots.length) return;
    nativeNoticeObserver = new MutationObserver(() => {
      for (const root of roots) {
        for (const message of root.querySelectorAll(S.nativeNoticeMessage)) {
          if (message.textContent.trim() !== "Conversation marked as read.") continue;
          const close = message.closest('.vh').querySelector(':scope > .bBe[role="button"][aria-label="Close"]');
          if (!visible(close) || !usable(close)) continue;
          // Disconnect before Gmail dismisses/reuses the node. Archive,
          // delete, errors, and third-party notices retain their native UI.
          stopNativeNoticeWatch();
          nativeGesture(close);
          return;
        }
      }
    });
    for (const root of roots) nativeNoticeObserver.observe(root, {
      childList: true, subtree: true, characterData: true, attributes: true,
      attributeFilter: ["class", "style", "role", "aria-label", "hidden", "aria-hidden", "aria-disabled"]
    });
    nativeNoticeTimer = setTimeout(stopNativeNoticeWatch, 5000);
  }

  function cancelRead() {
    if (!pendingRead) return;
    clearTimeout(pendingRead.timer);
    clearTimeout(pendingRead.expiry);
    pendingRead = undefined;
    schedule(); // Release temporary row/table observation even without a DOM change.
  }

  function readIdentity(row) {
    return row.querySelector('[role="link"] [data-thread-id][data-legacy-thread-id]');
  }

  function clearFilingNotice() {
    clearTimeout(filingNoticeTimer); filingNoticeTimer = undefined;
    cancelAnimationFrame(filingNoticeFrame); filingNoticeFrame = undefined;
    filingNoticeResize?.disconnect(); filingNoticeResize = undefined;
    window.removeEventListener("resize", scheduleFilingNotice);
    document.removeEventListener("scroll", scheduleFilingNotice, true);
    filingNotice?.remove(); filingNotice = undefined; filingNoticeContext = undefined;
  }

  function positionFilingNotice() {
    const current = filingNoticeContext;
    if (!current) return;
    if (!enabled || location.hash !== current.route || location.pathname !== current.page ||
        !visible(current.main) || !visible(current.list) || current.list.closest(S.main) !== current.main) return clearFilingNotice();
    const bounds = current.list.getBoundingClientRect(), width = Math.min(400, bounds.width - 24);
    if (width <= 0) return clearFilingNotice();
    // Fixed to the list's viewport, never its scrolling conversation content.
    for (const [property, value] of Object.entries({ left: `${bounds.left + bounds.width / 2}px`, top: `${bounds.top + 12}px`, width: `${width}px` })) {
      if (filingNotice.style[property] !== value) filingNotice.style[property] = value;
    }
  }

  function scheduleFilingNotice() {
    if (!filingNoticeContext || filingNoticeFrame !== undefined) return;
    filingNoticeFrame = requestAnimationFrame(() => { filingNoticeFrame = undefined; positionFilingNotice(); });
  }

  function filingFeedback(message, success) {
    clearFilingNotice();
    if (!enabled || !message) return;
    const list = success?.grid.closest(S.pagingList);
    if (success && (!list || !filingHealthy(success))) return;
    const node = document.createElement("div"), text = document.createElement("span");
    node.className = "gmail-pro-filing-notice";
    text.setAttribute("role", "status"); text.setAttribute("aria-live", "polite"); text.setAttribute("aria-atomic", "true");
    text.textContent = message;
    if (success) {
      node.dataset.gpFilingSuccess = "";
      const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      icon.setAttribute("viewBox", "0 0 24 24"); icon.setAttribute("aria-hidden", "true");
      const circle = document.createElementNS(icon.namespaceURI, "circle"), check = document.createElementNS(icon.namespaceURI, "path");
      circle.setAttribute("cx", "12"); circle.setAttribute("cy", "12"); circle.setAttribute("r", "9");
      check.setAttribute("d", "m8 12 3 3 5-6"); icon.append(circle, check); node.append(icon);
      filingNoticeContext = { list, main: success.main, route: success.route, page: success.page };
    } else {
      const dismiss = document.createElement("button");
      dismiss.type = "button"; dismiss.textContent = "Dismiss"; dismiss.addEventListener("click", clearFilingNotice);
      node.append(dismiss);
    }
    node.insertBefore(text, success ? null : node.firstChild); document.body.append(node); filingNotice = node;
    if (success) {
      positionFilingNotice();
      if (!filingNoticeContext) return;
      filingNoticeResize = new ResizeObserver(scheduleFilingNotice); filingNoticeResize.observe(list);
      window.addEventListener("resize", scheduleFilingNotice);
      document.addEventListener("scroll", scheduleFilingNotice, { capture: true, passive: true });
    }
    filingNoticeTimer = setTimeout(clearFilingNotice, success ? 1500 : 6000);
  }

  function watchArchiveNotice(pending) {
    stopNativeNoticeWatch();
    const roots = [...document.querySelectorAll(S.nativeNotice)].filter(ownsChrome);
    if (!roots.length) return;
    nativeNoticeObserver = new MutationObserver(records => {
      if (pendingFiling !== pending || !pending.archiveSubmitted || !filingHealthy(pending)) return;
      for (const root of roots) for (const message of root.querySelectorAll(S.nativeNoticeMessage)) {
        if (!visible(message) || message.textContent.trim() !== "Conversation archived.") continue;
        // An already-visible acknowledgement from a previous action is not
        // confirmation. Only new content inside this native message qualifies.
        const fresh = records.some(record =>
          (record.type === "characterData" && message.contains(record.target)) ||
          (record.type === "childList" && (message.contains(record.target) ||
            [...record.addedNodes].some(node => node === message || node.contains?.(message)))));
        if (!fresh) continue;
        pending.archiveAcknowledged = true;
        stopNativeNoticeWatch(); schedule(); return;
      }
    });
    for (const root of roots) nativeNoticeObserver.observe(root, { childList: true, subtree: true, characterData: true });
  }

  function filingNative(target, checkbox = false, guard) {
    filingGesture = true;
    try {
      // Apple Mail Mode hides native checkboxes. Gmail's existing selection
      // bridge uses .click() on them; toolbar actions require all mouse phases.
      if (checkbox) { target.click(); return true; }
      return nativeGesture(target, guard);
    } finally { filingGesture = false; }
  }

  function checkedBoxes(main) {
    return [...main.querySelectorAll('table[role="grid"] [role="checkbox"]:is([aria-checked="true"], [aria-checked="mixed"])')]
      .filter(ownsChrome);
  }

  function filingRow(pending) {
    const matches = [...pending.grid.querySelectorAll('tr[role="row"]')].filter(row => {
      const id = readIdentity(row);
      return id?.getAttribute("data-thread-id") === pending.thread && id.getAttribute("data-legacy-thread-id") === pending.legacy && ownsChrome(row);
    });
    return matches.length === 1 ? matches[0] : null;
  }

  function filingHealthy(pending) {
    return enabled && !document.hidden && location.hash === pending.route && location.pathname === pending.page && visible(pending.main) &&
      visible(pending.grid) && pending.grid.closest(S.main) === pending.main;
  }

  function filingActionValid(pending) {
    if (pendingFiling !== pending || !filingHealthy(pending)) return false;
    const row = filingRow(pending), box = row?.querySelector(':scope > td > [role="checkbox"]');
    const checked = checkedBoxes(pending.main);
    if (!visible(row) || !box || checked.length !== 1 || checked[0] !== box || box.getAttribute("aria-checked") !== "true") return false;
    if (pending.phase === "archiving" && (row.classList.contains("zE") || !row.classList.contains("yO"))) return false;
    return [...row.querySelectorAll('.yi .at[title]')].some(badge =>
      badge.getAttribute("title") === pending.label && app.messageList?.filingTarget(badge)?.row === row);
  }

  function finishFiling(message = "", release = true) {
    const pending = pendingFiling;
    if (!pending) return;
    pendingFiling = undefined;
    clearTimeout(pending.timer); clearTimeout(pending.expiry);
    stopNativeNoticeWatch();
    // Relinquish only the selection introduced by this operation, while its
    // original context and sole target still agree. Never clear a user's bulk selection.
    const row = release && pending.selectionOwned && filingHealthy(pending) ? filingRow(pending) : null;
    const box = row?.querySelector(':scope > td > [role="checkbox"]'), checked = row && checkedBoxes(pending.main);
    if (box && checked.length === 1 && checked[0] === box && box.getAttribute("aria-checked") === "true" && usable(box)) filingNative(box, true);
    if (message) filingFeedback(message);
    schedule();
  }

  function filingFailure(pending) {
    if (pending.archiveSubmitted && !filingRow(pending)) return "Gmail hasn’t confirmed this move. Check the folder before trying again.";
    return pending.readConfirmed ? "Marked read, but couldn’t file. Try again." :
      "Couldn’t mark this conversation read, so it wasn’t filed. Try again.";
  }

  function nativeToolbarAction(main, selector) {
    const toolbars = [...main.querySelectorAll(S.primaryToolbar)].filter(visible);
    const actions = toolbars.length === 1 ? [...toolbars[0].querySelectorAll(selector)]
      .filter(node => visible(node) && usable(node) && ownsChrome(node)) : [];
    return actions.length === 1 ? actions[0] : null;
  }

  function waitForFiling(pending) {
    if (pending.timer !== undefined) return;
    pending.timer = setTimeout(() => { pending.timer = undefined; if (pendingFiling === pending) schedule(); }, readRetryDelay);
  }

  function watchFiling(pending) {
    observer.observe(pending.grid, { childList: true, subtree: true, attributes: true, attributeOldValue: true,
      attributeFilter: ["class", "aria-checked", "data-thread-id", "data-legacy-thread-id", "title", "hidden", "style", "aria-disabled"] });
    for (let node = pending.grid.parentElement; node; node = node.parentElement) {
      observer.observe(node, { childList: true, attributes: true, attributeFilter: ["style", "hidden", "aria-hidden"] });
      if (node === pending.main) break;
    }
    for (const toolbar of pending.main.querySelectorAll(S.primaryToolbar)) {
      observer.observe(toolbar, { childList: true, subtree: true, attributes: true,
        attributeFilter: ["aria-label", "style", "class", "hidden", "aria-hidden", "disabled", "aria-disabled"] });
      for (let node = toolbar.parentElement; node; node = node.parentElement) {
        observer.observe(node, { childList: true }); if (node === pending.main) break;
      }
    }
  }

  function refreshFiling() {
    const pending = pendingFiling;
    if (!pending) return;
    if (!filingHealthy(pending)) return finishFiling();
    const row = filingRow(pending);
    if (!row) {
      if (pending.phase === "archiving") {
        // A recycled/ambiguous live row cannot prove that the target was removed.
        if (pending.row.isConnected) return finishFiling("", false);
        if (pending.archiveSubmitted && pending.archiveAcknowledged) {
          finishFiling("", false); filingFeedback(`Moved to ${pending.label}`, pending); return;
        }
      }
      // A staged native row replacement can have a short gap. No action is
      // taken until both thread IDs and the selection can be verified again.
      return waitForFiling(pending);
    }
    if (pending.row.isConnected && pending.row !== row) return finishFiling();
    pending.row = row;
    if (pending.phase === "archiving") return waitForFiling(pending);
    const box = row.querySelector(':scope > td > [role="checkbox"]'), checked = checkedBoxes(pending.main);
    if (pending.phase === "selecting" && !checked.length) return waitForFiling(pending);
    if (!box || checked.length !== 1 || checked[0] !== box || box.getAttribute("aria-checked") !== "true") return finishFiling("", false);
    pending.phase = "reading";
    const badge = [...row.querySelectorAll('.yi .at[title]')].find(node => node.getAttribute("title") === pending.label);
    const target = badge && app.messageList?.filingTarget(badge);
    if (!target || target.row !== row || !visible(row)) return finishFiling(pending.readConfirmed ? filingFailure(pending) : "");
    const overlays = [...document.querySelectorAll('[role="menu"], [role="dialog"], [role="alertdialog"]')]
      .some(node => visible(node) && !node.querySelector(S.composeForm));
    if (overlays) return finishFiling();
    if (row.classList.contains("zE")) {
      if (pending.readConfirmed) return finishFiling(filingFailure(pending));
      const action = nativeToolbarAction(pending.main, S.markRead);
      if (action && performance.now() >= pending.nextRead) {
        pending.nextRead = performance.now() + readRetryDelay;
        if (!pending.readAttempted) quietReadNotice();
        pending.readAttempted = true;
        filingNative(action, false, () => filingActionValid(pending));
      }
      return waitForFiling(pending);
    }
    // Absence of Unread alone is not confirmation; Gmail must supply its
    // explicit read row state. Never mutate classes or click an Unread toggle.
    if (!row.classList.contains("yO")) return waitForFiling(pending);
    pending.readConfirmed = true;
    const archive = nativeToolbarAction(pending.main, S.archive);
    if (!archive) return waitForFiling(pending);
    pending.phase = "archiving"; // Set before dispatch so synchronous Gmail changes cannot repeat Archive.
    watchArchiveNotice(pending);
    pending.archiveSubmitted = filingNative(archive, false, () => filingActionValid(pending));
    if (pendingFiling === pending) waitForFiling(pending);
  }

  function startFiling(target) {
    if (pendingFiling || document.hidden) return;
    if (checkedBoxes(target.main).length) return filingFeedback("Clear your selection to file one conversation.");
    const pending = readCandidate(target.row);
    if (!pending || !["zE", "yO"].some(name => target.row.classList.contains(name))) return;
    if (!filingNoticeContext) clearFilingNotice();
    cancelRead(); stopNativeNoticeWatch();
    Object.assign(pending, { grid: target.grid, page: location.pathname, label: target.label, phase: "selecting", selectionOwned: true,
      nextRead: 0, readConfirmed: target.row.classList.contains("yO") });
    pendingFiling = pending;
    pending.expiry = setTimeout(() => { if (pendingFiling === pending) finishFiling(filingFailure(pending)); }, readTimeout);
    filingNative(target.box, true);
    schedule();
  }

  function filingInput(event) {
    if (filingGesture || !enabled || !(event.target instanceof Element)) return;
    // Both the keyboard bridge and a direct native Undo click restore mail.
    // Remove only our transient success card; Gmail owns the undo operation.
    if (event.type === "click" && event.target.closest(S.nativeUndo) && ownsChrome(event.target)) clearFilingNotice();
    const keyEvent = event.type.startsWith("key"), key = event.key;
    if (keyEvent && heldFilingKey === key) {
      event.preventDefault(); event.stopImmediatePropagation();
      if (event.type === "keyup") heldFilingKey = undefined;
      return;
    }
    const activationKey = key === "Enter" || key === " ";
    const ordinary = !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey && (keyEvent ? activationKey : event.button === 0);
    const target = ordinary && app.messageList?.filingTarget(event.target);
    if (target) {
      event.preventDefault(); event.stopImmediatePropagation();
      cancelRead();
      if (event.type === "keydown" && !event.repeat) { heldFilingKey = key; startFiling(target); }
      else if (event.type === "click" && event.detail <= 1) startFiling(target);
      return;
    }
    if (pendingFiling && (event.type === "pointerdown" || event.type === "keydown")) {
      const selectionIntent = event.target.closest('[role="checkbox"]') ||
        ((event.shiftKey || event.ctrlKey || event.metaKey) && event.target.closest('tr[role="row"]'));
      finishFiling("", !selectionIntent);
    }
  }

  function cancelFiling() { heldFilingKey = undefined; finishFiling(); clearFilingNotice(); }
  // Existing window-capture shortcuts may have been installed before the mode
  // was enabled. Let that owner cancel filing before resolving its own action,
  // preserving the selected target for the user's explicit keyboard command.
  function cancelFilingForShortcut(clearNotice = false) {
    heldFilingKey = undefined; finishFiling("", false);
    if (clearNotice) clearFilingNotice();
  }

  function validReadRow(pending) {
    const { row, main, thread, legacy, route, page } = pending;
    const identity = readIdentity(row);
    return enabled && !document.hidden && location.hash === route && location.pathname === page && visible(row) &&
      row.matches(S.readingRow) && row.closest(S.main) === main &&
      identity?.getAttribute("data-thread-id") === thread &&
      identity.getAttribute("data-legacy-thread-id") === legacy &&
      !main.querySelector('table[role="grid"] [role="checkbox"]:is([aria-checked="true"], [aria-checked="mixed"])');
  }

  function readContext(pending) {
    const { row, main, thread, legacy } = pending;
    if (!validReadRow(pending)) return null;
    const current = app.reverseThreads.currentConversation();
    if (!row.classList.contains("aps") || !current || !visible(current.list) ||
        ![...current.list.querySelectorAll(S.readingBody)].some(visible) ||
        current.heading.closest(S.main) !== main ||
        current.heading.getAttribute("data-thread-perm-id") !== thread.replace(/^#/, "") ||
        current.heading.getAttribute("data-legacy-thread-id") !== legacy) return null;
    return current;
  }

  function markRead(pending) {
    if (pendingRead !== pending) return;
    if (!readContext(pending) || !pending.row.classList.contains("zE")) return cancelRead();
    const action = nativeToolbarAction(pending.main, S.markRead);
    // Gmail can ignore a gesture while rendering its toolbar. Keep checking
    // the native unread state until confirmed, cancelled, or expired.
    // Never click a toggle labeled Unread.
    if (action) {
      if (!pending.attempted) quietReadNotice();
      pending.attempted = true;
      nativeGesture(action, () => pendingRead === pending && readContext(pending) &&
        pending.row.classList.contains("zE") && nativeToolbarAction(pending.main, S.markRead) === action);
    }
    if (pendingRead !== pending) return;
    if (!pending.row.classList.contains("zE")) return cancelRead();
    pending.timer = setTimeout(() => markRead(pending), readRetryDelay);
  }

  function restoreUnread(pending) {
    if (!validReadRow(pending)) return cancelRead();
    if (!pending.row.classList.contains("zE")) return;
    const current = app.reverseThreads.currentConversation();
    // Some Gmail layouts keep the pane open already. Wait only for the native
    // deselection caused by this action, and never override another selection.
    if (pending.row.classList.contains("aps")) return;
    if (pending.main.querySelector('.Nu.tf tr.aps')) return cancelRead();
    if (current) {
      if (current.heading.getAttribute('data-thread-perm-id') !== pending.thread.replace(/^#/, '') ||
          current.heading.getAttribute('data-legacy-thread-id') !== pending.legacy) cancelRead();
      return;
    }
    const link = readIdentity(pending.row)?.closest('[role="link"]');
    if (!visible(link)) return cancelRead();
    cancelRead();
    restoringUnread = true;
    try { nativeGesture(link); }
    finally { restoringUnread = false; }
  }

  function awaitReadRendering(pending) {
    if (pendingRead !== pending || pending.timer !== undefined) return;
    // Gmail can finish nested body rendering without changing the watched
    // chrome. This short, bounded check exists only for the active gesture.
    pending.timer = setTimeout(() => {
      pending.timer = undefined;
      if (pendingRead === pending) schedule();
    }, 100);
  }

  function selectedReadCandidate() {
    const rows = [...document.querySelectorAll(`${S.readingRow}.aps`)].filter(visible);
    return rows.length === 1 ? readCandidate(rows[0]) : null;
  }

  function sameReadVisit(left, right) {
    return left && right && left.main === right.main && left.thread === right.thread && left.legacy === right.legacy;
  }

  function refreshRead() {
    // Watch Gmail's small list for selection transitions, including a reused
    // pane after keyboard navigation or Archive/Delete. Message bodies stay
    // outside this observer. A visit is attempted once, so manual unread and
    // cancelled/expired operations cannot restart on unrelated chrome changes.
    for (const grid of document.querySelectorAll(`${S.main} .Nu.tf table[role="grid"]`)) {
      if (visible(grid)) observer.observe(grid, { childList: true, subtree: true, attributes: true,
        attributeOldValue: true, attributeFilter: ["class", "aria-checked", "data-thread-id", "data-legacy-thread-id"] });
    }
    if (!pendingRead?.keepUnread) {
      const candidate = selectedReadCandidate();
      // Gmail can replace a row while the same conversation stays open. Keep
      // the visit's intent, but resolve its current native row for any retry.
      if (sameReadVisit(readVisit, candidate)) {
        readVisit.row = candidate.row;
        if (pendingRead && sameReadVisit(pendingRead, candidate)) pendingRead.row = candidate.row;
      }
      if (!sameReadVisit(readVisit, candidate) &&
          !(pendingRead?.opening && !pendingRead.started && !sameReadVisit(pendingRead, candidate))) {
        cancelRead();
        readVisit = candidate;
        if (candidate?.row.classList.contains("zE") && !pendingFiling && validReadRow(candidate)) {
          pendingRead = candidate;
          candidate.expiry = setTimeout(cancelRead, readTimeout);
        }
      }
    }
    const pending = pendingRead;
    if (!pending) return;
    if (!validReadRow(pending)) return cancelRead();
    // Temporary identity/readiness watches protect only the active target.
    // Selection and read-state attributes stay owned by Gmail.
    if (pending.row.isConnected) {
      observer.observe(pending.row, { attributes: true, attributeFilter: ["class", "hidden", "style"] });
    }
    if (pending.keepUnread) {
      restoreUnread(pending);
      return awaitReadRendering(pending);
    }
    if (!pending.row.classList.contains("zE")) return cancelRead();
    const current = readContext(pending);
    if (!current) {
      if (pending.started !== undefined || !pending.row.isConnected || location.hash !== pending.route) cancelRead();
      else awaitReadRendering(pending);
      return;
    }
    if (pending.started === undefined) {
      pending.started = true;
      clearTimeout(pending.timer);
      clearTimeout(pending.expiry);
      pending.expiry = setTimeout(cancelRead, readTimeout);
      pending.timer = undefined;
      markRead(pending);
    }
  }

  function readCandidate(row) {
    const identity = readIdentity(row);
    if (!identity) return null;
    const pending = { row, main: row.closest(S.main), route: location.hash, page: location.pathname,
      thread: identity.getAttribute("data-thread-id"), legacy: identity.getAttribute("data-legacy-thread-id") };
    return pending.thread && pending.legacy ? pending : null;
  }

  function keepUnreadOpen(event) {
    const control = event.target.closest(S.markUnread);
    if (!control || !visible(control) || !usable(control) || !ownsChrome(control) ||
        (!control.closest(S.primaryToolbar) && !control.closest(S.readingRow))) return false;
    cancelRead();
    const main = control.closest(S.main);
    const rows = [...main.querySelectorAll(S.readingRow)].filter(row => row.classList.contains("aps"));
    if (rows.length !== 1) return true;
    const pending = readCandidate(rows[0]);
    if (!pending || !readContext(pending) ||
        (control.closest(S.readingRow) && control.closest(S.readingRow) !== pending.row)) return true;
    pending.keepUnread = true;
    pendingRead = readVisit = pending;
    pending.expiry = setTimeout(cancelRead, 5000);
    schedule();
    return true;
  }

  function openForRead(event) {
    if (restoringUnread || !(event.target instanceof Element)) return;
    if (keepUnreadOpen(event)) return;
    const row = event.target.closest(S.readingRow);
    if (!row || event.target.closest(readExcluded) || event.button !== 0 ||
        event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return;
    if (pendingRead?.row === row && !pendingRead.keepUnread && readContext(pendingRead)) return;
    cancelRead();
    if (!row.classList.contains("zE") || document.hidden) return;
    const pending = readCandidate(row);
    if (!pending) return;
    pending.opening = true;
    pendingRead = readVisit = pending;
    // Bound a click whose message never opens. Read immediately once Gmail's
    // selected row and visible conversation agree on both native identities.
    pending.expiry = setTimeout(cancelRead, readTimeout);
    schedule();
  }

  function interruptRead(event) {
    if (!pendingRead || !(event.target instanceof Element)) return;
    if (pendingRead.keepUnread) return cancelRead();
    const shell = readContext(pendingRead)?.heading.closest(S.readingShell);
    if (event.target.closest(readExcluded) ||
        (!shell?.contains(event.target) && !pendingRead.row.contains(event.target))) cancelRead();
  }

  function updateRecipientLabels(shell) {
    for (const [node, change] of recipientLabels) {
      if (!shell?.contains(node) || node.data !== change.after) {
        if (node.data === change.after) node.data = change.before;
        recipientLabels.delete(node);
      }
    }
    for (const summary of shell?.querySelectorAll(S.readingRecipients) || []) {
      if (!ownsChrome(summary)) continue;
      // Only Gmail's direct English label fragments, never recipient nodes or
      // received HTML. Preserve native nodes, contact handlers and punctuation.
      for (const node of summary.childNodes) {
        if (node.nodeType !== Node.TEXT_NODE || recipientLabels.has(node)) continue;
        const match = /^(\s*(?:,\s*)?)(to|cc|bcc):?(\s*)$/i.exec(node.data);
        if (!match) continue;
        const after = match[1] + ({ to: "To:", cc: "CC:", bcc: "BCC:" })[match[2].toLowerCase()] + match[3];
        if (node.data === after) continue;
        recipientLabels.set(node, { before: node.data, after });
        node.data = after;
      }
    }
  }

  function restore() {
    markedShell?.removeAttribute("data-gp-actions-ready");
    markedShell = undefined;
    for (const footer of markedFooters) footer.removeAttribute("data-gp-native-actions");
    markedFooters.clear();
  }

  // Fresh resolution is also performed at activation time. No captured native
  // button, message ID or guessed recipient count can outlive Gmail's target.
  function context() {
    const thread = app.reverseThreads.currentConversation();
    const shell = thread?.heading.closest(S.readingShell);
    if (!shell || !visible(shell)) return null;
    const main = shell.closest(S.main);
    const toolbars = [...main.querySelectorAll(S.primaryToolbar)].filter(visible);
    if (toolbars.length !== 1) return null;
    const toolbar = toolbars[0], more = toolbar.querySelector(S.toolbarMore);
    if (!visible(more)) return null;
    // The thread-level sticky footer is Gmail's source of truth, even when
    // CSS visually reverses messages. Fall back only to one unambiguous footer.
    const footers = [...shell.querySelectorAll(S.nativeFooter)].filter(footer =>
      ownsChrome(footer) && visible(footer) && footer.querySelector(S.nativeReply + ', ' + S.nativeReplyAll + ', ' + S.nativeForward));
    const sticky = footers.filter(footer => footer.closest('.btDi4d'));
    const footer = sticky.length === 1 ? sticky[0] : footers.length === 1 ? footers[0] : null;
    const actions = new Map();
    if (footer) for (const [key, , selector] of definitions) {
      const nodes = [...footer.querySelectorAll(selector)].filter(node => ownsChrome(node) && visible(node) && usable(node));
      if (nodes.length === 1) actions.set(key, nodes[0]);
    }
    // Gmail omits Reply all for single-recipient messages. Keep our toolbar
    // stable and delegate to its ordinary Reply without constructing recipients.
    if (!actions.has('replyAll') && actions.has('reply')) actions.set('replyAll', actions.get('reply'));
    const known = [...actions.values()];
    const replaceable = footer && [...footer.querySelectorAll('button, [role="button"], [role="link"]')]
      .every(node => !usable(node) || known.includes(node) || !visible(node));
    return { shell, toolbar, toolbarHost: toolbar.closest('[gh="tm"]'), more, footer, actions, replaceable };
  }

  function activate(event) {
    const button = event.target.closest('button[data-gp-message-action]');
    if (!enabled || !button || !group?.contains(button)) return;
    event.preventDefault(); event.stopPropagation();
    // Temporarily release our hiding marker for native availability checks.
    // This entire operation is synchronous; there is no intermediate paint.
    restore();
    const current = context();
    const target = current?.actions.get(button.dataset.gpMessageAction);
    if (target) target.dispatchEvent(new MouseEvent("click", {
      bubbles: true, cancelable: true, view: window,
      shiftKey: event.shiftKey, ctrlKey: event.ctrlKey, metaKey: event.metaKey, altKey: event.altKey
    }));
    refresh();
  }

  function createGroup() {
    const node = document.createElement("div");
    node.className = "gmail-pro-message-actions";
    node.setAttribute("role", "group"); node.setAttribute("aria-label", "Message actions");
    for (const [key, label, , path] of definitions) {
      const button = document.createElement("button");
      button.type = "button"; button.dataset.gpMessageAction = key;
      button.title = label; button.setAttribute("aria-label", label);
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("viewBox", "0 0 24 24"); svg.setAttribute("aria-hidden", "true");
      const shape = document.createElementNS(svg.namespaceURI, "path");
      shape.setAttribute("d", path); svg.append(shape); button.append(svg); node.append(button);
    }
    node.addEventListener("click", activate);
    return node;
  }

  function observeMutations(records) {
    // Ignore list hover/focus/presentation classes. Only native selected/read
    // transitions can start or finish a visit; chrome keeps its existing watch.
    if (records.some(record => record.type !== "attributes" || record.attributeName !== "class" ||
        !record.target.closest('.Nu.tf table[role="grid"]') ||
        (record.target.matches('tr[role="row"]') && ["aps", "zE"].some(state =>
          record.target.classList.contains(state) !== (record.oldValue || "").split(/\s+/).includes(state))))) schedule();
  }

  function schedule() {
    if (!enabled || queued) return;
    queued = true;
    queueMicrotask(() => { queued = false; if (enabled) refresh(); });
  }

  function watch(current) {
    if (current) observedContext = { shell: current.shell, toolbar: current.toolbar, toolbarHost: current.toolbarHost };
    // Keep the small shell/toolbar spine alive while Gmail temporarily hides
    // the thread or removes its toolbar, so restoration needs no polling.
    if (!observedContext?.shell.isConnected) return;
    const { shell, toolbar, toolbarHost } = observedContext;
    for (const summary of shell.querySelectorAll(S.readingRecipients)) {
      if (ownsChrome(summary)) observer.observe(summary, { childList: true, subtree: true, characterData: true });
    }
    const watched = new Set();
    const watchNode = node => {
      if (!node || watched.has(node) || !ownsChrome(node)) return;
      watched.add(node);
      observer.observe(node, { childList: true, attributes: true,
        attributeFilter: ["class", "style", "hidden", "aria-hidden", "disabled", "aria-disabled"] });
    };
    // Observe chrome and its ancestor spine, never received message documents
    // or compose editors. Toolbar subtree is small and contains only controls.
    for (const node of [shell, ...shell.children, ...shell.querySelectorAll(S.readingChrome)]) {
      if (!ownsChrome(node)) continue;
      for (let parent = node; parent && parent !== shell.parentElement; parent = parent.parentElement) watchNode(parent);
      for (const control of node.matches('.amn, .gE') ? node.querySelectorAll('button, [role="link"], [role="button"]') : []) {
        if (ownsChrome(control)) for (let parent = control; parent && parent !== node; parent = parent.parentElement) watchNode(parent);
      }
    }
    for (let parent = shell.parentElement; parent; parent = parent.parentElement) {
      watchNode(parent); if (parent.matches(S.main)) break;
    }
    observer.observe(toolbar, { childList: true, subtree: true, attributes: true,
      attributeFilter: ["style", "hidden", "aria-hidden", "disabled", "aria-disabled"] });
    for (let parent = toolbarHost; parent; parent = parent.parentElement) {
      watchNode(parent); if (parent.matches(S.main)) break;
    }
  }

  function refresh() {
    if (!enabled) return;
    observer.disconnect();
    let current;
    try {
      restore();
      refreshRead();
      refreshFiling();
      if (!enabled) return;
      current = context();
      updateRecipientLabels(current?.shell || app.reverseThreads.currentConversation()?.heading.closest(S.readingShell));
      if (!current?.actions.size) { group?.remove(); return; }
      if (!group) group = createGroup();
      for (const button of group.children) {
        const hidden = !current.actions.has(button.dataset.gpMessageAction);
        if (button.hidden !== hidden) button.hidden = hidden;
      }
      // Find the direct action-group sibling containing More. This naturally
      // follows native Labels / third-party hooks without knowing their classes.
      let slot = current.more;
      while (slot.parentElement !== current.toolbar && !slot.parentElement.classList.contains("G-tF")) slot = slot.parentElement;
      if (group.parentElement !== slot.parentElement || group.nextElementSibling !== slot) slot.before(group);
      const bounds = group.getBoundingClientRect(), available = current.toolbar.getBoundingClientRect();
      if (current.replaceable && visible(group) && bounds.width > 0 &&
          bounds.left >= available.left && bounds.right <= available.right && bounds.bottom <= available.bottom + 2) {
        current.footer.setAttribute("data-gp-native-actions", "");
        markedFooters.add(current.footer);
        current.shell.setAttribute("data-gp-actions-ready", "");
        markedShell = current.shell;
      }
    } finally {
      // Watch toolbar readiness only after our own control writes. Otherwise a
      // hidden optional action can perpetually enqueue microtask refreshes.
      if (enabled) {
        watch(current);
        if (pendingFiling) watchFiling(pendingFiling);
        positionFilingNotice();
      }
    }
  }

  function stop() {
    cancelFiling();
    for (const type of filingPointerEvents) document.removeEventListener(type, filingInput, true);
    for (const type of filingKeyEvents) window.removeEventListener(type, filingInput, true);
    document.removeEventListener("visibilitychange", cancelFiling);
    for (const type of ["hashchange", "popstate", "blur"]) window.removeEventListener(type, cancelFiling);
    enabled = false;
    cancelRead();
    readVisit = undefined;
    stopNativeNoticeWatch();
    document.removeEventListener("click", openForRead, true);
    document.removeEventListener("pointerdown", interruptRead, true);
    document.removeEventListener("keydown", cancelRead, true);
    document.removeEventListener("visibilitychange", cancelRead);
    for (const type of ["hashchange", "popstate", "blur"]) window.removeEventListener(type, cancelRead);
    unsubscribe?.(); unsubscribe = undefined;
    observer?.disconnect(); observer = undefined;
    updateRecipientLabels(null);
    window.removeEventListener("resize", schedule);
    group?.remove(); group = undefined;
    observedContext = undefined;
    restore();
  }
  function update(patch = {}) {
    if (!Object.hasOwn(patch, "appleMailModeEnabled")) return;
    if (!patch.appleMailModeEnabled) return stop();
    if (enabled) return;
    enabled = true;
    // Enabling the mode does not change the status of an already-open message.
    readVisit = selectedReadCandidate();
    observer = new MutationObserver(observeMutations);
    for (const type of filingPointerEvents) document.addEventListener(type, filingInput, true);
    for (const type of filingKeyEvents) window.addEventListener(type, filingInput, true);
    document.addEventListener("visibilitychange", cancelFiling);
    for (const type of ["hashchange", "popstate", "blur"]) window.addEventListener(type, cancelFiling);
    document.addEventListener("click", openForRead, true);
    document.addEventListener("pointerdown", interruptRead, true);
    document.addEventListener("keydown", cancelRead, true);
    document.addEventListener("visibilitychange", cancelRead);
    for (const type of ["hashchange", "popstate", "blur"]) window.addEventListener(type, cancelRead);
    window.addEventListener("resize", schedule);
    unsubscribe = app.reverseThreads.subscribeConversation(schedule);
    refresh();
  }
  app.readingPane = Object.freeze({ start: update, update, stop, cancelFilingForShortcut });
})();
