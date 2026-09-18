"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
const prefix = "gmailPro.v1.";
const plain = (value) => JSON.parse(JSON.stringify(value));

function fixture(initial = {}) {
  const data = { ...initial };
  const listeners = new Set();
  let writes = 0;
  let failure = null;
  const context = vm.createContext({
    chrome: { storage: {
      sync: {
        async get(keys) {
          if (failure) throw failure;
          return Object.fromEntries(keys.filter((key) => key in data).map((key) => [key, data[key]]));
        },
        async set(patch) {
          if (failure) throw failure;
          writes += 1;
          const changes = Object.fromEntries(Object.entries(patch).map(([key, newValue]) => [key, { oldValue: data[key], newValue }]));
          Object.assign(data, patch);
          for (const listener of listeners) listener(changes, "sync");
        }
      },
      onChanged: { addListener: (fn) => listeners.add(fn), removeListener: (fn) => listeners.delete(fn) }
    } }
  });
  const run = (file) => vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), context);
  run("shared/settings.js");
  return { context, run, data, listeners, settings: context.GmailPro.settings,
    get writes() { return writes; }, fail(error) { failure = error; } };
}

test("defaults are safe and startup neither persists nor subscribes", async () => {
  const f = fixture();
  assert.deepEqual(plain(await f.settings.load()), { autoBccEnabled: false, bccAddress: "", newestEmailFirstEnabled: false });
  assert.equal(f.writes, 0);
  assert.equal(f.listeners.size, 0);
});

test("malformed stored values normalize safely without destructive rewrites", async () => {
  const initial = { [prefix + "autoBccEnabled"]: "true", [prefix + "bccAddress"]: "not-an-email", [prefix + "newestEmailFirstEnabled"]: 1 };
  const f = fixture(initial);
  assert.deepEqual(plain(await f.settings.load()), plain(f.settings.defaults));
  assert.deepEqual(f.data, initial);
  assert.equal(f.writes, 0);
});

test("partial saves trim the address and preserve unrelated preferences", async () => {
  const f = fixture({ [prefix + "newestEmailFirstEnabled"]: true, unrelated: "keep" });
  await f.settings.save({ autoBccEnabled: true, bccAddress: " Person+archive@example.com " });
  assert.deepEqual(plain(await f.settings.load()), { autoBccEnabled: true, bccAddress: "Person+archive@example.com", newestEmailFirstEnabled: true });
  assert.equal(f.data.unrelated, "keep");
  assert.equal(f.writes, 1);
  await f.settings.save({});
  assert.equal(f.writes, 1);
});

test("invalid, unknown, and mixed-invalid updates do not write anything", async () => {
  const f = fixture();
  for (const patch of [null, [], { unknown: true }, { autoBccEnabled: "yes" }, { bccAddress: "a@example.com,b@example.com" }, { bccAddress: "a@b..com" }, { autoBccEnabled: true, bccAddress: "bad" }]) {
    await assert.rejects(f.settings.save(patch));
  }
  assert.equal(f.writes, 0);
  assert.deepEqual(f.data, {});
});

test("Chrome storage failures propagate so the UI can offer retry", async () => {
  const f = fixture();
  f.fail(new Error("QUOTA_BYTES"));
  await assert.rejects(f.settings.load(), /QUOTA_BYTES/);
  await assert.rejects(f.settings.save({ newestEmailFirstEnabled: true }), /QUOTA_BYTES/);
  assert.equal(f.writes, 0);
});

test("subscriptions deduplicate, ignore unrelated changes, normalize deletion, and clean up", () => {
  const f = fixture();
  const patches = [];
  const listener = (patch) => patches.push(plain(patch));
  const stop = f.settings.subscribe(listener);
  assert.equal(f.settings.subscribe(listener), stop);
  const stopOther = f.settings.subscribe(() => {});
  assert.equal(f.listeners.size, 1);
  const emit = [...f.listeners][0];
  emit({ [prefix + "autoBccEnabled"]: { newValue: true } }, "local");
  emit({ irrelevant: { newValue: true } }, "sync");
  assert.equal(patches.length, 0);
  emit({ [prefix + "bccAddress"]: { oldValue: "a@example.com" }, [prefix + "autoBccEnabled"]: { newValue: "invalid" } }, "sync");
  assert.deepEqual(patches, [{ autoBccEnabled: false, bccAddress: "" }]);
  stop();
  stop();
  assert.equal(f.listeners.size, 1);
  stopOther();
  assert.equal(f.listeners.size, 0);
});

test("old cleanup cannot remove a newer subscription of the same callback", () => {
  const f = fixture();
  const patches = [];
  const listener = (patch) => patches.push(plain(patch));
  const oldStop = f.settings.subscribe(listener);
  oldStop();
  const newStop = f.settings.subscribe(listener);
  oldStop();
  assert.equal(f.listeners.size, 1);
  const emit = [...f.listeners][0];
  emit({ [prefix + "autoBccEnabled"]: { newValue: true } }, "sync");
  assert.deepEqual(patches, [{ autoBccEnabled: true }]);
  newStop();
  newStop();
  assert.equal(f.listeners.size, 0);
});

test("reloading shared scripts preserves the single settings owner", () => {
  const f = fixture();
  const stop = f.settings.subscribe(() => {});
  f.run("shared/settings.js");
  assert.equal(f.context.GmailPro.settings, f.settings);
  assert.equal(f.listeners.size, 1);
  stop();
});

