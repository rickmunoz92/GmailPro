(() => {
  "use strict";
  const app = (globalThis.GmailPro ??= {});
  if (app.archiveRead) return;
  const S = app.selectors;
  // Gmail's row hover actions are LI elements without role/aria-label.
  const archiveSelector = `${S.archive}, .bq4 li.bqX.brq[data-tooltip="Archive"]`;
  const readSelector = `${S.markRead}, .bq4 li.bqX.brr[data-tooltip="Mark as read"]`;
  const pointerEvents = ["pointerdown", "mousedown", "mouseup", "click"];
  const keyEvents = ["keydown", "keypress", "keyup"];
  const visible = node => !!node?.isConnected && node.checkVisibility({ visibilityProperty: true }) &&
    !node.closest('[hidden], [aria-hidden="true"], [inert]');
  const usable = node => visible(node) && !node.matches('[disabled], [aria-disabled="true"]');
  const one = nodes => nodes.length === 1 ? nodes[0] : null;
  const identity = row => row.querySelector(S.pagingIdentity);
  const rows = main => [...main.querySelectorAll(S.readingRow)];
  const checked = main => rows(main).filter(row => row.querySelector(':scope > td > [role="checkbox"]')?.getAttribute('aria-checked') === 'true');
  const knownSelection = main => main.querySelectorAll('table[role="grid"] [role="checkbox"]:is([aria-checked="true"], [aria-checked="mixed"])').length === checked(main).length;
  const action = (root, selector) => one([...root.querySelectorAll(selector)].filter(usable));
  let enabled = false, forwarding = false, pending, gesture, heldKey, notice, noticeTimer;

  function clearNotice() { clearTimeout(noticeTimer); notice?.remove(); notice = undefined; }
  function cancel() { clearTimeout(pending?.timer); pending = undefined; }
  function interrupt() { cancel(); gesture = undefined; heldKey = undefined; clearNotice(); }
  function fail() {
    cancel(); clearNotice();
    notice = document.createElement('div'); notice.className = 'gmail-pro-filing-notice';
    notice.setAttribute('role', 'status'); notice.setAttribute('aria-live', 'polite');
    notice.textContent = 'Couldn’t confirm this conversation is read, so it wasn’t archived. Try again.';
    const dismiss = document.createElement('button'); dismiss.type = 'button'; dismiss.textContent = 'Dismiss';
    dismiss.addEventListener('click', clearNotice); notice.append(dismiss); document.body.append(notice);
    noticeTimer = setTimeout(clearNotice, 6000);
  }

  function context(target) {
    if (!usable(target) || target.closest(`${S.readingExcluded}, [role="menu"], [data-inboxsdk-id]`)) return null;
    const main = one([...document.querySelectorAll(S.main)].filter(visible));
    if (!main?.contains(target) || !knownSelection(main) || [...document.querySelectorAll('[role="menu"], [role="alertdialog"], [role="dialog"]')]
      .some(node => visible(node) && !node.querySelector(S.composeForm))) return null;
    const row = target.closest(S.readingRow);
    let root, targets, mode;
    if (row) { root = row; targets = [row]; mode = 'row'; }
    else {
      root = one([...main.querySelectorAll(S.primaryToolbar)].filter(visible));
      if (!root?.contains(target)) return null;
      targets = checked(main); mode = 'selected';
      if (!targets.length) { targets = rows(main).filter(row => row.classList.contains('aps') && visible(row)); mode = 'open'; }
      // Unknown layouts retain Gmail's ordinary Archive behavior.
      if (!targets.length) return null;
    }
    if (!targets.every(row => visible(row) && identity(row) &&
      (row.classList.contains('zE') || row.classList.contains('yO')))) return null;
    if (mode === 'open') {
      const heading = app.reverseThreads?.currentConversation()?.heading, id = identity(targets[0]);
      if (targets.length !== 1 || !visible(heading) || heading.closest(S.main) !== main ||
        heading.getAttribute('data-thread-perm-id') !== id.getAttribute('data-thread-id').replace(/^#/, '') ||
        heading.getAttribute('data-legacy-thread-id') !== id.getAttribute('data-legacy-thread-id')) return null;
    }
    return { main, root, targets, mode, route: location.hash, page: location.pathname,
      selection: checked(main), ids: targets.map(row => [identity(row).getAttribute('data-thread-id'), identity(row).getAttribute('data-legacy-thread-id')]) };
  }

  function valid(current) {
    if (!enabled || document.hidden || location.hash !== current.route || location.pathname !== current.page || !visible(current.root) || !knownSelection(current.main)) return false;
    if (one([...document.querySelectorAll(S.main)].filter(visible)) !== current.main ||
        (current.mode !== 'row' && one([...current.main.querySelectorAll(S.primaryToolbar)].filter(visible)) !== current.root) ||
        [...document.querySelectorAll('[role="menu"], [role="alertdialog"], [role="dialog"]')]
          .some(node => visible(node) && !node.querySelector(S.composeForm))) return false;
    const selection = checked(current.main);
    if (selection.length !== current.selection.length || selection.some((row, i) => row !== current.selection[i])) return false;
    if (current.mode === 'open') {
      const heading = app.reverseThreads?.currentConversation()?.heading;
      if (!visible(heading) || heading.closest(S.main) !== current.main ||
          heading.getAttribute('data-thread-perm-id') !== current.ids[0][0].replace(/^#/, '') ||
          heading.getAttribute('data-legacy-thread-id') !== current.ids[0][1]) return false;
    }
    return current.targets.every((row, i) => visible(row) && row.closest(S.main) === current.main &&
      identity(row)?.getAttribute('data-thread-id') === current.ids[i][0] &&
      identity(row)?.getAttribute('data-legacy-thread-id') === current.ids[i][1]) &&
      (current.mode !== 'open' || current.targets[0].classList.contains('aps'));
  }

  function nativeGesture(target, guard) {
    forwarding = true;
    try {
      const box = target.getBoundingClientRect();
      for (const type of ['mousedown', 'mouseup', 'click']) {
        if (!guard() || !usable(target)) return false;
        target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window,
          button: 0, buttons: type === 'mousedown' ? 1 : 0, detail: 1,
          clientX: box.left + box.width / 2, clientY: box.top + box.height / 2 }));
      }
      return true;
    } finally { forwarding = false; }
  }

  function advance(current) {
    if (pending !== current) return;
    if (!valid(current)) return cancel();
    if (current.targets.every(row => row.classList.contains('yO') && !row.classList.contains('zE'))) {
      const archive = action(current.root, archiveSelector);
      if (archive) {
        // Release the pending operation before dispatch: Archive is never retried.
        cancel();
        nativeGesture(archive, () => valid(current) && action(current.root, archiveSelector) === archive &&
          current.targets.every(row => row.classList.contains('yO') && !row.classList.contains('zE')));
        return;
      }
    }
    if (performance.now() >= current.deadline) return fail();
    current.timer = setTimeout(() => advance(current), 50);
  }

  function start(current) {
    if (pending || !valid(current)) return;
    app.readingPane?.cancelFilingForShortcut?.();
    app.readingPane?.cancelAutomaticRead?.();
    clearNotice();
    pending = current; current.deadline = performance.now() + 5000;
    if (current.targets.some(row => row.classList.contains('zE'))) {
      const read = action(current.root, readSelector);
      if (!read) return fail();
      nativeGesture(read, () => pending === current && valid(current) && action(current.root, readSelector) === read &&
        current.targets.some(row => row.classList.contains('zE')));
    }
    advance(current);
  }

  function input(event) {
    if (!enabled || forwarding || !(event.target instanceof Element)) return;
    const keyEvent = event.type.startsWith('key');
    if (keyEvent && heldKey === event.key && event.type !== 'keydown') {
      event.preventDefault(); event.stopImmediatePropagation();
      if (event.type === 'keyup') heldKey = undefined;
      return;
    }
    const target = event.target.closest(archiveSelector);
    const ordinary = !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey &&
      (keyEvent ? event.key === 'Enter' || event.key === ' ' : event.button === 0);
    // Preserve ownership through mouseup/click if Gmail changes read state or
    // toolbar visibility between phases. Native mousedown must never run first.
    if (gesture && target === gesture.target && !keyEvent && ordinary) {
      event.preventDefault(); event.stopImmediatePropagation();
      if (event.type === 'click') { const current = gesture.current; gesture = undefined; start(current); }
      return;
    }
    const current = ordinary && target && context(target);
    if (current && (pending || current.targets.some(row => row.classList.contains('zE')))) {
      event.preventDefault(); event.stopImmediatePropagation();
      if (pending) return;
      if (keyEvent) {
        if (event.type === 'keydown' && !event.repeat) { heldKey = event.key; start(current); }
      } else if (event.type === 'click') start(current);
      else gesture = { target, current };
      return;
    }
    if (event.type === 'pointerdown' || event.type === 'keydown') interrupt();
  }

  function stop() {
    enabled = false; interrupt();
    for (const type of pointerEvents) window.removeEventListener(type, input, true);
    for (const type of keyEvents) window.removeEventListener(type, input, true);
    for (const type of ['hashchange', 'popstate', 'blur', 'pagehide']) window.removeEventListener(type, interrupt);
    document.removeEventListener('visibilitychange', interrupt);
  }
  function update(patch = {}) {
    if (!Object.hasOwn(patch, 'appleMailModeEnabled')) return;
    if (!patch.appleMailModeEnabled) return stop();
    if (enabled) return;
    enabled = true;
    for (const type of pointerEvents) window.addEventListener(type, input, { capture: true, passive: false });
    for (const type of keyEvents) window.addEventListener(type, input, { capture: true, passive: false });
    for (const type of ['hashchange', 'popstate', 'blur', 'pagehide']) window.addEventListener(type, interrupt);
    document.addEventListener('visibilitychange', interrupt);
  }
  app.archiveRead = Object.freeze({ start: update, update, stop, cancel });
})();
