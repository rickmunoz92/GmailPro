import { createWebBilling } from './web-billing.mjs';

const status = document.getElementById('billing-status');
const planButtons = [...document.querySelectorAll('[data-website-plan]')];
const pending = document.getElementById('pending-checkout');
const licensePanel = document.getElementById('website-license');
const licenseInput = document.getElementById('website-license-key');
const manager = document.getElementById('manage-license-form');
let billing, busy = false, salesEnabled = false, storageUnavailable = false;
function say(message, error = false) {
  if (!status) return;
  status.textContent = message;
  status.dataset.error = String(error);
}
function savedPurchase() {
  try { const saved = billing.saved(); storageUnavailable = false; return saved; }
  catch (error) { storageUnavailable = true; say(error.message, true); return null; }
}
function render() {
  const saved = pending || licensePanel || planButtons.length ? savedPurchase() : null;
  if (pending) {
    pending.hidden = !saved || saved.hasLicense;
    const name = document.getElementById('pending-plan');
    if (name && saved) name.textContent = saved.plan === 'month' ? 'monthly' : 'annual';
  }
  if (licensePanel) licensePanel.hidden = !saved?.hasLicense;
  if (licenseInput) licenseInput.value = saved?.hasLicense ? billing.license() : '';
  for (const button of planButtons) button.disabled = busy || !salesEnabled || storageUnavailable || !!saved?.hasLicense;
  for (const button of document.querySelectorAll('[data-billing-action],#manage-license-form button')) button.disabled = busy;
}
async function run(action) {
  if (busy) return;
  busy = true;
  try { render(); await action(); }
  catch (error) { say(error.message || 'Billing is temporarily unavailable. Try again.', true); }
  finally { busy = false; try { render(); } catch (error) { say(error.message, true); } }
}
function activated(result) {
  say(result.status.active ? 'Your earlier purchase is verified. Save its license privately for billing management. No license is required for the current free release.' :
    'Your earlier purchase is verified. Use Manage subscription to review billing or contact support. The current free release does not depend on this purchase.');
}
try {
  billing = createWebBilling({ storage: {
    getItem: key => window.sessionStorage.getItem(key),
    setItem: (key, value) => window.sessionStorage.setItem(key, value),
    removeItem: key => window.sessionStorage.removeItem(key)
  } });
  render();
  for (const button of planButtons) button.addEventListener('click', () => run(async () => {
    say('Opening Stripe Checkout…');
    const result = await billing.start(button.dataset.websitePlan);
    if (result.activation) activated(result.activation);
    else window.location.assign(result.url);
  }));
  document.getElementById('continue-checkout')?.addEventListener('click', () => run(async () => {
    const saved = billing.saved();
    if (!saved) return;
    const result = await billing.start(saved.plan);
    if (result.activation) activated(result.activation);
    else window.location.assign(result.url);
  }));
  document.getElementById('check-activation')?.addEventListener('click', () => run(async () => {
    say('Checking your purchase…'); activated(await billing.complete());
  }));
  document.getElementById('cancel-checkout')?.addEventListener('click', () => run(async () => {
    await billing.cancel(); say('The unfinished checkout is canceled. No purchase is needed for the current free release.');
  }));
  document.getElementById('copy-website-license')?.addEventListener('click', () => run(async () => {
    try { await navigator.clipboard.writeText(billing.license()); say('License copied. Save it privately for existing-purchase management.'); }
    catch { licenseInput.type = 'text'; licenseInput.focus(); licenseInput.select(); say('Select and copy the license shown below, then save it privately.'); }
  }));
  document.getElementById('manage-website-license')?.addEventListener('click', () => run(async () => {
    window.location.assign(await billing.portal(billing.license()));
  }));
  manager?.addEventListener('submit', event => { event.preventDefault(); run(async () => {
    say('Opening subscription management…');
    window.location.assign(await billing.portal(document.getElementById('manage-license-key').value));
  }); });
  if (document.body.dataset.billingPage === 'complete' && savedPurchase()) run(async () => {
    say('Checking your purchase…'); activated(await billing.complete());
  });
  else if (document.body.dataset.billingPage === 'complete' && !storageUnavailable) say('No website checkout is saved in this tab. If you subscribed in the extension, finish activation there.');
  if (planButtons.length) billing.publicConfig().then(config => {
    salesEnabled = config.salesEnabled === true;
    const saved = savedPurchase();
    if (!saved && !storageUnavailable) say(salesEnabled ? 'Choose a plan to start your 30-day trial in Stripe Checkout.' :
      'Trials will open when the Chrome Web Store release is ready. Checkout is currently closed.');
    render();
  }).catch(() => { const saved = savedPurchase(); if (!saved && !storageUnavailable) say('Checkout is temporarily unavailable. Please check back soon.', true); });
} catch (error) { say(error.message || 'Allow this site to use tab storage, then reload.', true); }
