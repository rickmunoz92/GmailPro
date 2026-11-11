'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const vm = require('node:vm'), fs = require('node:fs'), path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../content/content.js'), 'utf8');
function fixture({ accepted = true, required = true } = {}) {
  let settingsChanged, licenseChanged, consentChanged, pagehide, nextStatus = { active: false }, visibility;
  let nextConsent = { accepted }, settingsReads = 0, licenseReads = 0;
  const starts = [], updates = [], stops = [], timers = new Map();
  const settings = { autoBccEnabled: true, bccAddress: 'archive@example.com', appleMailModeEnabled: true };
  const app = { settings: { subscribe: fn => { settingsChanged = fn; return () => {}; }, load: async () => { settingsReads++; return settings; } },
    consent: { subscribe: fn => { consentChanged = fn; return () => {}; }, getStatus: async () =>
      typeof nextConsent === 'function' ? nextConsent() : nextConsent },
    debug: { log() {} }, entitlement: { subscribe: fn => { licenseChanged = fn; return () => {}; }, getStatus: async () =>
      { licenseReads++; return typeof nextStatus === 'function' ? nextStatus() : nextStatus; } } };
  for (const name of ['autoBcc', 'reverseThreads', 'messageList', 'autoPaging', 'appearance', 'headerLayout', 'readingPane',
    'floatingCompose', 'keyboardShortcuts', 'messageZoom', 'labelOrder', 'labelReminders', 'workspaceLayout']) app[name] = {
      start: data => starts.push({ name, data: structuredClone(data) }),
      update: data => updates.push({ name, data: structuredClone(data) }), stop: () => stops.push(name) };
  const context = vm.createContext({ GmailPro: app, GmailProBillingConfig: { required },
    setTimeout: (fn, ms) => { const id = timers.size + 1; timers.set(id, { fn, ms }); return id; }, clearTimeout: id => timers.delete(id),
    document: { visibilityState: 'visible', addEventListener: (_name, fn) => { visibility = fn; }, removeEventListener() {} },
    window: { addEventListener: (_name, fn) => { pagehide = fn; } } });
  vm.runInContext(source, context); app.startAutoBcc();
  return { app, starts, updates, stops, timers, settings, settle: () => new Promise(setImmediate),
    change: patch => settingsChanged(patch), setStatus: value => { nextStatus = value; }, check: () => licenseChanged(),
    setConsent: value => { nextConsent = value; }, consent: () => consentChanged(),
    get settingsReads() { return settingsReads; }, get licenseReads() { return licenseReads; },
    hide: () => pagehide(), focus: () => visibility() };
}
test('no module starts without entitlement, saved changes survive activation, expiry restores Gmail', async () => {
  const f = fixture(); await f.settle(); assert.equal(f.starts.length, 0);
  f.change({ bccAddress: 'new@example.com' }); assert.equal(f.updates.length, 0);
  f.setStatus({ active: true, validUntil: Date.now() + 86400000 }); await f.check();
  assert.equal(f.starts.length, 13); assert.ok(f.starts.every(value => value.data.bccAddress === 'new@example.com'));
  assert.equal(f.settings.bccAddress, 'archive@example.com', 'no saved preference was erased');
  f.setStatus({ active: false, validUntil: Date.now() }); await f.check();
  assert.equal(f.stops.length, 13); assert.ok(f.stops.includes('labelOrder'));
  assert.equal(f.timers.size, 0);
});
test('a stale active response cannot override a newer inactive result or navigation', async () => {
  const f = fixture(); await f.settle(); let resolve;
  f.setStatus(() => new Promise(done => { resolve = done; })); const old = f.check();
  f.setStatus({ active: false }); await f.check(); resolve({ active: true, validUntil: Date.now() + 86400000 }); await old;
  assert.equal(f.starts.length, 0);
  f.setStatus(() => new Promise(done => { resolve = done; })); const late = f.check(); f.hide();
  resolve({ active: true, validUntil: Date.now() + 86400000 }); await late;
  assert.equal(f.starts.length, 0);
});
test('already-expired active responses never start features; transport failure stops running modules', async () => {
  const f = fixture(); await f.settle();
  f.setStatus({ active: true, validUntil: Date.now() - 1 }); await f.check(); assert.equal(f.starts.length, 0);
  f.setStatus({ active: true, validUntil: Date.now() + 50000 }); await f.check(); assert.equal(f.starts.length, 13);
  f.setStatus(() => Promise.reject(new Error('unavailable'))); await f.check(); assert.equal(f.stops.length, 13);
});
test('missing agreement blocks settings, automatic license requests and every feature, including the owner build', async () => {
  for (const required of [true, false]) {
    const f = fixture({ accepted: false, required }); await f.settle();
    assert.equal(f.settingsReads, 0); assert.equal(f.licenseReads, 0); assert.equal(f.starts.length, 0);
    f.setStatus({ active: true, validUntil: Date.now() + 50000 });
    f.setConsent({ accepted: true }); await f.consent(); await f.settle();
    assert.equal(f.starts.length, 13);
    f.setConsent({ accepted: false }); await f.consent();
    assert.equal(f.stops.length, 13); assert.equal(f.timers.size, 0);
    assert.equal(f.settings.bccAddress, 'archive@example.com', 'withdrawal preserves saved preferences');
  }
});
test('withdrawal defeats an in-flight license response and failed consent reads pause features', async () => {
  const f = fixture(); await f.settle(); let resolve;
  f.setStatus(() => new Promise(done => { resolve = done; })); const checking = f.check();
  f.setConsent({ accepted: false }); await f.consent();
  resolve({ active: true, validUntil: Date.now() + 50000 }); await checking;
  assert.equal(f.starts.length, 0);
  f.setStatus({ active: true, validUntil: Date.now() + 50000 });
  f.setConsent({ accepted: true }); await f.consent(); await f.settle();
  assert.equal(f.starts.length, 13);
  f.setConsent(() => Promise.reject(new Error('storage unavailable'))); await f.consent();
  assert.equal(f.stops.length, 13);
});
test('late settings and agreement reads cannot restart features after withdrawal or navigation', async () => {
  const f = fixture({ accepted: false }); await f.settle(); let settingsDone, consentDone;
  f.app.settings.load = () => new Promise(done => { settingsDone = done; });
  f.setStatus({ active: true, validUntil: Date.now() + 50000 });
  f.setConsent({ accepted: true }); await f.consent();
  f.setConsent({ accepted: false }); await f.consent(); settingsDone(f.settings); await f.settle();
  assert.equal(f.starts.length, 0);
  f.setConsent(() => new Promise(done => { consentDone = done; })); const late = f.consent();
  f.hide(); consentDone({ accepted: true }); await late; assert.equal(f.starts.length, 0);
});

test('free features start only after agreement, without license reads, leases or polling', async () => {
  const f = fixture({ accepted: false, required: false }); await f.settle();
  assert.equal(f.starts.length, 0); assert.equal(f.licenseReads, 0);
  f.setConsent({ accepted: true }); await f.consent(); await f.settle();
  assert.equal(f.starts.length, 13); assert.equal(f.licenseReads, 0); assert.equal(f.timers.size, 0);
  await f.focus(); assert.equal(f.licenseReads, 0);
  f.setConsent({ accepted: false }); await f.consent();
  assert.equal(f.stops.length, 13); assert.equal(f.licenseReads, 0);
});
