(() => {
  'use strict';
  const status = document.getElementById('label-reminders-status');
  const connect = document.getElementById('label-reminders-connect'), check = document.getElementById('label-reminders-check');
  const disconnect = document.getElementById('label-reminders-disconnect');
  let accepted = false, alive = true, busy = false, version = 0, state;
  async function send(action, extra = {}) {
    const result = await chrome.runtime.sendMessage({ type: 'gmail-pro-label-reminders', action, ...extra });
    if (!result?.ok) throw new Error(result?.error || 'Could not check labels. Please try again.');
    return result;
  }
  function render(result) {
    state = result;
    connect.hidden = result.connected === true; check.hidden = disconnect.hidden = !result.connected;
    connect.disabled = busy || !accepted || !result.configured;
    check.disabled = busy || !accepted || result.enabled === false;
    disconnect.disabled = busy || !accepted;
    status.textContent = !result.configured ? 'Google connection is not configured in this build. Other Gmail Pro features still work.' : !result.connected ?
      'Not connected. Connect Google only if you want label cleanup reminders.' :
      result.retryAt > Date.now() ? `Connected for label reminders as ${result.account}. Label checks are paused and will retry shortly while Gmail is open.` :
      result.pending ? `Connected for label reminders as ${result.account}. ${result.total - result.pending} of ${result.total} labels checked.` :
        `Connected for label reminders as ${result.account}. ${result.total ? 'Label checks are up to date.' : 'Ready to check labels.'}`;
  }
  async function refresh() {
    if (!accepted || !alive || busy) return;
    const token = ++version;
    try { const result = await send('status'); if (alive && accepted && token === version) render(result); }
    catch (error) { if (alive && token === version) status.textContent = error.message; }
  }
  async function run(action) {
    if (!accepted || busy) return;
    busy = true; const token = ++version;
    connect.disabled = check.disabled = disconnect.disabled = true;
    status.textContent = action === 'connect' ? 'Connecting Google…' : action === 'disconnect' ? 'Disconnecting…' : 'Checking labels…';
    let errorMessage;
    try {
      if (action === 'connect') {
        const granted = await chrome.permissions.request({ origins: ['https://gmail.googleapis.com/*'] });
        if (!granted) throw new Error('Google connection permission was not granted.');
      }
      let result = await send(action === 'check' ? 'scan' : action, action === 'check' ? { force: true } : {});
      if (action !== 'disconnect') {
        let first = action === 'connect';
        while (alive && accepted && token === version && result.enabled !== false && !(result.retryAt > Date.now()) && (first || result.pending)) {
          first = false; result = await send('scan');
          if (alive && token === version) render(result);
        }
      }
      if (alive && accepted && token === version) render(result);
    } catch (error) { if (alive && token === version) { errorMessage = error.message; status.textContent = errorMessage; } }
    finally {
      if (token === version) { busy = false; if (state) render(state); if (errorMessage) status.textContent = errorMessage; }
    }
  }
  connect.addEventListener('click', () => void run('connect'));
  check.addEventListener('click', () => void run('check'));
  disconnect.addEventListener('click', () => void run('disconnect'));
  const changed = message => { if (message?.type === 'gmail-pro-label-reminders-changed') void refresh(); };
  chrome.runtime.onMessage.addListener(changed);
  const unsubscribe = globalThis.GmailPro.settings.subscribe(patch => {
    if (Object.keys(patch).some(name => name.startsWith('labelReminder'))) void refresh();
  });
  document.addEventListener('gmail-pro-consent-status', event => {
    accepted = event.detail?.accepted === true;
    if (!accepted) { version++; busy = false; connect.disabled = check.disabled = disconnect.disabled = true; status.textContent = 'Review the disclosure to enable label reminders.'; }
    else void refresh();
  });
  window.addEventListener('pagehide', () => { alive = false; version++; unsubscribe(); chrome.runtime.onMessage.removeListener(changed); }, { once: true });
})();
