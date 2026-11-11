'use strict';
// OAuth client IDs are public identifiers, not client secrets. Chrome owns tokens.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const args = process.argv.slice(2), configPath = path.join(root, 'google-oauth.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const valid = value => typeof value === 'string' && /^[\w-]+\.apps\.googleusercontent\.com$/.test(value);
if (args.length === 1 && args[0] === '--check') {
  console.log(`Development OAuth: ${valid(config.developmentClientId) ? 'configured' : 'setup required'}`);
  console.log(`Store OAuth: ${valid(config.storeClientId) ? 'configured' : 'setup required'}`);
  process.exitCode = valid(config.developmentClientId) && valid(config.storeClientId) ? 0 : 1;
} else {
  if (!args.length || args.length % 2) throw new Error('Use --development-client-id ID and/or --store-client-id ID.');
  for (let index = 0; index < args.length; index += 2) {
    const name = { '--development-client-id': 'developmentClientId', '--store-client-id': 'storeClientId' }[args[index]];
    if (!name || !valid(args[index + 1])) throw new Error('Expected a Google Chrome Extension OAuth client ID. Never enter a client secret.');
    config[name] = args[index + 1];
  }
  const manifestPath = path.join(root, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (valid(config.developmentClientId)) manifest.oauth2 = { client_id: config.developmentClientId,
    scopes: ['https://www.googleapis.com/auth/gmail.readonly'] };
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  console.log('Public OAuth client configuration saved. Reload the unpacked extension and refresh Gmail.');
}
