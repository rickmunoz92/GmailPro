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
    TextEncoder,
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
  context.GmailPro.appearance = { start() {}, update() {}, stop() {} };
  context.GmailPro.keyboardShortcuts = { start() {}, update() {}, stop() {} };
  context.GmailPro.floatingCompose = { start() {}, update() {}, stop() {} };
  context.GmailPro.readingPane = { start() {}, update() {}, stop() {} };
  context.GmailPro.labelOrder = { start() {}, update() {}, stop() {} };
  context.GmailPro.messageZoom = { start() {}, update() {}, stop() {} };
  context.GmailPro.autoPaging = { start() {}, update() {}, stop() {} };
  context.GmailPro.messageList = { start() {}, update() {}, stop() {} };
  return { context, run, data, listeners, settings: context.GmailPro.settings,
    get writes() { return writes; }, fail(error) { failure = error; } };
}

test("defaults are safe and startup neither persists nor subscribes", async () => {
  const f = fixture();
  assert.deepEqual(plain(await f.settings.load()), { appleMailModeEnabled: false, appearanceTheme: "dark", accentColor: "blue", floatingReplyEnabled: true, floatingReplyAllEnabled: true, floatingForwardEnabled: true, archiveShortcutEnabled: true, sendShortcutEnabled: true, undoShortcutEnabled: true, replyAllShortcutEnabled: true, forwardShortcutEnabled: true, autoBccEnabled: false, bccAddress: "", newestEmailFirstEnabled: false, appleMailMessageListEnabled: false, autoPagingEnabled: false, messageZoomEnabled: false, customLabelOrderEnabled: false, customLabelOrder: [] });
  assert.equal(f.writes, 0);
  assert.equal(f.listeners.size, 0);
});

test("malformed stored values normalize safely without destructive rewrites", async () => {
  const initial = { [prefix + "autoBccEnabled"]: "true", [prefix + "bccAddress"]: "not-an-email", [prefix + "newestEmailFirstEnabled"]: 1, [prefix + "appleMailMessageListEnabled"]: "true" };
  const f = fixture(initial);
  assert.deepEqual(plain(await f.settings.load()), plain(f.settings.defaults));
  assert.deepEqual(f.data, initial);
  assert.equal(f.writes, 0);
});