test("Auto BCC normalizes addresses and thread ordering is inert until enabled", () => {
  const f = fixture();
  f.run("content/gmailSelectors.js");
  f.run("content/autoBcc.js");
  f.run("content/reverseThreads.js");
  const normalize = f.context.GmailPro.autoBcc.normalizeAddress;
  assert.equal(normalize(" Person <Archive+tag@EXAMPLE.com> "), "archive+tag@example.com");
  assert.equal(normalize("first.last@example.com"), "first.last@example.com");
  assert.equal(normalize("bad"), "");
  assert.equal(normalize("a@example.com,b@example.com"), "");
  assert.equal(f.context.GmailPro.reverseThreads.implemented, true);
  f.context.GmailPro.reverseThreads.start({ newestEmailFirstEnabled: false });
  assert.equal(f.listeners.size, 0);
});

test("content startup merges concurrent settings, starts once, and cleans up", async () => {
  const f = fixture();
  let resolveLoad;
  let started;
  let stops = 0;
  let pagehide;
  const patches = [];
  let reverseStarted;
  let reverseStops = 0;
  const reversePatches = [];
  f.context.GmailPro.reverseThreads = { start: value => { reverseStarted = value; }, update: patch => reversePatches.push(plain(patch)), stop: () => reverseStops++ };
  f.context.GmailPro.settings = { ...f.settings, load: () => new Promise(resolve => { resolveLoad = resolve; }) };
  f.context.GmailPro.autoBcc = { start: value => { started = value; }, update: patch => patches.push(plain(patch)), stop: () => stops++ };
  f.context.GmailPro.debug = { log() {} };
  f.context.window = { addEventListener: (event, callback) => { assert.equal(event, "pagehide"); pagehide = callback; } };
  f.run("content/content.js"); f.run("content/content.js");
  [...f.listeners][0]({ [prefix + "autoBccEnabled"]: { newValue: true } }, "sync");
  resolveLoad({ ...f.settings.defaults });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(started, undefined, "Auto BCC must wait for document_idle");
  f.run("content/autoBccStart.js"); f.run("content/autoBccStart.js");
  assert.equal(started.autoBccEnabled, true);
  assert.deepEqual(plain(reverseStarted), plain(started));
  assert.equal(f.listeners.size, 1);
  [...f.listeners][0]({ [prefix + "bccAddress"]: { newValue: "next@example.com" } }, "sync");
  assert.deepEqual(patches, [{ bccAddress: "next@example.com" }]);
  [...f.listeners][0]({ [prefix + "newestEmailFirstEnabled"]: { newValue: true } }, "sync");
  assert.deepEqual(reversePatches, [{ bccAddress: "next@example.com" }, { newestEmailFirstEnabled: true }]);
  pagehide(); assert.equal(f.listeners.size, 0); assert.equal(stops, 1); assert.equal(reverseStops, 1);
});

test("late initial read after navigation cannot activate Auto BCC", async () => {
  const f = fixture();
  let resolveLoad;
  let pagehide;
  let starts = 0;
  f.context.GmailPro.reverseThreads = { start: () => starts++, stop() {} };
  f.context.GmailPro.settings = { ...f.settings, load: () => new Promise(resolve => { resolveLoad = resolve; }) };
  f.context.GmailPro.autoBcc = { start: () => starts++, stop() {} };
  f.context.GmailPro.debug = { log() {} };
  f.context.window = { addEventListener: (_event, callback) => { pagehide = callback; } };
  f.run("content/content.js"); pagehide(); resolveLoad({ ...f.settings.defaults, autoBccEnabled: true });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(starts, 0); assert.equal(f.listeners.size, 0);
});

test("failed settings read leaves Gmail untouched and releases subscription", async () => {
  const f = fixture();
  f.fail(new Error("storage unavailable"));
  let starts = 0;
  f.context.GmailPro.reverseThreads = { start: () => starts++, stop() {} };
  f.context.GmailPro.autoBcc = { start: () => starts++, stop() {} };
  f.context.GmailPro.debug = { log() {} };
  f.context.window = { addEventListener() {} };
  f.run("content/content.js"); await new Promise(resolve => setImmediate(resolve));
  assert.equal(starts, 0); assert.equal(f.listeners.size, 0);
});

for (const idleFirst of [false, true]) test(`early settings owner handles ${idleFirst ? "idle before storage" : "storage before idle"}`, async () => {
  const f = fixture();
  let resolveLoad, pagehide;
  const starts = [], reverseStarts = [];
  f.context.GmailPro.settings = { ...f.settings, load: () => new Promise(resolve => { resolveLoad = resolve; }) };
  f.context.GmailPro.reverseThreads = { start: settings => reverseStarts.push(plain(settings)), update() {}, stop() {} };
  f.context.GmailPro.debug = { log() {} };
  f.context.window = { addEventListener: (_event, fn) => { pagehide = fn; } };
  f.run("content/content.js");
  const idle = () => {
    f.context.GmailPro.autoBcc = { start: settings => starts.push(plain(settings)), update() {}, stop() {} };
    f.run("content/autoBccStart.js"); f.run("content/autoBccStart.js");
  };
  if (idleFirst) idle();
  resolveLoad({ ...f.settings.defaults, newestEmailFirstEnabled: true });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(reverseStarts.length, 1);
  assert.equal(reverseStarts[0].newestEmailFirstEnabled, true);
  if (!idleFirst) {
    assert.equal(starts.length, 0);
    [...f.listeners][0]({ [prefix + "bccAddress"]: { newValue: "updated@example.com" } }, "sync");
    idle();
    assert.equal(starts[0].bccAddress, "updated@example.com", "idle activation uses latest settings");
  }
  assert.equal(starts.length, 1);
  pagehide(); f.run("content/autoBccStart.js");
  assert.equal(starts.length, 1); assert.equal(f.listeners.size, 0);
});
