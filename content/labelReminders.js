(() => {
  'use strict';
  const app = (globalThis.GmailPro ??= {});
  if (app.labelReminders) return;
  const R = app.labelRecency, entries = new Map();
  const observed = new Set(), nearby = new Set();
  let settings = {}, active = false, owner = null, rows = [], candidates = new Map();
  let unsubscribe, frame = 0, expiryTimer = 0, generation = 0, drawing = 0, task, popover, needsRefresh = false, disconnected = false;
  let intersection;
  const visible = () => document.visibilityState !== 'hidden';
  const paths = () => rows.map(row => row.id);
  const labelName = row => row.id.startsWith('label/') ? row.id.slice(6) : row.link.textContent.trim();
  async function send(action, extra = {}, account = owner) {
    const result = await chrome.runtime.sendMessage({ type: 'gmail-pro-label-reminders', action, account, paths: paths(), ...extra });
    if (!result?.ok) throw Object.assign(new Error(result?.error || 'Could not check labels. Please try again.'), { retryAt: result?.retryAt });
    return result;
  }
  function closePopover(focus = false) {
    const current = popover; popover = null;
    if (!current) return;
    current.controller.abort();
    current.button.setAttribute('aria-expanded', 'false');
    current.node.remove();
    if (focus && current.button.isConnected) current.button.focus({ preventScroll: true });
  }
  function syncTheme(node) {
    node.dataset.gpTheme = !settings.appearanceTheme || settings.appearanceTheme === 'system' ?
      (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : settings.appearanceTheme;
    node.dataset.gpAccent = settings.accentColor || 'blue';
  }
  function explanation(candidate) {
    if (candidate.kind === 'empty') return 'This label is empty and has no child labels. Hide it from your sidebar?';
    return candidate.children ? `No emails in this label or any of its child labels are newer than ${candidate.milestone} months. Hide this branch from your sidebar?` :
      `No emails in this label are newer than ${candidate.milestone} months. Hide it from your sidebar?`;
  }
  async function act(context, hide) {
    if (popover !== context || context.busy) return;
    context.busy = true; context.hide.disabled = context.dismiss.disabled = true;
    context.status.textContent = hide ? 'Checking this label and its children…' : 'Saving dismissal…';
    const stillCurrent = () => active && popover === context && owner === context.owner &&
      entries.get(context.path)?.button === context.button && context.button.isConnected;
    try {
      if (hide) {
        let result, reviewId;
        do {
          result = await send('review', { path: context.path, ...(reviewId ? { reviewId } : {}) }, context.owner);
          if (!stillCurrent()) return;
          reviewId = result.reviewId;
          if (result.reviewPending) context.status.textContent = `Checking child labels… ${result.reviewPending} remaining`;
        } while (result.reviewPending);
        if (!result.reviewed) throw new Error('Could not verify this label. Please try again.');
        if (!result.candidate) {
          candidates.delete(context.path); context.status.textContent = 'This label no longer needs a hide suggestion.';
          context.hide.hidden = true; context.dismiss.textContent = 'Close'; context.dismiss.disabled = false;
          context.dismiss.onclick = () => { closePopover(true); draw(); }; return;
        }
        if (['kind', 'milestone', 'latestAt'].some(name => result.candidate[name] !== context.candidate[name])) {
          context.candidate = result.candidate; context.copy.textContent = explanation(result.candidate);
          candidates.set(context.path, result.candidate);
          context.status.textContent = 'The label changed. Review the updated suggestion before hiding it.'; return;
        }
        if (!stillCurrent()) return;
        const saved = await app.labelOrder.setSidebarVisibility(context.path, true, context.owner);
        if (!saved) throw new Error('Could not hide this label. Please try again.');
      }
      await send('dismiss', { path: context.path }, context.owner);
      if (owner === context.owner) { candidates.delete(context.path); draw(); }
      if (popover === context) closePopover(!hide);
    } catch (error) {
      if (stillCurrent()) context.status.textContent = error.message;
      else if (active && owner === context.owner && hide) app.labelOrder.notify?.('Label visibility was updated, but the reminder could not be saved. Please try again.', true);
    } finally {
      if (popover === context) { context.busy = false; context.hide.disabled = context.dismiss.disabled = false; }
    }
  }
  function openPopover(entry) {
    if (popover?.button === entry.button) { closePopover(true); return; }
    closePopover();
    const candidate = candidates.get(entry.row.id);
    if (!candidate || owner !== entry.row.account) return;
    const node = document.createElement('div'); node.className = 'gmail-pro-label-recency-popover gmail-pro-appearance-preview';
    node.dataset.gmailProLabelUi = 'recency-popover'; node.setAttribute('popover', 'auto'); node.setAttribute('role', 'dialog');
    node.setAttribute('aria-label', `Review inactive label: ${labelName(entry.row)}`); syncTheme(node);
    const title = document.createElement('strong'); title.textContent = labelName(entry.row);
    const copy = document.createElement('p'); copy.textContent = explanation(candidate);
    const hint = document.createElement('p'); hint.className = 'gmail-pro-label-recency-hint'; hint.textContent = 'Restore hidden labels in Organize labels.';
    const status = document.createElement('p'); status.className = 'gmail-pro-label-recency-status'; status.setAttribute('role', 'status');
    const actions = document.createElement('div'), hide = document.createElement('button'), dismiss = document.createElement('button');
    actions.className = 'gmail-pro-label-recency-actions';
    hide.type = dismiss.type = 'button'; hide.textContent = 'Hide label'; dismiss.textContent = 'Dismiss';
    actions.append(dismiss, hide); node.append(title, copy, hint, status, actions); document.body.append(node);
    const context = { node, button: entry.button, owner, path: entry.row.id, candidate, copy, hide, dismiss, status, controller: new AbortController() };
    popover = context; entry.button.setAttribute('aria-expanded', 'true');
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (settings.appearanceTheme === 'system') syncTheme(node);
    }, { signal: context.controller.signal });
    hide.onclick = () => void act(context, true); dismiss.onclick = () => void act(context, false);
    node.addEventListener('toggle', event => { if (event.newState === 'closed' && popover === context) closePopover(); });
    node.addEventListener('keydown', event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closePopover(true); }
      if (event.key === 'Tab') {
        const buttons = [dismiss, hide].filter(button => !button.hidden && !button.disabled);
        if (buttons.length && ((event.shiftKey && document.activeElement === buttons[0]) ||
            (!event.shiftKey && document.activeElement === buttons.at(-1)))) {
          event.preventDefault(); (event.shiftKey ? buttons.at(-1) : buttons[0]).focus();
        }
      }
    });
    const rect = entry.button.getBoundingClientRect();
    node.style.left = `${Math.max(8, Math.min(rect.left, innerWidth - 288))}px`;
    node.style.top = `${Math.max(8, Math.min(rect.bottom + 6, innerHeight - 240))}px`;
    node.showPopover();
    const top = Math.max(8, Math.min(rect.bottom + 6, innerHeight - node.getBoundingClientRect().height - 8));
    node.style.top = `${top}px`; node.style.maxHeight = `${Math.max(16, innerHeight - top - 8)}px`;
    dismiss.focus({ preventScroll: true });
    // These listeners exist only while a popover is open.
    window.addEventListener('resize', () => closePopover(true), { signal: context.controller.signal });
    document.addEventListener('scroll', event => { if (!node.contains(event.target)) closePopover(); },
      { capture: true, passive: true, signal: context.controller.signal });
  }
  function draw() {
    if (!active) return;
    cancelAnimationFrame(frame); frame = 0;
    const revision = ++drawing;
    const eligible = rows.filter(row => !row.hidden && candidates.has(row.id));
    // Gmail can mount hundreds of offscreen rows. Observe their visibility,
    // but create controls only near the viewport; scrolling never fetches mail.
    const nodes = new Set(eligible.map(row => row.node));
    for (const node of observed) if (!nodes.has(node)) {
      intersection.unobserve(node); observed.delete(node); nearby.delete(node);
    }
    if (eligible.length && !intersection) intersection = new IntersectionObserver(changes => {
      let changed = false;
      for (const change of changes) {
        if (!observed.has(change.target)) continue;
        if (change.isIntersecting && !nearby.has(change.target)) { nearby.add(change.target); changed = true; }
        else if (!change.isIntersecting && nearby.delete(change.target)) changed = true;
      }
      if (changed) draw();
    }, { rootMargin: '48px 0px' });
    for (const node of nodes) if (!observed.has(node)) { observed.add(node); intersection.observe(node); }
    const shown = eligible.filter(row => nearby.has(row.node));
    const wanted = new Set(shown.map(row => row.id));
    for (const [id, entry] of entries) if (!wanted.has(id) || !entry.button.isConnected) {
      if (popover?.button === entry.button) closePopover();
      entry.button.remove(); entries.delete(id);
    }
    let cursor = 0;
    const render = () => {
      frame = 0;
      if (!active || revision !== drawing) return;
      const start = performance.now(); let count = 0;
      // Bound insertions as well as JavaScript time: deferred style/layout work
      // still costs a frame even when creating the nodes themselves is fast.
      while (cursor < shown.length && count++ < 20 && performance.now() - start < 4) {
        const row = shown[cursor++]; let entry = entries.get(row.id);
        if (entry?.row.node !== row.node) { entry?.button.remove(); entries.delete(row.id); entry = null; }
        if (entry) { entry.row = row; continue; }
        const button = document.createElement('button'); button.type = 'button'; button.className = 'gmail-pro-label-sleep';
        button.dataset.gmailProLabelUi = 'recency'; button.title = 'Review inactive label';
        button.setAttribute('aria-label', `Review inactive label: ${labelName(row)}`);
        button.setAttribute('aria-haspopup', 'dialog'); button.setAttribute('aria-expanded', 'false');
        entry = { row, button }; entries.set(row.id, entry);
        for (const type of ['pointerdown', 'mousedown', 'dblclick', 'keydown']) button.addEventListener(type, event => event.stopPropagation());
        button.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); openPopover(entry); });
        const slot = row.line.querySelector(':scope > .nL'); if (slot) slot.before(button); else row.line.append(button);
      }
      if (cursor < shown.length) frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);
  }
  async function refresh() {
    if (!active || disconnected || !owner || !visible() || !R.enabled(settings) || task) return task;
    const token = generation, account = owner;
    const current = async () => {
      let result = await send('status', {}, account);
      while (active && token === generation && owner === account && visible() && R.enabled(settings)) {
        if (result.mismatch || !result.connected || result.enabled === false) {
          candidates.clear(); draw();
          // A disconnected feature needs no sidebar reconciliation. Connection
          // notifications (or a later settings enable) attach it again.
          if (!result.mismatch && result.connected === false) { disconnected = true; unsubscribe?.(); unsubscribe = null; }
          break;
        }
        candidates = new Map((result.results || []).map(candidate => [candidate.path, candidate])); draw();
        if (result.retryAt > Date.now()) {
          clearTimeout(expiryTimer); expiryTimer = setTimeout(() => void refresh(), Math.max(1000, result.retryAt - Date.now())); break;
        }
        if (result.catalogAt && !result.pending && Date.now() < result.nextCheckAt) {
          clearTimeout(expiryTimer);
          expiryTimer = setTimeout(() => { expiryTimer = 0; void refresh(); }, Math.max(1000, result.nextCheckAt - Date.now()));
          break;
        }
        result = await send('scan', {}, account);
      }
    };
    task = current().catch(error => {
      // A service outage pauses the account rather than retrying every label.
      if (active && token === generation && visible() && Number.isFinite(error.retryAt)) {
        clearTimeout(expiryTimer); expiryTimer = setTimeout(() => void refresh(), Math.max(1000, error.retryAt - Date.now()));
      }
    })
      .finally(() => { task = null; if (active && (generation !== token || needsRefresh)) { needsRefresh = false; void refresh(); } });
    return task;
  }
  function sidebarChanged(value) {
    if (!active) return;
    if (owner !== value.account) {
      generation++; owner = value.account; candidates.clear(); closePopover(); clearTimeout(expiryTimer);
    }
    rows = value.rows;
    const account = owner;
    if (value.restored && account) void send('dismiss', { path: value.restored }, account).then(() => {
      if (owner === account) { candidates.delete(value.restored); draw(); }
    }).catch(() => app.labelOrder.notify?.('Label restored, but its reminder could not be dismissed. Please try again.', true));
    draw(); void refresh();
  }
  const visibilityChanged = () => { if (visible()) void refresh(); else clearTimeout(expiryTimer); };
  function watchSidebar() {
    if (unsubscribe || disconnected || !R.enabled(settings)) return;
    unsubscribe = app.labelOrder.subscribe(sidebarChanged);
    sidebarChanged({ account: app.labelOrder.account(), rows: app.labelOrder.sidebarRows() });
  }
  const message = request => {
    if (request?.type !== 'gmail-pro-label-reminders-changed') return;
    disconnected = false; needsRefresh = !!task; watchSidebar(); void refresh();
  };
  function start(options) {
    update(options);
    if (active) return;
    active = true;
    document.addEventListener('visibilitychange', visibilityChanged);
    chrome.runtime.onMessage.addListener(message);
    watchSidebar();
  }
  function update(patch) {
    const wasEnabled = R.enabled(settings);
    Object.assign(settings, patch);
    if (!active) return;
    if (!R.enabled(settings)) {
      generation++; candidates.clear(); closePopover(); clearTimeout(expiryTimer); unsubscribe?.(); unsubscribe = null;
    } else if (!wasEnabled) { disconnected = false; watchSidebar(); }
    if (popover) syncTheme(popover.node);
    draw(); void refresh();
  }
  function stop() {
    if (!active) return;
    active = false; generation++; drawing++;
    clearTimeout(expiryTimer); cancelAnimationFrame(frame); frame = 0; closePopover(); unsubscribe?.(); unsubscribe = null; disconnected = false;
    intersection?.disconnect(); intersection = null; observed.clear(); nearby.clear();
    document.removeEventListener('visibilitychange', visibilityChanged);
    try { chrome.runtime.onMessage.removeListener(message); if (owner) void send('detach').catch(() => {}); } catch { /* expired extension */ }
    for (const { button } of entries.values()) button.remove(); entries.clear(); candidates.clear(); owner = null; rows = [];
  }
  app.labelReminders = Object.freeze({ start, update, stop });
})();