test("partial saves trim the address and preserve unrelated preferences", async () => {
  const f = fixture({ [prefix + "newestEmailFirstEnabled"]: true, unrelated: "keep" });
  await f.settings.save({ autoBccEnabled: true, bccAddress: " Person+archive@example.com " });
  assert.deepEqual(plain(await f.settings.load()), { appleMailModeEnabled: false, appearanceTheme: "dark", accentColor: "blue", floatingReplyEnabled: true, floatingReplyAllEnabled: true, floatingForwardEnabled: true, archiveShortcutEnabled: true, sendShortcutEnabled: true, undoShortcutEnabled: true, replyAllShortcutEnabled: true, forwardShortcutEnabled: true, autoBccEnabled: true, bccAddress: "Person+archive@example.com", newestEmailFirstEnabled: true, appleMailMessageListEnabled: false, autoPagingEnabled: false, messageZoomEnabled: false, customLabelOrderEnabled: false, customLabelOrder: [] });
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
  let pagingStarted, pagingStops = 0;
  const pagingPatches = [];
  f.context.GmailPro.autoPaging = { start: value => { pagingStarted = value; }, update: patch => pagingPatches.push(plain(patch)), stop: () => pagingStops++ };
  let shortcutsStarted, shortcutsStops = 0;
  const shortcutsPatches = [];
  f.context.GmailPro.keyboardShortcuts = { start: value => { shortcutsStarted = value; }, update: patch => shortcutsPatches.push(plain(patch)), stop: () => shortcutsStops++ };
  let readingStarted, readingStops = 0;
  const readingPatches = [];
  f.context.GmailPro.readingPane = { start: value => { readingStarted = value; }, update: patch => readingPatches.push(plain(patch)), stop: () => readingStops++ };
  let appearanceStarted, appearanceStops = 0;
  const appearancePatches = [];
  f.context.GmailPro.appearance = { start: value => { appearanceStarted = value; }, update: patch => appearancePatches.push(plain(patch)), stop: () => appearanceStops++ };
  let zoomStarted, zoomStops = 0;
  const zoomPatches = [];
  f.context.GmailPro.messageZoom = { start: value => { zoomStarted = value; }, update: patch => zoomPatches.push(plain(patch)), stop: () => zoomStops++ };
  let listStarted;
  let listStops = 0;
  const listPatches = [];
  f.context.GmailPro.messageList = { start: value => { listStarted = value; }, update: patch => listPatches.push(plain(patch)), stop: () => listStops++ };
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
  [...f.listeners][0]({ [prefix + "appleMailMessageListEnabled"]: { newValue: true } }, "sync");
  resolveLoad({ ...f.settings.defaults });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(started, undefined, "Auto BCC must wait for document_idle");
  f.run("content/autoBccStart.js"); f.run("content/autoBccStart.js");
  assert.equal(started.autoBccEnabled, true);
  assert.deepEqual(plain(reverseStarted), plain(started));
  assert.equal(listStarted.appleMailMessageListEnabled, true);
  assert.deepEqual(plain(listStarted), plain(started));
  assert.deepEqual(plain(zoomStarted), plain(started));
  assert.deepEqual(plain(appearanceStarted), plain(started));
  assert.deepEqual(plain(readingStarted), plain(started));
  assert.deepEqual(plain(shortcutsStarted), plain(started));
  assert.deepEqual(plain(pagingStarted), plain(started));
  assert.equal(f.listeners.size, 1);
  [...f.listeners][0]({ [prefix + "bccAddress"]: { newValue: "next@example.com" } }, "sync");
  assert.deepEqual(patches, [{ bccAddress: "next@example.com" }]);
  [...f.listeners][0]({ [prefix + "newestEmailFirstEnabled"]: { newValue: true } }, "sync");
  assert.deepEqual(reversePatches, [{ bccAddress: "next@example.com" }, { newestEmailFirstEnabled: true }]);
  assert.deepEqual(listPatches, reversePatches);
  assert.deepEqual(zoomPatches, reversePatches);
  assert.deepEqual(appearancePatches, reversePatches);
  assert.deepEqual(readingPatches, reversePatches);
  assert.deepEqual(shortcutsPatches, reversePatches);
  assert.deepEqual(pagingPatches, reversePatches);
  pagehide(); assert.equal(pagingStops, 1); assert.equal(shortcutsStops, 1); assert.equal(readingStops, 1); assert.equal(appearanceStops, 1); assert.equal(zoomStops, 1); assert.equal(listStops, 1); assert.equal(f.listeners.size, 0); assert.equal(stops, 1); assert.equal(reverseStops, 1);
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

test("message-list preference round-trips independently and resets on sync deletion", async () => {
  const f = fixture({ [prefix + "autoBccEnabled"]: true, [prefix + "newestEmailFirstEnabled"]: true });
  const patches = [];
  const stop = f.settings.subscribe(patch => patches.push(plain(patch)));
  await f.settings.save({ appleMailMessageListEnabled: true });
  const loaded = await f.settings.load();
  assert.equal(loaded.appleMailMessageListEnabled, true);
  assert.equal(loaded.autoBccEnabled, true);
  assert.equal(loaded.newestEmailFirstEnabled, true);
  await assert.rejects(f.settings.save({ appleMailMessageListEnabled: "true" }));
  [...f.listeners][0]({ [prefix + "appleMailMessageListEnabled"]: {} }, "sync");
  assert.deepEqual(patches, [{ appleMailMessageListEnabled: true }, { appleMailMessageListEnabled: false }]);
  stop();
});

for (const cancel of [false, true]) test(`message-list early html bootstrap ${cancel ? "cancels cleanly" : "disconnects after one delivery"}`, () => {
  let deliver;
  let observations = 0, bootstrapDisconnects = 0;
  const active = new Set(), timers = new Set(), events = new Map();
  const classes = new Set();
  const rootElement = { classList: {
    toggle: (name, enabled) => enabled ? classes.add(name) : classes.delete(name),
    remove: name => classes.delete(name)
  } };
  const eventTarget = { addEventListener: (name, fn) => events.set(name, fn), removeEventListener: name => events.delete(name) };
  const document = { documentElement: null, querySelectorAll: () => [], ...eventTarget };
  const context = vm.createContext({ document, window: eventTarget,
    setTimeout: fn => { timers.add(fn); return fn; }, clearTimeout: fn => timers.delete(fn),
    MutationObserver: class {
    constructor(callback) { if (!deliver) { deliver = callback; this.bootstrap = true; } }
    observe(target, options) {
      active.add(this);
      if (this.bootstrap) {
        assert.equal(target, document); assert.deepEqual(plain(options), { childList: true }); observations++;
      }
    }
    disconnect() { active.delete(this); if (this.bootstrap) bootstrapDisconnects++; }
  } });
  const source = fs.readFileSync(path.join(root, "content/messageList.js"), "utf8");
  vm.runInContext(source, context);
  const feature = context.GmailPro.messageList;
  feature.start({ appleMailMessageListEnabled: false });
  assert.equal(observations, 0);
  feature.start({ appleMailMessageListEnabled: true }); feature.start({ appleMailMessageListEnabled: true });
  assert.equal(observations, 1);
  if (cancel) feature.stop();
  document.documentElement = rootElement; deliver();
  assert.equal(classes.has("gmail-pro-message-list"), !cancel);
  assert.equal(bootstrapDisconnects, 1);
  assert.equal(timers.size, cancel ? 0 : 1);
  vm.runInContext(source, context); assert.equal(context.GmailPro.messageList, feature);
  feature.stop(); assert.equal(classes.size, 0);
  assert.equal(active.size, 0); assert.equal(timers.size, 0); assert.equal(events.size, 0);
});

test("label order validates, deduplicates, preserves other settings and handles quota", async () => {
  const f = fixture({ [prefix + "autoBccEnabled"]: true });
  await f.settings.save({ customLabelOrderEnabled: true, customLabelOrder: ["label/B", "label/A", "label/B"] });
  assert.deepEqual(plain((await f.settings.load()).customLabelOrder), ["label/B", "label/A"]);
  assert.equal((await f.settings.load()).autoBccEnabled, true);
  for (const value of [null, "label/A", [1], ["inbox"], Array(501).fill("label/A"), Array(100).fill("label/" + "界".repeat(100))]) {
    await assert.rejects(f.settings.save({ customLabelOrder: value }));
  }
  await f.settings.save({ customLabelOrder: [] });
  assert.deepEqual(plain((await f.settings.load()).customLabelOrder), []);
  const malformed = fixture({ [prefix + "customLabelOrder"]: ["inbox"] });
  assert.deepEqual(plain((await malformed.settings.load()).customLabelOrder), []);
});


test("message zoom toggle round-trips independently; temporary levels are not stored", async () => {
  const f = fixture({ [prefix + "autoBccEnabled"]: true });
  await f.settings.save({ messageZoomEnabled: true });
  assert.equal((await f.settings.load()).messageZoomEnabled, true);
  assert.equal((await f.settings.load()).autoBccEnabled, true);
  await assert.rejects(f.settings.save({messageZoom:125}));
  await assert.rejects(f.settings.save({messageZoomEnabled:"true"}));
});

test("appearance settings validate, sync independently, and reset safely on deletion", async () => {
  const f = fixture({ [prefix + "autoBccEnabled"]: true });
  for (const theme of f.settings.choices.appearanceTheme) {
    for (const accent of f.settings.choices.accentColor) {
      await f.settings.save({ appleMailModeEnabled: true, appearanceTheme: theme, accentColor: accent });
      const value = await f.settings.load();
      assert.equal(value.appearanceTheme, theme);
      assert.equal(value.accentColor, accent);
      assert.equal(value.autoBccEnabled, true);
    }
  }
  for (const patch of [{ appearanceTheme: true }, { accentColor: "#123456" }, { appleMailModeEnabled: 1 }, { appearanceTheme: "auto" }]) {
    await assert.rejects(f.settings.save(patch));
  }
  const changes = [];
  const stop = f.settings.subscribe(patch => changes.push(plain(patch)));
  [...f.listeners][0]({ [prefix + "accentColor"]: {}, [prefix + "appearanceTheme"]: { newValue: "invalid" } }, "sync");
  assert.deepEqual(changes, [{ appearanceTheme: "dark", accentColor: "blue" }]);
  stop();
});

test("appearance lifecycle deduplicates and removes delegated listeners without startup scans", () => {
  const f = fixture();
  const classes = new Set(), listeners = new Set();
  let watches = 0, disconnects = 0, deliver;
  const rootElement = { dataset: {}, classList: { add: n => classes.add(n), remove: n => classes.delete(n) } };
  const media = { matches: false, addEventListener: (_, fn) => listeners.add(fn), removeEventListener: (_, fn) => listeners.delete(fn) };
  f.context.matchMedia = () => media;
  const gestures = new Map();
  f.context.document = { documentElement: null,
    addEventListener(type, fn, options) { assert.equal(typeof options === "object" ? options.capture : options, true); const entries = gestures.get(type) || new Set(); assert.ok(!entries.has(fn)); entries.add(fn); gestures.set(type, entries); },
    removeEventListener(type, fn, capture) { assert.equal(capture, true); const entries = gestures.get(type); entries?.delete(fn); if (!entries?.size) gestures.delete(type); }
  };
  f.context.MutationObserver = class {
    constructor(fn) { deliver = fn; }
    observe(target, options) { assert.equal(target, f.context.document); assert.deepEqual(plain(options), { childList: true }); watches++; }
    disconnect() { disconnects++; }
  };
  delete f.context.GmailPro.appearance;
  f.run("content/appearance.js");
  const feature = f.context.GmailPro.appearance;
  feature.start(f.settings.defaults);
  assert.equal(watches, 0);
  feature.update({ appleMailModeEnabled: true, appearanceTheme: "system", accentColor: "yellow" });
  feature.update({ autoBccEnabled: true });
  assert.equal(gestures.size, 7);
  assert.equal(watches, 1); assert.equal(listeners.size, 1);
  f.context.document.documentElement = rootElement; deliver();
  assert.equal(disconnects, 1); assert.equal(rootElement.dataset.gpTheme, "light");
  assert.equal(rootElement.dataset.gpAccent, "yellow");
  media.matches = true; [...listeners][0]();
  assert.equal(rootElement.dataset.gpTheme, "dark");
  feature.update({ appearanceTheme: "light" });
  assert.equal(listeners.size, 0); assert.equal(rootElement.dataset.gpTheme, "light");
  feature.update({ appearanceTheme: "system" });
  const lateChange = [...listeners][0];
  feature.stop(); lateChange();
  assert.equal(gestures.size, 0);
  assert.equal(classes.size, 0); assert.deepEqual(rootElement.dataset, {}); assert.equal(listeners.size, 0);
  f.run("content/appearance.js"); assert.equal(feature, f.context.GmailPro.appearance);
});

for (const name of ["floatingReplyEnabled", "floatingReplyAllEnabled", "floatingForwardEnabled", "archiveShortcutEnabled", "sendShortcutEnabled", "undoShortcutEnabled", "replyAllShortcutEnabled", "forwardShortcutEnabled"]) {
  test(`${name} defaults on, saves independently, validates and resets on deletion`, async () => {
    const f = fixture();
    assert.equal((await f.settings.load())[name], true);
    await f.settings.save({ [name]: false });
    const loaded = await f.settings.load();
    assert.equal(loaded[name], false);
    assert.equal(loaded.autoBccEnabled, false);
    await assert.rejects(f.settings.save({ [name]: "true" }));
    const patches = []; const stop = f.settings.subscribe(p => patches.push(plain(p)));
    [...f.listeners][0]({ [prefix + name]: {} }, "sync");
    assert.deepEqual(patches, [{ [name]: true }]); stop();
  });
}


test("keyboard shortcuts are inert on non-Mac platforms", () => {
  const f = fixture();
  f.context.navigator = { userAgentData: {platform: "Windows"}, platform: "Win32" };
  f.context.window = { addEventListener() { throw Error("Unexpected keyboard handler"); }, removeEventListener() {} };
  delete f.context.GmailPro.keyboardShortcuts;
  f.run("content/gmailSelectors.js"); f.run("content/keyboardShortcuts.js");
  f.context.GmailPro.keyboardShortcuts.start(f.settings.defaults);
  f.context.GmailPro.keyboardShortcuts.stop();
});


test("automatic paging preference saves independently and normalizes deletion", async () => {
  const f = fixture({ [prefix + "appleMailModeEnabled"]: true });
  const patches = []; const stop = f.settings.subscribe(patch => patches.push(plain(patch)));
  await f.settings.save({ autoPagingEnabled: true });
  assert.equal((await f.settings.load()).autoPagingEnabled, true);
  assert.equal((await f.settings.load()).appleMailModeEnabled, true);
  await assert.rejects(f.settings.save({ autoPagingEnabled: "true" }));
  [...f.listeners][0]({ [prefix + "autoPagingEnabled"]: {} }, "sync");
  assert.deepEqual(patches, [{ autoPagingEnabled: true }, { autoPagingEnabled: false }]); stop();
});
