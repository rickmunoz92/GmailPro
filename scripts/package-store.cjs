'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const root = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json')));
const dist = path.join(root, 'dist');
fs.mkdirSync(dist, { recursive: true });
const stage = fs.mkdtempSync(path.join(dist, 'store-stage-'));
const files = [];
function copy(relative) {
  const from = path.join(root, relative), to = path.join(stage, relative), stat = fs.lstatSync(from);
  if (stat.isSymbolicLink()) throw new Error('Symlinks cannot ship: ' + relative);
  if (stat.isDirectory()) {
    fs.mkdirSync(to, { recursive: true });
    for (const entry of fs.readdirSync(from).sort()) copy(path.join(relative, entry));
  } else if (['manifest.json', 'LICENSE'].includes(relative) || /\.(?:js|css|html|png|svg)$/.test(relative)) {
    fs.mkdirSync(path.dirname(to), { recursive: true }); fs.copyFileSync(from, to); files.push(relative);
  }
}
try {
  for (const relative of ['manifest.json', 'LICENSE', 'background', 'shared', 'content', 'popup', 'icons']) copy(relative);
  for (const group of manifest.content_scripts || []) for (const relative of [...(group.js || []), ...(group.css || [])]) {
    if (!files.includes(relative)) throw new Error('Non-production content script cannot ship: ' + relative);
  }
  fs.writeFileSync(path.join(stage, 'shared/billing-config.js'), '"use strict";\nglobalThis.GmailProBillingConfig = Object.freeze(' +
    JSON.stringify({ required: true, apiOrigin: 'https://gmail-pro.netlify.app' }) + ');\n');
  const zip = path.join(dist, `Gmail-Pro-${manifest.version}.zip`);
  // Zip only explicit production files. Never include website, tests, env, Git,
  // browser captures, build dependencies, or developer-only license settings.
  if (fs.existsSync(zip)) fs.unlinkSync(zip);
  const result = spawnSync('zip', ['-X', '-q', zip, ...files.sort()], { cwd: stage, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr || 'ZIP creation failed.');
  const hash = createHash('sha256').update(fs.readFileSync(zip)).digest('hex');
  fs.writeFileSync(zip + '.sha256', hash + '  ' + path.basename(zip) + '\n');
  console.log(`Store candidate: ${zip}\nSHA-256: ${hash}\nSubscription verification: REQUIRED\nSubmission still requires the launch acceptance checks in release/README.md.`);
} finally { fs.rmSync(stage, { recursive: true, force: true }); }
