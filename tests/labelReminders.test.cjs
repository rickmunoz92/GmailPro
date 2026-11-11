'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const R = require('../shared/labelRecency.js');
const root = path.resolve(__dirname, '..'), key = 'gmailPro.labelReminders.v1';
const allOn = Object.fromEntries(R.months.map(month => [R.setting(month), true]));
const rawLabel = (id, name, type = 'user') => ({ id, name, type });
const now = new Date(2026, 10, 10, 12).getTime();
function leaf(latestAt, children = 0) { return { known: true, latestAt, children }; }

test('calendar milestones clamp month ends, choose highest enabled tier, and respect exact boundaries', () => {
  const at = new Date(2026, 0, 31, 12).getTime(), end = new Date(2026, 3, 30, 12).getTime();
  assert.equal(R.anniversary(at, 3), end);
  assert.equal(R.suggestion(leaf(at), allOn, null, end - 1), null);
  assert.equal(R.suggestion(leaf(at), allOn, null, end).milestone, 3);
  const old = leaf(new Date(2025, 0, 1).getTime());
  assert.equal(R.suggestion(old, allOn, null, now).milestone, 12);
  assert.equal(R.suggestion(old, { ...allOn, labelReminder12MonthsEnabled: false }, null, now).milestone, 6);
  assert.equal(R.anniversary(new Date(2024, 1, 29).getTime(), 12), new Date(2025, 1, 28).getTime());
});
test('dismissals suppress earlier tiers, allow later tiers, and reset only for newer email dates', () => {
  const latestAt = new Date(2026, 2, 1).getTime(), label = leaf(latestAt);
  const dismissed = R.dismissal({ kind: 'age', milestone: 3, latestAt });
  assert.equal(R.suggestion(label, allOn, dismissed, new Date(2026, 6, 1).getTime()), null);
  assert.equal(R.suggestion(label, allOn, dismissed, now).milestone, 6);
  const final = R.dismissal({ kind: 'age', milestone: 12, latestAt });
  assert.equal(R.suggestion(label, allOn, final, new Date(2028, 0, 1).getTime()), null);
  assert.equal(R.suggestion(leaf(latestAt - 1), allOn, final, now), null);
  assert.equal(R.suggestion(leaf(latestAt + 1), allOn, final, now).milestone, 6);
});
test('every descendant rolls up, hidden status is irrelevant, and unknown children block parent suggestions', () => {
  const labels = R.catalog([rawLabel('a', 'Parent'), rawLabel('b', 'Parent/Child'), rawLabel('c', 'Parent/Child/Grandchild')]);
  const records = new Map([['a', { known: true, latestAt: null, checkedAt: now }], ['b', { known: true, latestAt: null, checkedAt: now }],
    ['c', { known: true, latestAt: now, checkedAt: now }]]);
  let rolled = R.rollup(labels, records);
  assert.equal(rolled.get('a').latestAt, now); assert.equal(R.suggestion(rolled.get('a'), allOn, null, now), null);
  records.delete('c'); rolled = R.rollup(labels, records);
  assert.equal(rolled.get('a').known, false); assert.equal(R.suggestion(rolled.get('a'), allOn, null, now), null);
  const deep = Array.from({ length: 90 }, (_, i) => rawLabel('deep_' + i, Array(i + 1).fill('x').join('/')));
  const values = new Map(deep.map((label, i) => [label.id, { known: true, latestAt: i === 89 ? now : null, checkedAt: now }]));
  assert.equal(R.rollup(R.catalog(deep), values).get('deep_0').latestAt, now);
});
test('empty leaves prompt immediately, empty parents stay visible, and all-off suppresses every kind', () => {
  assert.equal(R.suggestion(leaf(null), allOn, null, now).kind, 'empty');
  assert.equal(R.suggestion(leaf(null, 1), allOn, null, now), null);
  assert.equal(R.suggestion(leaf(null), allOn, { empty: true }, now), null);
  const off = Object.fromEntries(R.months.map(month => [R.setting(month), false]));
  assert.equal(R.suggestion(leaf(null), off, null, now), null);
  assert.equal(R.suggestion(leaf(1), off, null, now), null);
});
test('catalog preserves full names and stable IDs, distinguishes branches, and rejects malformed input', () => {
  const labels = R.catalog([rawLabel('a', 'A'), rawLabel('b', 'A/Child'), rawLabel('c', 'AB/Child'), rawLabel('INBOX', 'INBOX', 'system')]);
  assert.equal(labels.find(label => label.id === 'b').parentId, 'a');
  assert.equal(labels.find(label => label.id === 'c').parentId, null);
  assert.equal(labels.find(label => label.id === 'INBOX').path, 'mailbox/inbox');
  assert.equal(R.sidebarPath('#label/A%2FChild'), 'label/A/Child'); assert.equal(R.sidebarPath('#imp'), 'mailbox/important');
  assert.equal(R.sidebarPath('#aiinbox'), null); assert.equal(R.sidebarPath('#search/anything'), null);
  assert.throws(() => R.catalog([rawLabel('a', 'A'), rawLabel('a', 'B')]));
  assert.throws(() => R.catalog([rawLabel('../bad', 'A')]));
});

