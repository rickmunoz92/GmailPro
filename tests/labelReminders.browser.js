(async () => {
  'use strict';
  if (location.hostname !== '127.0.0.1') throw new Error('Synthetic fixture only');
  const app = GmailPro, R = app.labelRecency, host = document.getElementById('workspace');
  const reports = [], result = document.getElementById('results'), runtime = new Set(), changes = new Set();
  let prefs = { ...app.settings.defaults }, raw, metadata, dismissals = new Map(), account = 'one@example.test';
  let failReview = false, becameActive = false, reviewCalls = 0, saved = 0, navigations = 0, statusCalls = 0;
  const previews = new URLSearchParams(location.search), theme = previews.get('preview') || 'light';
  document.documentElement.dataset.gpTheme = theme;
  document.getElementById('theme-toggle').onclick = () => {
    document.documentElement.dataset.gpTheme = document.documentElement.dataset.gpTheme === 'dark' ? 'light' : 'dark';
    app.labelReminders.update({ appearanceTheme: document.documentElement.dataset.gpTheme });
  };
  const assert = (value, message) => { if (!value) throw new Error(message); };
  const settle = () => new Promise(resolve => setTimeout(resolve, 30));
  async function eventually(check, message) {
    const deadline = performance.now() + 3000;
    while (!check() && performance.now() < deadline) await settle();
    assert(check(), message || 'Expected state did not arrive');
  }
  function output(message) { reports.push(message); result.textContent = reports.join('\n'); }
  async function test(name, work) { try { await work(); output('PASS ' + name); } catch (error) { output('FAIL ' + name + ': ' + error.message); } }
  const originalSettings = app.settings;
  app.settings = { ...originalSettings,
    load: async () => structuredClone(prefs),
    save: async patch => { Object.assign(prefs, structuredClone(patch)); saved++; app.labelOrder.update(patch); app.labelReminders.update(patch); }
  };
  globalThis.chrome ??= {};
  if (chrome.storage) throw new Error('Refusing to replace real extension storage');
  chrome.runtime = { onMessage: { addListener: fn => runtime.add(fn), removeListener: fn => runtime.delete(fn) },
    async sendMessage(message) {
      assert(message.type === 'gmail-pro-label-reminders', 'Only reminder worker messages');
      if (message.action === 'detach') return { ok: true };
      if (message.action === 'status') statusCalls++;
      if (message.account !== account) return { ok: true, mismatch: true, results: [], pending: 0 };
      const labels = R.catalog(raw), rolled = R.rollup(labels, metadata);
      if (message.action === 'dismiss') {
        const label = [...rolled.values()].find(label => label.path === message.path);
        const candidate = R.suggestion(label, prefs, null);
        if (candidate) dismissals.set(label.id, R.dismissal(candidate));
      }
      const results = [...rolled.values()].flatMap(label => {
        const candidate = R.suggestion(label, prefs, dismissals.get(label.id));
        return candidate ? [{ id: label.id, path: label.path, name: label.name, children: label.children, checkedAt: Date.now(), ...candidate }] : [];
      });
      if (message.action === 'review') {
        reviewCalls++; await settle();
        if (failReview) return { ok: false, error: 'Could not verify every child label. Nothing was hidden.' };
        return { ok: true, reviewed: true, reviewPending: 0, candidate: becameActive ? null : results.find(label => label.path === message.path) };
      }
      return { ok: true, connected: true, enabled: R.enabled(prefs), configured: true, account, catalogAt: Date.now(),
        nextCheckAt: Date.now() + 86400000, total: labels.length, pending: 0, results };
    } };
  chrome.storage = { onChanged: { addListener: fn => changes.add(fn), removeListener: fn => changes.delete(fn) } };
  const row = (name, path, depth = 0) => {
    const node = document.createElement('div'); node.className = 'aim';
    const outer = document.createElement('div'); outer.className = 'TO';
    const line = document.createElement('div'); line.className = 'TN'; line.style.marginLeft = depth * 12 + 'px';
    const text = document.createElement('div'); text.className = 'nU';
    const link = document.createElement('a'); link.className = 'n0'; link.href = '#' + path; link.textContent = name;
    link.onclick = event => { event.preventDefault(); navigations++; }; text.append(link);
    const slot = document.createElement('div'); slot.className = 'nL';
    const count = document.createElement('span'); count.className = 'count'; count.textContent = '6'; slot.append(count);
    if (path.startsWith('label/')) { const menu = document.createElement('div'); menu.dataset.labelName = decodeURIComponent(path.slice(6)); menu.setAttribute('aria-haspopup', 'true'); slot.append(menu); }
    line.append(text, slot); outer.append(line); node.append(outer); return node;
  };
  function setup(large = 0, startReminders = true) {
    app.labelReminders.stop(); app.labelOrder.stop(); host.replaceChildren();
    dismissals = new Map(); prefs = { ...app.settings.defaults, appearanceTheme: document.documentElement.dataset.gpTheme };
    failReview = becameActive = false; saved = reviewCalls = navigations = statusCalls = 0;
    const old = Date.now() - 400 * 86400000;
    raw = [{ id: 'parent', name: 'Clients', type: 'user' }, { id: 'child', name: 'Clients/Active project', type: 'user' },
      { id: 'old', name: 'Past projects', type: 'user' }, { id: 'empty', name: 'Unused', type: 'user' },
      { id: 'INBOX', name: 'INBOX', type: 'system' }, { id: 'SPAM', name: 'SPAM', type: 'system' }];
    metadata = new Map(raw.map(label => [label.id, { known: true, latestAt: ['empty', 'SPAM'].includes(label.id) ? null :
      ['child', 'INBOX'].includes(label.id) ? Date.now() : old, checkedAt: Date.now() }]));
    for (const view of R.catalog([])) metadata.set(view.id, { known: true, latestAt: Date.now(), checkedAt: Date.now() });
    const header = document.createElement('header'); header.setAttribute('role', 'banner');
    const accountButton = document.createElement('button'); accountButton.setAttribute('aria-label', 'Google Account: One (one@example.test)'); header.append(accountButton);
    const nav = document.createElement('nav'); nav.setAttribute('role', 'navigation');
    const system = document.createElement('div'); system.className = 'system';
    system.append(row('Inbox', 'inbox'), row('Spam', 'spam'));
    const section = document.createElement('section'); section.setAttribute('aria-labelledby', 'label-title');
    const heading = document.createElement('div'); heading.className = 'fixture-label-title';
    const title = document.createElement('h2'); title.id = 'label-title'; title.textContent = 'Labels';
    const create = document.createElement('button'); create.setAttribute('role', 'button'); create.setAttribute('aria-label', 'Create new label'); create.textContent = '+'; heading.append(title, create);
    const container = document.createElement('div'); container.setAttribute('gh', 'cl');
    const list = document.createElement('div'); list.className = 'TK';
    list.append(row('Clients', 'label/Clients'), row('Active project', 'label/Clients%2FActive%20project', 1),
      row('Past projects', 'label/Past%20projects'), row('Unused', 'label/Unused'));
    for (let i = 0; i < large; i++) {
      raw.push({ id: 'large_' + i, name: 'Project ' + i, type: 'user' });
      metadata.set('large_' + i, { known: true, latestAt: old, checkedAt: Date.now() });
      list.append(row('Project ' + i, 'label/Project%20' + i));
    }
    container.append(list); section.append(heading, container); nav.append(system, section); host.append(header, nav);
    app.labelOrder.start(prefs); if (startReminders) app.labelReminders.start(prefs); return { list, accountButton };
  }
  const sleepButton = name => [...host.querySelectorAll('.aim')].find(node => node.querySelector('a')?.textContent === name)?.querySelector('.gmail-pro-label-sleep');
  if (previews.has('benchmark')) {
    if (previews.has('plain')) document.querySelector('link[href="../content/appleMail.css"]').disabled = true;
    setup(500, false);
    const sidebarTimings = [], workerTimings = [], sourceRows = app.labelOrder.sidebarRows;
    app.labelOrder = { ...app.labelOrder, sidebarRows(...args) {
      const at = performance.now(), value = sourceRows(...args); sidebarTimings.push(performance.now() - at); return value;
    } };
    const sourceSend = chrome.runtime.sendMessage;
    chrome.runtime.sendMessage = async message => {
      const at = performance.now(), value = await sourceSend(message); workerTimings.push(performance.now() - at); return value;
    };
    host.style.maxHeight = '600px'; host.style.overflow = 'auto';
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    async function measure(mode) {
      const longTasks = [], frames = [];
      const observer = new PerformanceObserver(list => longTasks.push(...list.getEntries().map(entry => entry.duration)));
      observer.observe({ type: 'longtask', buffered: false });
      const start = performance.now(); let previous = start, decoratedAt = null, startCallMs = 0, maxControls = 0;
      if (mode === 'on') app.labelReminders.start(prefs);
      startCallMs = performance.now() - start;
      for (let i = 0; i < 75; i++) {
        const at = await new Promise(resolve => requestAnimationFrame(resolve));
        frames.push(at - previous); previous = at; host.scrollTop += 6;
        const controls = host.querySelectorAll('.gmail-pro-label-sleep').length; maxControls = Math.max(maxControls, controls);
        if (decoratedAt === null && controls > 0) decoratedAt = Math.round(at - start);
      }
      longTasks.push(...observer.takeRecords().map(entry => entry.duration)); observer.disconnect();
      frames.shift(); frames.sort((a,b)=>a-b);
      return { mode, labels: 506, longTasks: longTasks.length, maxLongTaskMs: Math.round(Math.max(0, ...longTasks)),
        p95FrameMs: Number(frames[Math.floor(frames.length * .95)].toFixed(2)), maxFrameMs: Number(frames.at(-1).toFixed(2)),
        decoratedAtMs: decoratedAt, workerMessages: statusCalls, controls: host.querySelectorAll('.gmail-pro-label-sleep').length, maxControls,
        startCallMs: Math.round(startCallMs), maxSidebarReadMs: Math.round(Math.max(0, ...sidebarTimings)),
        maxMockWorkerMs: Math.round(Math.max(0, ...workerTimings)) };
    }
    if (previews.get('benchmark') === 'compare') {
      const off = await measure('off'); host.scrollTop = 0;
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const on = await measure('on');
      result.textContent = JSON.stringify({ off, on, p95DeltaMs: Number((on.p95FrameMs - off.p95FrameMs).toFixed(2)) });
    } else result.textContent = JSON.stringify(await measure(previews.get('benchmark')));
    result.dataset.failures = '0'; return;
  }
  setup(); await eventually(() => sleepButton('Unused'), 'retroactive controls');
  if (previews.has('preview')) { result.textContent = 'Preview · existing dates, empty leaves and descendant rollups'; return; }
  await test('retroactive zz controls include system labels while active descendant protects parent', async () => {
    assert(sleepButton('Past projects') && sleepButton('Unused') && sleepButton('Spam'), 'eligible rows');
    assert(!sleepButton('Clients') && !sleepButton('Inbox'), 'active rows have no icon');
    assert(!sleepButton('Unused').children.length && getComputedStyle(sleepButton('Unused'), '::before').maskImage.includes('M11'), 'two cached sleep strokes without per-row SVG nodes');
  });
  for (const mode of ['light', 'dark']) await test(mode + ' theme, unfilled vector, readable popover and keyboard dismissal', async () => {
    document.documentElement.dataset.gpTheme = mode; app.labelReminders.update({ appearanceTheme: mode });
    sleepButton('Past projects').click(); await settle();
    const popup = document.querySelector('.gmail-pro-label-recency-popover');
    assert(popup?.dataset.gpTheme === mode, 'popover theme');
    assert(getComputedStyle(sleepButton('Past projects'), '::before').maskImage !== 'none', 'sleep vector remains visible');
    assert(getComputedStyle(popup).backgroundColor !== 'rgba(0, 0, 0, 0)', 'opaque themed surface');
    assert(popup.getBoundingClientRect().bottom <= innerHeight, 'popover fits viewport');
    popup.querySelector('button').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await settle();
    assert(!document.querySelector('.gmail-pro-label-recency-popover') && sleepButton('Past projects'), 'Escape closes without dismissal');
  });
  await test('dismiss survives reconciliation and does not navigate or hide', async () => {
    sleepButton('Unused').click(); await settle(); document.querySelector('.gmail-pro-label-recency-actions button').click();
    await eventually(() => !sleepButton('Unused')); app.labelOrder.update({ customLabelOrderEnabled: false }); await settle();
    assert(!sleepButton('Unused') && saved === 0 && navigations === 0, 'dismiss persists and leaves native controls alone');
  });
  await test('an open System-theme popover follows light/dark changes and releases its media listener', async () => {
    const sourceMedia = window.matchMedia, media = new EventTarget(); media.matches = false;
    window.matchMedia = () => media;
    try {
      app.labelReminders.update({ appearanceTheme: 'system' }); sleepButton('Past projects').click(); await settle();
      const popup = document.querySelector('.gmail-pro-label-recency-popover'); assert(popup.dataset.gpTheme === 'light', 'initial System light');
      media.matches = true; media.dispatchEvent(new Event('change')); assert(popup.dataset.gpTheme === 'dark', 'open surface follows System dark');
      closeByEscape(); media.matches = false; media.dispatchEvent(new Event('change'));
      assert(popup.dataset.gpTheme === 'dark', 'closed surface listener was released');
    } finally { window.matchMedia = sourceMedia; app.labelReminders.update({ appearanceTheme: document.documentElement.dataset.gpTheme }); }
  });
  await test('popover Escape preserves the organizer and outside dismissal preserves outside focus', async () => {
    const fixture = setup(); await eventually(() => sleepButton('Unused')); assert(app.labelOrder.edit(), 'organizer open');
    sleepButton('Unused').click(); await settle(); closeByEscape(); await settle();
    assert(host.querySelector('.gmail-pro-label-toolbar') && !document.querySelector('.gmail-pro-label-recency-popover'), 'Escape closes only the popover');
    sleepButton('Unused').click(); await settle(); const popup = document.querySelector('.gmail-pro-label-recency-popover');
    fixture.accountButton.focus(); popup.dispatchEvent(new ToggleEvent('toggle', { newState: 'closed', oldState: 'open' })); await settle();
    assert(document.activeElement === fixture.accountButton, 'outside focus retained');
    setup(); await eventually(() => sleepButton('Unused'));
  });
  await test('fresh review blocks stale hide when recent mail appears', async () => {
    becameActive = true; sleepButton('Past projects').click(); await settle();
    document.querySelector('.gmail-pro-label-recency-actions button:last-child').click();
    await eventually(() => document.querySelector('.gmail-pro-label-recency-status')?.textContent.includes('no longer'));
    assert(saved === 0 && reviewCalls === 1, 'no visibility save');
    document.querySelector('.gmail-pro-label-recency-actions button').click(); becameActive = false;
  });
  await test('verification failure keeps label visible and allows retry', async () => {
    setup(); await eventually(() => sleepButton('Past projects')); failReview = true;
    sleepButton('Past projects').click(); await settle(); document.querySelector('.gmail-pro-label-recency-actions button:last-child').click();
    await eventually(() => document.querySelector('.gmail-pro-label-recency-status')?.textContent.includes('Nothing was hidden'));
    assert(saved === 0 && !document.querySelector('.gmail-pro-label-recency-actions button:last-child').disabled, 'visible and retryable');
    closeByEscape(); failReview = false;
  });
  function closeByEscape() { document.querySelector('.gmail-pro-label-recency-popover')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); }
  await test('Hide saves only sidebar visibility; organizer restores top-level and system rows', async () => {
    sleepButton('Past projects').click(); await settle(); document.querySelector('.gmail-pro-label-recency-actions button:last-child').click();
    await eventually(() => prefs.sidebarHiddenSublabels.some(entry => entry.path === 'label/Past projects'));
    assert(app.labelOrder.edit(), 'organizer opens');
    host.querySelector('.gmail-pro-label-toolbar input').click(); await settle();
    const oldRow = [...host.querySelectorAll('.aim')].find(node => node.querySelector('a')?.textContent === 'Past projects');
    oldRow.querySelector('.gmail-pro-label-eye').click(); await settle();
    assert(!prefs.sidebarHiddenSublabels.length, 'root restored');
    const spam = [...host.querySelectorAll('.aim')].find(node => node.querySelector('a')?.textContent === 'Spam');
    assert(spam.querySelector('.gmail-pro-label-eye') && !spam.querySelector('.gmail-pro-label-handle'), 'system has visibility, no new reorder handle');
    spam.querySelector('.gmail-pro-label-eye').click(); await settle();
    assert(prefs.sidebarHiddenSublabels.some(entry => entry.path === 'mailbox/spam'), 'system hidden');
    spam.querySelector('.gmail-pro-label-eye').click(); await settle(); assert(!prefs.sidebarHiddenSublabels.length, 'system restored');
  });
  await test('a parent zz suggestion hides and restores children at every depth', async () => {
    const fixture = setup(); await eventually(() => sleepButton('Unused'));
    const old = metadata.get('parent').latestAt;
    metadata.set('child', { known: true, latestAt: old, checkedAt: Date.now() });
    raw.push({ id: 'grandchild', name: 'Clients/Active project/Grandchild', type: 'user' });
    metadata.set('grandchild', { known: true, latestAt: old, checkedAt: Date.now() });
    const grandchild = row('Grandchild', 'label/Clients%2FActive%20project%2FGrandchild', 2);
    fixture.list.children[1].after(grandchild);
    await eventually(() => sleepButton('Clients'), 'parent suggestion includes descendants');
    sleepButton('Clients').click(); await settle(); document.querySelector('.gmail-pro-label-recency-actions button:last-child').click();
    await eventually(() => prefs.sidebarHiddenSublabels.some(entry => entry.path === 'label/Clients'));
    const branch = [...fixture.list.children].slice(0, 3);
    assert(branch.every(node => getComputedStyle(node).display === 'none'), 'parent, child and grandchild hidden');
    assert(app.labelOrder.edit(), 'organizer opens'); host.querySelector('.gmail-pro-label-toolbar input').click(); await settle();
    branch[0].querySelector('.gmail-pro-label-eye').click(); await settle();
    assert(branch.every(node => getComputedStyle(node).display !== 'none') && !prefs.sidebarHiddenSublabels.length, 'whole branch restored');
  });
  await test('account changes and all-off remove controls without further scans', async () => {
    const fixture = setup(); await eventually(() => sleepButton('Unused'));
    fixture.accountButton.setAttribute('aria-label', 'Google Account: Other (other@example.test)'); await settle(); await settle();
    assert(!host.querySelector('.gmail-pro-label-sleep'), 'other account has no suggestions');
    fixture.accountButton.setAttribute('aria-label', 'Google Account: One (one@example.test)'); await eventually(() => sleepButton('Unused'));
    const off = Object.fromEntries(R.months.map(month => [R.setting(month), false])); Object.assign(prefs, off); app.labelReminders.update(off); await settle();
    const calls = statusCalls; app.labelOrder.update({ customLabelOrderEnabled: false }); await settle();
    assert(!host.querySelector('.gmail-pro-label-sleep') && statusCalls === calls, 'all off stays idle');
  });
  await test('AI layout can reopen the organizer and restore Inbox after Inbox is hidden', async () => {
    const fixture = setup(); await eventually(() => sleepButton('Unused'));
    const nav = host.querySelector('nav'), section = host.querySelector('section'), system = nav.querySelector('.system');
    const aiInbox = row('AI Inbox', 'aiinbox'); system.prepend(aiInbox);
    const inbox = [...system.children].find(node => node.querySelector('a')?.textContent === 'Inbox');
    app.labelOrder.setMailboxes({ root: nav, list: fixture.list, labels: section, aiInbox, inbox });
    fixture.list.style.display = 'contents'; await settle();
    assert(await app.labelOrder.setSidebarVisibility('mailbox/inbox', true, account), 'Inbox hidden');
    assert(app.labelOrder.edit(), 'organizer opens independently of hidden Inbox/display:contents');
    host.querySelector('.gmail-pro-label-toolbar input').click(); await settle();
    inbox.querySelector('.gmail-pro-label-eye').click(); await settle();
    assert(!prefs.sidebarHiddenSublabels.some(entry => entry.path === 'mailbox/inbox'), 'Inbox restored');
  });
  await test('500-label sidebar renders only nearby controls, scrolls from cache and cleans up', async () => {
    const started = performance.now(); setup(500);
    host.style.maxHeight = '480px'; host.style.overflow = 'auto';
    await eventually(() => sleepButton('Project 0'), 'visible controls render');
    assert(host.querySelectorAll('.gmail-pro-label-sleep').length < 30 && !sleepButton('Project 499'), 'offscreen controls stay unmounted');
    const calls = statusCalls; host.scrollTop = host.scrollHeight;
    await eventually(() => sleepButton('Project 499'), 'offscreen control appears when scrolled into view');
    assert(statusCalls === calls && host.querySelectorAll('.gmail-pro-label-sleep').length < 30, 'scrolling uses cached suggestions and bounded controls');
    const elapsed = Math.round(performance.now() - started);
    assert(host.querySelectorAll('.aim .count').length === 506, 'unread counts remain intact');
    app.labelReminders.stop(); app.labelOrder.stop(); await settle();
    assert(!host.querySelector('.gmail-pro-label-sleep') && runtime.size === 0, 'complete cleanup');
    output('MEASURE 500-label startup/decorate wall time: ' + elapsed + ' ms (includes native fixture construction)');
  });
  result.textContent = reports.join('\n') + '\n\n' + reports.filter(line => line.startsWith('PASS')).length + '/' + reports.filter(line => /^(PASS|FAIL)/.test(line)).length + ' checks passed';
  result.dataset.failures = String(reports.filter(line => line.startsWith('FAIL')).length);
})();
