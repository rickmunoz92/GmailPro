(() => {
  'use strict';
  const app = globalThis.GmailPro, $ = id => document.getElementById(id);
  const form = $('consent-form'), button = $('accept-terms'), status = $('consent-status');
  let busy = false, generation = 0;
  function render(next) {
    const accepted = next.accepted === true;
    form.hidden = accepted; $('withdraw-consent').hidden = !accepted;
    if (!accepted) { $('consent-adult').checked = false; $('consent-agree').checked = false; updateButton(); }
    status.textContent = accepted ? `Agreement saved ${new Date(next.acceptedAt).toLocaleDateString()}. You can pause Gmail Pro below.` :
      'Gmail Pro features stay paused until you agree. Billing management and support remain available.';
    document.dispatchEvent(new CustomEvent('gmail-pro-consent-status', { detail: next }));
  }
  function renderPaused() {
    form.hidden = false; $('withdraw-consent').hidden = true;
    document.dispatchEvent(new CustomEvent('gmail-pro-consent-status', { detail: { accepted: false } }));
  }
  async function refresh() {
    const current = ++generation;
    try { const next = await app.consent.getStatus(); if (current === generation) render(next); }
    catch { if (current === generation) { status.textContent = 'Could not read your agreement. Features stay paused. Try again below.'; renderPaused(); } }
  }
  function updateButton() { button.disabled = busy || !$('consent-adult').checked || !$('consent-agree').checked; }
  form.addEventListener('change', updateButton);
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy || !$('consent-adult').checked || !$('consent-agree').checked) return;
    busy = true; generation++; updateButton(); status.textContent = 'Saving your agreement…';
    try { render(await app.consent.accept()); }
    catch { status.textContent = 'Could not save your agreement. Features stay paused. Please try again.'; renderPaused(); }
    finally { busy = false; updateButton(); }
  });
  $('withdraw-consent').addEventListener('click', async () => {
    if (busy) return;
    busy = true; generation++; $('withdraw-consent').disabled = true;
    try {
      const next = await app.consent.withdraw();
      $('consent-adult').checked = false; $('consent-agree').checked = false; render(next);
      status.textContent = 'Gmail Pro is paused. Billing continues until you cancel through Manage subscription or Subscription help.';
    } catch { status.textContent = 'Could not pause Gmail Pro. Try again, or disable the extension in Chrome.'; }
    finally { busy = false; $('withdraw-consent').disabled = false; updateButton(); }
  });
  const unsubscribe = app.consent.subscribe(refresh);
  window.addEventListener('pagehide', () => { generation++; unsubscribe(); }, { once: true });
  document.querySelectorAll('[data-legal-link]').forEach(link => { link.href = globalThis.GmailProLegal[link.dataset.legalLink]; });
  refresh();
})();
