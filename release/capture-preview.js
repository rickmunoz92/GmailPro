/* Developer-only screenshot helper. Excluded from the store package.
 * Changes only rendered text in an inert Inbox; never calls Gmail actions,
 * APIs, storage or messaging. Reload without this script to restore the view.
 */
(() => {
  'use strict';
  if (globalThis.GmailProBillingConfig?.required !== false ||
      !globalThis.GmailProBillingConfig?.capturePreview ||
      location.origin !== 'https://mail.google.com' || window !== top) return;
  const examples = [
    ['Maya Chen', 'The launch checklist is ready', 'Projects'],
    ['Alex Rivera', 'A few ideas for the next release', 'Design'],
    ['Northstar Studio', 'Your weekly project update', 'Clients'],
    ['Jordan Lee', 'Coffee next week?', 'Personal'],
    ['Morgan Ellis', 'Final notes from our planning session', 'Projects'],
    ['Papertrail', 'Your monthly receipt', 'Receipts'],
    ['Casey Brooks', 'Re: Website feedback', 'Design'],
    ['Field Notes', 'A little inspiration for your Friday', 'Reading'],
    ['Taylor Park', 'Photos from the team workshop', 'Team'],
    ['Avery Quinn', 'The proposal looks great', 'Clients'],
    ['Studio Supply', 'Your order is on its way', 'Receipts'],
    ['Sam Patel', 'Re: Plans for the weekend', 'Personal']
  ];
  const labelNames = ['Projects', 'Launch', 'Clients', 'Design', 'Team', 'Reading', 'Receipts', 'Personal', 'Travel'];
  const textSlots = new WeakSet();
  function setText(node, text) {
    if (!node) return;
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    let slot;
    while (walker.nextNode()) {
      const candidate = walker.currentNode;
      if (!slot && (textSlots.has(candidate) || candidate.data.trim())) slot = candidate;
      else if (candidate.data.trim()) candidate.data = '';
    }
    if (!slot) { slot = document.createTextNode(''); node.append(slot); }
    textSlots.add(slot);
    if (slot.data !== text) slot.data = text;
  }
  function blankText(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) if (node.data.trim()) { textSlots.add(node); node.data = ''; }
  }
  let active = false, frame = 0, watch;
  function sanitize() {
    frame = 0;
    if (!/^#inbox(?:\/p\d+)?$/.test(location.hash) ||
        document.querySelector('form:has(input[name="composeid"])')) return;
    const main = [...document.querySelectorAll('[role="main"]')].find(e => e.querySelector('.Nu.tf table[role="grid"]'));
    if (!main || !document.querySelector('tr[data-gp-message-row]')) return;
    if (!active) {
      active = true; clearTimeout(deadline); watch.disconnect();
      const style = document.createElement('style');
      style.textContent = `
        html[data-gp-capture-preview] body img,
        html[data-gp-capture-preview] .aqn.arL,
        html[data-gp-capture-preview] [role="tooltip"],
        html[data-gp-capture-preview] [role="dialog"],
        html[data-gp-capture-preview] [role="menu"],
        html[data-gp-capture-preview] [role="complementary"],
        html[data-gp-capture-preview] [role="contentinfo"] { visibility:hidden!important; }
        html[data-gp-capture-preview] [role="main"] tr:not([data-gp-message-row]) { visibility:hidden!important; }
        html[data-gp-capture-preview] .E22Lmb .fHZE5 { opacity:0!important; }
        #gp-capture-note { position:fixed;bottom:8px;right:16px;z-index:2147483647;
          padding:4px 8px;border-radius:4px;font:11px/1.4 system-ui;
          background:var(--gp-bg-secondary,#24292d);color:var(--gp-text-secondary,#b9bdc0);
          pointer-events:none; }
      `;
      document.head.append(style);
      document.documentElement.setAttribute('data-gp-capture-preview', '');
      document.body.inert = true;
      window.addEventListener('keydown', event => {
        if (event.key === 'F5' || ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'r')) return;
        event.preventDefault(); event.stopImmediatePropagation();
      }, true);
      const note = document.createElement('div'); note.id = 'gp-capture-note';
      note.textContent = 'Fictional demo content'; document.documentElement.append(note);
    }
    watch.disconnect();
    for (const [index, row] of [...main.querySelectorAll('tr[data-gp-message-row]')].entries()) {
      const [sender, subject, label] = examples[index % examples.length];
      // Clear every text node first, including optional tracking/smart chips.
      blankText(row);
      const senderNode = row.querySelector('.yW .bA4 [email], .yW [email], .yW .bA4, .yW');
      setText(senderNode, sender);
      setText(row.querySelector('.bog[data-thread-id], .bog [data-thread-id]') || row.querySelector('.bog'), subject);
      for (const badge of row.querySelectorAll('.yi .av')) setText(badge, label);
      const date = row.querySelector('td.xW > span');
      if (date) {
        const time = `${11 - (index % 4)}:${index % 2 ? '15' : '30'} AM`;
        date.setAttribute('title', `Thu, Oct 29, 2026, ${time}`);
        date.setAttribute('data-gmail-pro-date', `Today, ${time}`);
      }
    }
    for (const [index, link] of [...document.querySelectorAll('.aBO .n0[href*="#label/"]')].entries())
      setText(link, labelNames[index % labelNames.length]);
    for (const count of document.querySelectorAll('.aBO .bsU')) setText(count, '3');
    for (const caption of document.querySelectorAll('.gmail-pro-mailbox-caption')) setText(caption, 'Inbox · 128 messages');
    const range = main.querySelector('[aria-label="Show more messages"]');
    if (range) for (const [index, span] of [...range.querySelectorAll('.ts')].entries())
      setText(span, ['1', '50', '128'][index] || '128');
    for (const banner of main.querySelectorAll('.E22Lmb')) {
      blankText(banner);
      setText(banner.querySelector('h2.iqFh3e'), 'Happening soon');
      setText(banner.querySelector('.a8DSAf'), 'Studio headphones — Midnight blue');
      setText(banner.querySelector('.rjuWBc'), 'Arriving tomorrow');
      setText(banner.querySelector('.FOBRw-I:has(> a[aria-label="View order"]) > .FOBRw-anl'), 'View order');
      // Keep native label wrappers: overlay anchors do not own button sizing.
      setText(banner.querySelector('.L0lHNd > .AV6tSd'), '+ 1 more');
    }
    document.documentElement.setAttribute('data-gp-capture-ready', '');
    watch.observe(document.body, { childList:true, characterData:true, subtree:true });
  }
  function schedule() { if (!frame) frame = requestAnimationFrame(sanitize); }
  watch = new MutationObserver(schedule);
  watch.observe(document.body, { childList:true, characterData:true, subtree:true });
  const deadline = setTimeout(() => { if (!active) watch.disconnect(); }, 30000);
  schedule();
})();
