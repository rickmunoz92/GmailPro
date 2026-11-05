(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const section = document.querySelector('.subscription-card');
  let busy = false;
  let accepted = false;
  const message = text => { $('billing-message').textContent = text; };
  async function send(action, values = {}) {
    const result = await chrome.runtime.sendMessage({ type: 'gmail-pro-billing', action, ...values });
    if (!result?.ok) throw new Error(result?.error || 'Could not connect to billing. Please try again.');
    return result;
  }
  async function render() {
    if (globalThis.GmailProBillingConfig?.required === false) {
      $('subscription-status').textContent = 'Owner / development copy. Subscription checks are enabled in the Chrome Web Store release.';
      $('license-restore').hidden = true;
      return;
    }
    const result = await send('details'), status = result.status;
    const terminal = ['canceled', 'incomplete_expired'].includes(status.status);
    $('subscription-purchase').hidden = !!result.licenseKey && !terminal;
    $('subscription-pending').hidden = !result.pending;
    $('subscription-manage').hidden = !result.licenseKey || status.review;
    $('saved-license').hidden = !result.licenseKey;
    $('saved-license-key').value = result.licenseKey;
    section.querySelectorAll('[data-plan]').forEach(button => { button.hidden = !!result.pending || !result.salesEnabled; });
    $('continue-purchase').hidden = !result.pending;
    $('continue-purchase').dataset.plan = result.pendingPlan || 'month';
    $('pending-plan').textContent = result.pendingPlan === 'year' ? 'Selected plan: US$10 per year.' : 'Selected plan: US$0.99 per month.';
    $('sales-readiness').hidden = result.salesEnabled;
    if (status.active) {
      const date = status.renewsAt ? new Date(status.renewsAt).toLocaleDateString() : '';
      $('subscription-status').textContent = status.review ? 'Temporary review access is active.' : status.status === 'trialing' ?
        `Your 7-day free trial is active.${date ? (status.cancelAtPeriodEnd ? ' Access ends ' : ' First payment scheduled ') + date + '.' : ''} Cancel before the trial ends to avoid the first charge.` :
        `Gmail Pro is active.${date ? (status.cancelAtPeriodEnd ? ' Access ends ' : ' Renews ') + date + '.' : ''}${status.offline ? ' Using your last verified status while offline.' : ''}`;
    } else if (status.unavailable) $('subscription-status').textContent = 'Could not verify your subscription. Check your connection, then refresh status.';
    else $('subscription-status').textContent = result.licenseKey ? 'Your subscription needs attention. Use Manage subscription or contact support.' : result.salesEnabled ? 'Choose a plan to activate Gmail Pro.' : 'Subscriptions are being prepared. Please check back soon.';
  }
  async function run(action, values) {
    if (busy) return;
    if (action === 'checkout' && !accepted) { message('Review the disclosure and agree above before starting a new checkout. Subscription management stays available.'); return; }
    busy = true; message('Working…');
    section.querySelectorAll('button').forEach(button => { button.disabled = true; });
    try {
      await send(action, values);
      if (action === 'activate') $('license-key').value = '';
      await render();
      message(action === 'checkout' ? 'Complete Checkout in the Stripe tab, then return here.' :
        action === 'forget' ? 'This browser is deactivated. Your subscription has not been canceled.' :
        action === 'portal' ? 'Manage your plan in the Stripe tab. Return here and refresh status afterward.' : 'Subscription updated.');
    } catch (error) { message(error.message); }
    finally { busy = false; section.querySelectorAll('button').forEach(button => { button.disabled = button.hasAttribute('data-plan') && !accepted; }); }
  }
  section.querySelectorAll('[data-plan]').forEach(button => button.addEventListener('click', () => run('checkout', { plan: button.dataset.plan })));
  $('finish-purchase').addEventListener('click', () => run('complete'));
  $('activate-license').addEventListener('click', () => run('activate', { licenseKey: $('license-key').value }));
  $('manage-subscription').addEventListener('click', () => run('portal'));
  $('refresh-subscription').addEventListener('click', () => run('refresh'));
  $('forget-license').addEventListener('click', () => run('forget'));
  $('reveal-license').addEventListener('click', () => {
    const field = $('saved-license-key');
    field.type = field.type === 'password' ? 'text' : 'password';
    $('reveal-license').textContent = field.type === 'password' ? 'Show license key' : 'Hide license key';
    if (field.type === 'text') { field.focus(); field.select(); }
  });
  document.addEventListener('gmail-pro-consent-status', event => {
    accepted = event.detail?.accepted === true;
    section.querySelectorAll('[data-plan]').forEach(button => { button.disabled = busy || !accepted; });
  });
  section.querySelectorAll('[data-plan]').forEach(button => { button.disabled = true; });
  render().catch(error => { $('subscription-status').textContent = 'Could not load subscription.'; message(error.message); });
})();
