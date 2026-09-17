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

test("reloading shared scripts preserves the single settings owner", () => {
  const f = fixture();
  const stop = f.settings.subscribe(() => {});
  f.run("shared/settings.js");
  assert.equal(f.context.GmailPro.settings, f.settings);
  assert.equal(f.listeners.size, 1);
  stop();
});

test("content and placeholders remain inert even with enabled preferences and repeated injection", () => {
  const f = fixture({ [prefix + "autoBccEnabled"]: true, [prefix + "newestEmailFirstEnabled"]: true });
  const forbidden = () => { throw new Error("Unexpected Phase 1 side effect"); };
  Object.assign(f.context, { console: { debug: forbidden }, MutationObserver: forbidden, setInterval: forbidden, setTimeout: forbidden, fetch: forbidden });
  Object.defineProperty(f.context, "document", { get: forbidden });
  Object.defineProperty(f.context, "window", { get: forbidden });
  const files = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"))).content_scripts[0].js;
  for (let pass = 0; pass < 2; pass += 1) for (const file of files) f.run(file);
  for (const feature of [f.context.GmailPro.autoBcc, f.context.GmailPro.reverseThreads]) {
    assert.equal(feature.implemented, false);
    feature.start({ autoBccEnabled: true, bccAddress: "test@example.com", newestEmailFirstEnabled: true });
    feature.start();
    feature.stop();
    feature.stop();
  }
  assert.equal(f.context.GmailPro.contentInitialized, true);
  assert.equal(f.writes, 0);
  assert.equal(f.listeners.size, 0);
});
