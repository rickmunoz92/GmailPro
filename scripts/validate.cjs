"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));

assert.equal(manifest.manifest_version, 3);
assert.equal(manifest.name, "Gmail Pro");
assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
assert.deepEqual(manifest.permissions, ["storage"]);
for (const key of ["background", "host_permissions", "optional_permissions", "optional_host_permissions", "web_accessible_resources", "externally_connectable", "oauth2"]) {
  assert.equal(manifest[key], undefined, `Unexpected manifest capability: ${key}`);
}
assert.equal(manifest.content_scripts.length, 2);
for (const content of manifest.content_scripts) {
  assert.deepEqual(content.matches, ["https://mail.google.com/*"]);
  assert.equal(content.all_frames, false);
  assert.ok(["document_start", "document_idle"].includes(content.run_at));
  assert.ok(!content.world || content.world === "ISOLATED");
}
assert.equal(manifest.content_scripts[0].run_at, "document_start");
assert.deepEqual(manifest.content_scripts[0].css, ["content/reverseThreads.css"]);
assert.equal(manifest.content_scripts[1].run_at, "document_idle");
assert.deepEqual(manifest.content_scripts[1].js, ["content/autoBcc.js", "content/autoBccStart.js"]);
assert.match(manifest.content_security_policy.extension_pages, /connect-src 'none'/);

const references = [manifest.action.default_popup, ...manifest.content_scripts.flatMap(content => [...content.js, ...(content.css || [])]),
  ...Object.values(manifest.icons), ...Object.values(manifest.action.default_icon)];
const html = fs.readFileSync(path.join(root, manifest.action.default_popup), "utf8");
for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
  assert.match(match[1], /\bsrc="/i, "Every script must have a local source");
  assert.equal(match[2].trim(), "", "No inline scripts");
}
assert.ok(!/\son\w+\s*=/i.test(html), "No inline event handlers");
for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
  assert.ok(!/^(?:[a-z]+:|\/\/)/i.test(match[1]), "Popup resources must be local");
  references.push(path.join("popup", match[1]));
}
for (const relative of references) {
  const file = path.resolve(root, relative);
  assert.ok(file.startsWith(root + path.sep), "Resource must stay inside project");
  assert.ok(fs.statSync(file).isFile(), `Missing resource: ${relative}`);
}
for (const [size, relative] of Object.entries(manifest.icons)) {
  const png = fs.readFileSync(path.join(root, relative));
  assert.equal(png.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  assert.equal(png.readUInt32BE(16), Number(size));
  assert.equal(png.readUInt32BE(20), Number(size));
}
for (const directory of ["shared", "content", "popup", "tests"]) {
  for (const file of fs.readdirSync(path.join(root, directory)).filter((file) => file.endsWith(".js"))) {
    const filename = path.join(root, directory, file);
    const source = fs.readFileSync(filename, "utf8");
    new vm.Script(source, { filename });
    assert.ok(!/\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon|setInterval|eval)\s*\(/.test(source), `Unexpected networking, polling, or eval in ${file}`);
  }
}
console.log("Manifest, resource paths, icon dimensions, JavaScript syntax, and minimal-permission checks passed.");
const result = spawnSync(process.execPath, ["--test", "tests/settings.test.cjs"], { cwd: root, stdio: "inherit" });
process.exitCode = result.status ?? 1;