function workerFixture(raw = [rawLabel('a', 'Parent'), rawLabel('b', 'Parent/Child')], initial) {
  const data = {}, calls = [], changes = new Set(), listeners = new Set(), sync = {}, responses = new Map();
  let labels = raw, accepted = true, account = 'one@example.test', failWrite = false, failLabel, failStatus = 404, current = 0, peak = 0, tokenCalls = 0;
  let consentGate, settingsGate, tokenError;
  const messages = new Map(raw.map(label => [label.id, { id: 'message_' + label.id, at: Date.now() - 400 * 86400000 }]));
  const state = initial || { account, labels: R.catalog(raw), records: [], dismissed: [], catalogAt: Date.now(), refreshAt: 0 };
  data[key] = structuredClone(state);
  const chrome = { runtime: { id: 'ours', getURL: value => 'chrome-extension://ours/' + value,
    getManifest: () => ({ oauth2: { client_id: '123-fixture.apps.googleusercontent.com' } }),
    onMessage: { addListener: fn => listeners.add(fn) }, sendMessage: async () => {} },
    permissions: { contains: async () => true },
    identity: { getAuthToken: async () => { tokenCalls++; if (tokenError) throw new Error(tokenError); return { token: 'fixture-token' }; }, removeCachedAuthToken: async () => {}, clearAllCachedAuthTokens: async () => {} },
    tabs: { query: async () => [], sendMessage: async () => {} },
    storage: { local: { setAccessLevel: async () => {}, get: async () => structuredClone(data),
      set: async patch => { if (failWrite) throw new Error('Storage full'); Object.assign(data, structuredClone(patch)); } },
      sync: { get: async () => { const value = structuredClone(sync); if (settingsGate) await settingsGate; return value; }, set: async patch => Object.assign(sync, patch) },
      onChanged: { addListener: fn => changes.add(fn), removeListener: fn => changes.delete(fn) } } };
  const context = vm.createContext({ chrome, TextEncoder, URL, AbortController, AbortSignal, DOMException, setTimeout, clearTimeout,
    crypto: require('node:crypto').webcrypto, GmailProConsentWorker: { status: async () => { const value = { accepted }; if (consentGate) await consentGate; return value; } },
    async fetch(url, init) {
      calls.push({ url: new URL(url), init }); current++; peak = Math.max(peak, current);
      try {
        await new Promise(resolve => setTimeout(resolve, 2));
        if (init.signal.aborted) throw new DOMException('Cancelled', 'AbortError');
        const u = new URL(url), route = u.pathname.split('/users/me/')[1]; let body;
        const responseKey = route === 'messages' ? 'label:' + u.searchParams.get('labelIds') : route;
        if (responses.has(responseKey)) return new Response(responses.get(responseKey), { status: 200, headers: { 'Content-Type': 'application/json' } });
        if (route === 'profile') body = { emailAddress: account };
        else if (route === 'labels') body = { labels };
        else if (route === 'messages') {
          const id = u.searchParams.get('labelIds');
          if (id === failLabel) return { ok: false, status: failStatus, headers: new Headers() };
          const message = messages.get(id);
          // A partial response selecting only a missing messages array can be
          // bodyless. The explicit zero-result field keeps empty queries JSON.
          if (!message && !u.searchParams.get('fields')?.includes('resultSizeEstimate')) return new Response('', { status: 200 });
          body = message ? { messages: [{ id: message.id }], resultSizeEstimate: 1 } : { resultSizeEstimate: 0 };
        } else if (route.startsWith('messages/')) {
          const message = [...messages.values()].find(value => value.id === route.slice(9)); body = { internalDate: String(message?.at) };
        } else throw new Error('Unexpected endpoint');
        return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
      } finally { current--; }
    }
  });
  for (const file of ['shared/settings.js', 'shared/labelRecency.js', 'background/labelReminders.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
  }
  const popup = { id: 'ours', url: chrome.runtime.getURL('popup/popup.html') };
  const gmail = { id: 'ours', url: 'https://mail.google.com/mail/u/0/', frameId: 0, tab: { id: 1 } };
  const paths = state.labels.map(label => label.path);
  const send = (action, extra = {}, sender = gmail) => new Promise(resolve => {
    const message = { type: 'gmail-pro-label-reminders', account: state.account, paths, action, ...extra };
    for (const listener of listeners) if (listener(message, sender, resolve) === true) return;
    throw new Error('No worker listener');
  });
  return { data, calls, messages, send, popup, gmail, get peak() { return peak; }, get tokenCalls() { return tokenCalls; },
    setLabels(value) { labels = value; }, setAccount(value) { account = value; }, failLabel(value, status = 404) { failLabel = value; failStatus = status; },
    failWrites() { failWrite = true; }, failToken(message) { tokenError = message; }, setResponse(route, body) { responses.set(route, body); },
    revoke() { accepted = false; for (const fn of changes) fn({ 'gmailPro.consent.v1': {} }, 'local'); },
    holdConsent(gate) { consentGate = gate; }, holdSettings(gate) { settingsGate = gate; },
    setMilestone(month, value) { const name = 'gmailPro.v1.' + R.setting(month); sync[name] = value;
      for (const fn of changes) fn({ [name]: { newValue: value } }, 'sync'); },
    disable() { for (const month of R.months) sync['gmailPro.v1.' + R.setting(month)] = false;
      for (const fn of changes) fn(Object.fromEntries(Object.keys(sync).map(name => [name, { newValue: false }])), 'sync'); } };
}
test('worker checks existing mail retroactively, returns no tokens/message IDs, and uses only bounded metadata reads', async () => {
  const f = workerFixture(); const result = await f.send('scan');
  assert.equal(result.ok, true); assert.equal(result.pending, 0);
  assert.equal(result.results.find(value => value.path === 'label/Parent').milestone, 12);
  assert.ok(f.peak <= 4);
  for (const call of f.calls) {
    assert.equal(call.url.origin, 'https://gmail.googleapis.com'); assert.equal(call.init.credentials, 'omit');
    if (call.url.pathname.endsWith('/messages')) assert.equal(call.url.searchParams.get('maxResults'), '1');
    if (call.url.pathname.includes('/messages/')) {
      assert.equal(call.url.searchParams.get('fields'), 'internalDate'); assert.equal(call.url.searchParams.get('format'), 'metadata');
    }
  }
  assert.ok(!JSON.stringify(result).includes('fixture-token')); assert.ok(!JSON.stringify(result).includes('message_a'));
  const count = f.calls.length; await f.send('status'); assert.equal(f.calls.length, count, 'warm refresh makes no API calls');
});
test('worker rejects foreign senders and account mismatches before reading Google data', async () => {
  const f = workerFixture();
  for (const sender of [{ ...f.gmail, id: 'other' }, { ...f.gmail, frameId: 1 }, { ...f.gmail, url: 'https://mail.google.com.evil/' }]) {
    assert.equal((await f.send('scan', {}, sender)).ok, false);
  }
  const mismatched = await f.send('scan', { account: 'other@example.test' });
  assert.equal(mismatched.mismatch, true); assert.equal(Object.hasOwn(mismatched, 'account'), false);
  assert.equal(f.calls.length, 0);
  assert.equal((await f.send('connect')).ok, false);
  f.setAccount('other@example.test'); assert.equal((await f.send('scan')).ok, false);
  assert.ok(f.calls.every(call => call.url.pathname.endsWith('/profile')));
});
test('a Google account-policy rejection leaves reminders disconnected and explains the feature boundary', async () => {
  const f = workerFixture([], { account: '', labels: [], records: [], dismissed: [], catalogAt: 0, refreshAt: 0 });
  f.failToken("OAuth2 request failed: Service responded with error: 'Service has been disabled for this account.'");
  const result = await f.send('connect', {}, f.popup);
  assert.equal(result.ok, false);
  assert.match(result.error, /Google blocked this account/);
  assert.match(result.error, /may need administrator approval/);
  assert.match(result.error, /other Gmail Pro features still work/);
  assert.ok(!result.error.includes('OAuth2'));
  assert.equal(f.calls.length, 0, 'no Gmail API requests precede authorization');
  const status = await f.send('status', {}, f.popup);
  assert.equal(status.ok, true); assert.equal(status.connected, false);
  assert.equal(f.data[key].account, '', 'a failed connection cannot persist an authorized account');
});
test('empty message queries return a zero-result indicator rather than a bodyless partial response', async () => {
  const f = workerFixture([rawLabel('a', 'Empty')]); f.messages.clear();
  const result = await f.send('scan');
  assert.equal(result.ok, true);
  assert.equal(result.results.find(label => label.path === 'label/Empty').kind, 'empty');
  assert.ok(f.calls.filter(call => call.url.pathname.endsWith('/messages')).every(call =>
    call.url.searchParams.get('fields') === 'messages(id),resultSizeEstimate'));
  assert.ok(!f.calls.some(call => call.url.pathname.includes('/messages/')), 'empty labels need no message-date request');
});
test('bodyless or incomplete message responses remain unknown and cannot create false empty suggestions', async () => {
  for (const body of ['', '{}', '{"resultSizeEstimate":4}']) {
    const f = workerFixture(); f.setResponse('label:b', body);
    const result = await f.send('scan');
    assert.equal(result.ok, true); assert.ok(result.notice);
    assert.ok(!result.results.some(label => ['label/Parent', 'label/Parent/Child'].includes(label.path)));
    assert.equal(f.data[key].records.find(record => record.id === 'b').known, false);
  }
});
test('an unreadable account response reports its stage and cannot save a Google connection', async () => {
  const f = workerFixture([], { account: '', labels: [], records: [], dismissed: [], catalogAt: 0, refreshAt: 0 });
  f.setResponse('profile', '');
  const result = await f.send('connect', {}, f.popup);
  assert.equal(result.ok, false); assert.match(result.error, /unreadable response while verifying the Google account/);
  assert.equal(f.data[key].account, '');
});
test('fresh branch verification discovers newly created recent grandchildren before allowing Hide', async () => {
  const f = workerFixture(); await f.send('scan');
  const extra = rawLabel('c', 'Parent/Child/Grandchild');
  f.setLabels([rawLabel('a', 'Parent'), rawLabel('b', 'Parent/Child'), extra]);
  f.messages.set('c', { id: 'message_c', at: Date.now() });
  const result = await f.send('review', { path: 'label/Parent' });
  assert.equal(result.ok, true); assert.equal(result.reviewed, true); assert.equal(result.candidate, null);
});
test('empty dismissal survives refresh and resets after a confirmed nonempty observation', async () => {
  const f = workerFixture([rawLabel('a', 'Empty')]); f.messages.delete('a');
  await f.send('scan'); await f.send('dismiss', { path: 'label/Empty' });
  assert.ok(!(await f.send('status')).results.some(value => value.path === 'label/Empty'));
  f.messages.set('a', { id: 'new_message', at: Date.now() }); await f.send('scan', { force: true }, f.popup);
  assert.ok(!f.data[key].dismissed.some(record => record.id === 'a'));
  f.messages.delete('a'); const result = await f.send('scan', { force: true }, f.popup);
  assert.equal(result.results.find(value => value.path === 'label/Empty').kind, 'empty');
});
test('failed descendant reads suppress parents and schedule a five-minute retry', async () => {
  const f = workerFixture(); f.failLabel('b'); const result = await f.send('scan');
  assert.equal(result.ok, true); assert.ok(!result.results.some(value => value.path === 'label/Parent'));
  assert.ok(result.notice); assert.ok(result.nextCheckAt <= Date.now() + 5 * 60 * 1000);
});
test('all-off and withdrawn consent stop work, and storage errors are reported', async () => {
  const off = workerFixture(); off.disable();
  const result = await off.send('scan'); assert.equal(result.enabled, false); assert.equal(result.pending, 0); assert.equal(off.calls.length, 0);
  const revoked = workerFixture(); revoked.revoke(); assert.equal((await revoked.send('scan')).ok, false); assert.equal(revoked.calls.length, 0);
  const storage = workerFixture(); storage.failWrites(); assert.equal((await storage.send('scan')).ok, false);
});
test('concurrent tabs share a scan and a retained latest message ID avoids redundant date reads', async () => {
  const f = workerFixture();
  const [one, two] = await Promise.all([f.send('scan'), f.send('scan', {}, { ...f.gmail, tab: { id: 2 } })]);
  assert.equal(one.ok, true); assert.equal(two.ok, true);
  assert.equal(f.calls.filter(call => call.url.pathname.endsWith('/profile')).length, 1);
  const count = f.calls.filter(call => call.url.pathname.includes('/messages/')).length;
  await f.send('scan', { force: true }, f.popup);
  assert.equal(f.calls.filter(call => call.url.pathname.includes('/messages/')).length, count);
});

test('large branches resume bounded chunks and are not classified before every descendant is known', async () => {
  const labels = [rawLabel('root', 'Root'), ...Array.from({ length: 23 }, (_, index) => rawLabel('child_' + index, 'Root/Child ' + index))];
  const f = workerFixture(labels);
  let result = await f.send('scan'); assert.ok(result.pending > 0);
  assert.ok(!result.results.some(row => row.path === 'label/Root'));
  while (result.pending) result = await f.send('scan');
  assert.equal(result.results.find(row => row.path === 'label/Root').milestone, 12);
  result = await f.send('review', { path: 'label/Root' }); assert.ok(result.reviewPending > 0);
  const first = result.reviewId;
  result = await f.send('review', { path: 'label/Root', reviewId: first });
  assert.equal(result.reviewed, true); assert.equal(result.candidate.milestone, 12);
  assert.ok(f.peak <= 4);
});
test('revocation while a scan is in flight aborts it without saving new metadata', async () => {
  const f = workerFixture(); const before = JSON.stringify(f.data[key]);
  const scanning = f.send('scan');
  await new Promise(resolve => setTimeout(resolve, 15)); f.revoke();
  const result = await scanning; assert.equal(result.ok, false);
  assert.equal(JSON.stringify(f.data[key]), before);
});
test('closing the last Gmail client cancels its active chunk without storing partial results', async () => {
  const f = workerFixture(); const before = JSON.stringify(f.data[key]);
  const scanning = f.send('scan');
  await new Promise(resolve => setTimeout(resolve, 15)); const detached = f.send('detach');
  assert.equal((await scanning).ok, false); assert.equal((await detached).ok, true);
  assert.equal(JSON.stringify(f.data[key]), before);
});
test('malformed local metadata cannot create false empty-label suggestions', async () => {
  for (const metadata of [{ latestAt: 'invalid' }, { latestAt: null, messageId: 'message_a' }]) {
    const f = workerFixture([rawLabel('a', 'A')], { account: 'one@example.test', labels: [{ id: 'a', type: 'user', name: 'A', path: 'label/A', parentId: null }],
      records: [{ id: 'a', known: true, ...metadata, checkedAt: Date.now() }], dismissed: [] });
    const result = await f.send('status'); assert.equal(result.connected, false); assert.equal(result.results.length, 0);
    assert.equal(f.calls.length, 0);
  }
});
test('service errors pause the account instead of starting another scan for each remaining label', async () => {
  const f = workerFixture(); f.failLabel('b', 503);
  const result = await f.send('scan'); assert.equal(result.ok, false); assert.ok(result.retryAt >= Date.now() + 290000);
  const count = f.calls.length, next = await f.send('scan');
  assert.equal(next.ok, true); assert.ok(next.retryAt > Date.now()); assert.equal(f.calls.length, count);
});
test('a stale agreement read cannot restart Google requests after withdrawal', async () => {
  const f = workerFixture(); let resume;
  f.holdConsent(new Promise(resolve => { resume = resolve; }));
  const checking = f.send('scan'); await new Promise(setImmediate); f.revoke(); resume();
  assert.equal((await checking).ok, false); assert.equal(f.calls.length, 0);
});
test('a switch change arriving during a settings read defeats the older settings snapshot', async () => {
  const labels = R.catalog([rawLabel('a', 'A')]), at = Date.now();
  const f = workerFixture([rawLabel('a', 'A')], { account: 'one@example.test', labels, catalogAt: at, refreshAt: 0,
    records: labels.map((label, index) => ({ id: label.id, known: true, latestAt: label.id === 'a' ? at - 120 * 86400000 : at,
      messageId: 'cached_' + index, checkedAt: at })), dismissed: [] });
  let resume; f.holdSettings(new Promise(resolve => { resume = resolve; }));
  const checking = f.send('status'); await new Promise(setImmediate); f.setMilestone(3, false); resume();
  const result = await checking; assert.equal(result.ok, true); assert.equal(result.connected, true); assert.equal(result.enabled, true);
  assert.ok(!result.results.some(row => row.path === 'label/A')); assert.equal(f.calls.length, 0);
});
