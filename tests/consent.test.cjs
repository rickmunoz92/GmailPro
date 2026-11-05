'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const vm = require('node:vm'), fs = require('node:fs'), path = require('node:path');
const legal = require('../shared/legal-config.js');
const key = 'gmailPro.consent.v1', root = path.resolve(__dirname, '..');
function fixture(record) {
  let listener, failWrite = false, hold;
  const data = { [key]: record, 'gmailPro.billing.v1': { licenseKey: 'private' } }, notices = [];
  const chrome = { storage: { local: {
    setAccessLevel: async value => assert.equal(value.accessLevel, 'TRUSTED_CONTEXTS'),
    get: async () => structuredClone(data),
    set: async patch => { if (hold) await hold; if (failWrite) throw new Error('full'); Object.assign(data, patch); },
    remove: async name => { delete data[name]; }
  } }, runtime: { id: 'ours', getURL: route => 'chrome-extension://ours/' + route,
    onMessage: { addListener: fn => { listener = fn; } }, sendMessage: async m => notices.push(m) },
    tabs: { query: async () => [{ id: 1 }], sendMessage: async (_id, m) => notices.push(m) } };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'background/consent.js'), 'utf8'), { chrome, GmailProLegal: legal });
  const popup = { id: 'ours', url: chrome.runtime.getURL('popup/popup.html') };
  const gmail = { id: 'ours', tab: { id: 1 }, frameId: 0, url: 'https://mail.google.com/mail/u/0/' };
  const send = (action, values = {}, sender = popup) => new Promise(resolve => {
    assert.equal(listener({ type: 'gmail-pro-consent', action, ...values }, sender, resolve), true);
  });
  const agreement = { ...legal, adultConfirmed: true, agreed: true };
  return { data, notices, popup, gmail, send, agreement, fail() { failWrite = true; }, hold(promise) { hold = promise; } };
}
test('only the extension popup can accept or withdraw; Gmail sees no credential', async () => {
  const f = fixture();
  for (const sender of [f.gmail, { ...f.gmail, frameId: 1 }, { ...f.popup, id: 'other' },
    { ...f.popup, url: f.popup.url + '?forged' }, { ...f.gmail, url: 'https://mail.google.com.evil/' }]) {
    assert.equal((await f.send('accept', f.agreement, sender)).ok, false);
  }
  assert.equal((await f.send('accept', f.agreement)).status.accepted, true);
  const status = await f.send('status', {}, f.gmail);
  assert.equal(status.status.accepted, true); assert.equal(JSON.stringify(status).includes('private'), false);
  assert.equal((await f.send('withdraw', {}, f.gmail)).ok, false);
});
test('missing, old or malformed records and unchecked or stale agreement fail closed', async () => {
  for (const record of [undefined, {}, { termsVersion: 'old' }, { ...legal, acceptedAt: Date.now() + 50000, adultConfirmed: true }]) {
    assert.equal((await fixture(record).send('status')).status.accepted, false);
  }
  const f = fixture();
  for (const patch of [{ agreed: false }, { adultConfirmed: false }, { termsVersion: 'old' }, { privacyVersion: 'old' }]) {
    assert.equal((await f.send('accept', { ...f.agreement, ...patch })).ok, false);
  }
  f.fail(); assert.equal((await f.send('accept', f.agreement)).ok, false);
  assert.equal((await f.send('status')).status.accepted, false);
});
test('withdrawal is serialized after a pending save, preserves billing, and notifies open contexts', async () => {
  const f = fixture(); let finish;
  f.hold(new Promise(done => { finish = done; }));
  const accepting = f.send('accept', f.agreement);
  const withdrawing = f.send('withdraw'); finish(); await accepting; await withdrawing;
  assert.equal((await f.send('status')).status.accepted, false);
  assert.equal(f.data['gmailPro.billing.v1'].licenseKey, 'private');
  assert.ok(f.notices.some(m => m.type === 'gmail-pro-consent-changed'));
});
test('published legal versions link to matching immutable policy snapshots', () => {
  for (const kind of ['terms', 'privacy']) {
    const archive = path.join(root, 'website/public', new URL(legal[kind + 'URL']).pathname + '.html');
    const content = fs.readFileSync(archive, 'utf8');
    assert.match(content, new RegExp(legal[kind + 'Version'].replaceAll('.', '\\.')));
    assert.equal(content, fs.readFileSync(path.join(root, 'website/public', kind + '.html'), 'utf8'));
  }
});
