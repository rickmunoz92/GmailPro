/* Developer-only screenshot helper. Excluded from the store package.
 * Changes only rendered text in an inert Inbox; never calls Gmail actions,
 * APIs, storage or messaging. Reload without this script to restore the view.
 */
(() => {
  'use strict';
  if (globalThis.GmailProBillingConfig?.required !== false ||
      !globalThis.GmailProBillingConfig?.capturePreview ||
      location.origin !== 'https://mail.google.com' || window !== top) return;
  document.documentElement.setAttribute('data-gp-capture-build','2026-11-04-v5');
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
  const nativeMailbox = globalThis.GmailPro?.selectors?.mailboxNavigation;
  const textSlots = new WeakSet();
  const demoBodies = new WeakMap();
  const capturedText = new WeakMap();
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
    for (const node of nodes) if (node.data.trim() && !demoBodies.has(node.parentElement?.closest('.a3s'))) {
      textSlots.add(node); node.data = '';
    }
  }
  function sanitizeConversation(pane) {
    // Retain the real Gmail message shells and Gmail Pro's real controls.
    // Only fictional message content is inserted into the received-email slots.
    if (capturedText.get(pane) === pane.textContent &&
        [...pane.querySelectorAll('.ii .a3s')].every(body=>demoBodies.get(body)?.html===body.innerHTML)) return;
    blankText(pane);
    for (const heading of pane.querySelectorAll('h2.hP, h2[data-thread-perm-id]'))
      setText(heading, 'The launch checklist is ready');
    const messages = [...pane.querySelectorAll('.adn')]
      .sort((a,b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
    for (const [index,message] of messages.entries()) {
      const sender = index ? 'Alex Rivera' : 'Maya Chen';
      for (const node of message.querySelectorAll('.gD')) setText(node, sender);
      for (const node of message.querySelectorAll('[email], [data-hovercard-id]')) {
        node.setAttribute('email', index ? 'alex@example.com' : 'maya@example.com');
        node.setAttribute('data-hovercard-id', node.getAttribute('email'));
        node.removeAttribute('name');
      }
      for (const node of message.querySelectorAll('.hb .g2')) setText(node, index ? 'Maya Chen' : 'Alex Rivera');
      for (const summary of message.querySelectorAll('.hb')) {
        const label = [...summary.childNodes].find(node => node.nodeType === Node.TEXT_NODE);
        if (label) label.data = 'To: ';
      }
      for (const node of message.querySelectorAll('.g3')) setText(node, index ? 'Yesterday, 4:15 PM' : 'Today, 10:42 AM');
      for (const body of message.querySelectorAll('.ii .a3s')) {
        const key = index ? 'earlier' : 'latest';
        const previous = demoBodies.get(body);
        if (previous?.key === key && previous.html === body.innerHTML) continue;
        body.innerHTML = index
          ? '<p>Hi Maya,</p><p>The new site is looking great. Could you send over the final launch checklist when you have a moment?</p><p>I’ll take care of the last round of feedback.</p><p>Thanks,<br>Alex</p>'
          : '<p>Hi Alex,</p><p>Everything is ready for our next release. The final checklist is below:</p><ul><li>Website copy and product screenshots</li><li>A simpler onboarding experience</li><li>One last review with the team</li></ul><p>I’ve also added your feedback to the project notes. Let’s do a quick walkthrough tomorrow and then we’re good to go.</p><p>Thanks for all the thoughtful details on this one.</p><p>Maya</p>';
        body.style.cssText = 'font:14px/1.7 Arial,sans-serif;color:inherit;background:transparent';
        body.setAttribute('data-gp-demo-body', key);
        demoBodies.set(body, {key,html:body.innerHTML});
      }
    }
    for (const [selector,text] of [['.ams.bkH','Reply'],['.ams.bkI','Reply all'],['.ams.bkG','Forward']])
      for (const node of pane.querySelectorAll(selector)) setText(node,text);
    capturedText.set(pane,pane.textContent);
  }
  let active = false, frame = 0, watch;
  function sanitize() {
    frame = 0;
    document.documentElement.removeAttribute('data-gp-capture-ready');
    if (!/^#inbox(?:\/p\d+)?$/.test(location.hash) ||
        document.querySelector('form:has(input[name="composeid"])')) return;
    const main = [...document.querySelectorAll('[role="main"]')].find(e => e.querySelector('.Nu.tf table[role="grid"]'));
    if (!main || !document.querySelector('tr[data-gp-message-row]')) return;
    if (!active) {
      active = true; clearTimeout(deadline); watch.disconnect();
      const style = document.createElement('style');
      style.textContent = `
        html[data-gp-capture-preview]:not([data-gp-capture-ready])::after {
          content:'';position:fixed;inset:0;z-index:2147483646;background:var(--gp-bg-primary,#23292b);
        }
        html[data-gp-capture-preview] body img,
        html[data-gp-capture-preview] .aqn.arL,
        html[data-gp-capture-preview] [role="tooltip"],
        html[data-gp-capture-preview] [role="dialog"],
        html[data-gp-capture-preview] [role="menu"],
        html[data-gp-capture-preview] [role="complementary"],
        html[data-gp-capture-preview] [role="contentinfo"],
        html[data-gp-capture-preview] [role="banner"],
        html[data-gp-capture-preview] [role="alert"],
        html[data-gp-capture-preview] [role="status"],
        html[data-gp-capture-preview] .b8,
        html[data-gp-capture-preview] .aeU,
        html[data-gp-capture-preview] .Nu.S3 :is(.aju,.ajx,.aQH,.aQw) { visibility:hidden!important; }
        html[data-gp-capture-preview] [role="main"] .Nu.tf table[role="grid"] tr:not([data-gp-message-row]) { visibility:hidden!important; }
        html[data-gp-capture-preview] .E22Lmb .fHZE5 { opacity:0!important; }
        #gp-capture-note { position:fixed;bottom:8px;right:16px;z-index:2147483647;
          padding:4px 8px;border-radius:4px;font:11px/1.4 system-ui;
          background:var(--gp-bg-secondary,#24292d);color:var(--gp-text-secondary,#b9bdc0);
          pointer-events:none; }
      `;
      document.head.append(style);
      document.documentElement.setAttribute('data-gp-capture-preview', '');
      document.body.inert = true;
      for (const list of main.querySelectorAll('.Nu.tf, .Nu.tf > .ae4')) list.scrollTop = 0;
      window.addEventListener('keydown', event => {
        if (event.key === 'F5' || ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'r')) return;
        event.preventDefault(); event.stopImmediatePropagation();
      }, true);
      const note = document.createElement('div'); note.id = 'gp-capture-note';
      note.textContent = 'Fictional demo content'; document.documentElement.append(note);
    }
    watch.disconnect();
    const captureTheme = globalThis.GmailProBillingConfig.captureTheme;
    if (['light','dark'].includes(captureTheme)) document.documentElement.setAttribute('data-gp-theme',captureTheme);
    for (const input of document.querySelectorAll('[role="search"] input')) input.value = '';
    for (const node of document.querySelectorAll('.gmail-pro-search-query')) setText(node, '');
    const pane = main.querySelector('.Nu.S3');
    if (pane?.querySelector('.adn')) sanitizeConversation(pane);
    for (const [index, row] of [...main.querySelectorAll('tr[data-gp-message-row]')].entries()) {
      if (capturedText.get(row) === row.textContent) continue;
      const [sender, subject, label] = examples[row.classList.contains('aps') ? 0 : 1 + index % (examples.length - 1)];
      // Clear every text node first, including optional tracking/smart chips.
      blankText(row);
      const senderNode = row.querySelector('.yW .bA4 [email], .yW [email], .yW .bA4, .yW');
      setText(senderNode, sender);
      setText(row.querySelector('.bog[data-thread-id], .bog [data-thread-id]') || row.querySelector('.bog'), subject);
      for (const badge of row.querySelectorAll('.yi .av')) setText(badge, label);
      const date = row.querySelector('td.xW > span');
      if (date) {
        const time = `${11 - (index % 4)}:${index % 2 ? '15' : '30'} AM`;
        date.setAttribute('title', `Wed, Nov 4, 2026, ${time}`);
        date.setAttribute('data-gmail-pro-date', `Today, ${time}`);
      }
      capturedText.set(row,row.textContent);
    }
    const mailboxes = nativeMailbox ? [...document.querySelectorAll(nativeMailbox)] : [];
    for (const [index, link] of mailboxes.flatMap(nav=>[...nav.querySelectorAll('.n0[href*="#label/"]')]).entries())
      setText(link, labelNames[index % labelNames.length]);
    for (const count of mailboxes.flatMap(nav=>[...nav.querySelectorAll('.bsU')])) setText(count, '3');
    const range = main.querySelector('[aria-label="Show more messages"]');
    if (range) for (const [index, span] of [...range.querySelectorAll('.ts')].entries())
      setText(span, ['1', '50', '128'][index] || '128');
    for (const banner of main.querySelectorAll('.E22Lmb')) {
      if (capturedText.get(banner) === banner.textContent) continue;
      blankText(banner);
      setText(banner.querySelector('h2.iqFh3e'), 'Happening soon');
      setText(banner.querySelector('.a8DSAf'), 'Studio headphones — Midnight blue');
      setText(banner.querySelector('.rjuWBc'), 'Arriving tomorrow');
      setText(banner.querySelector('.FOBRw-I:has(> a[aria-label="View order"]) > .FOBRw-anl'), 'View order');
      // Keep native label wrappers: overlay anchors do not own button sizing.
      setText(banner.querySelector('.L0lHNd > .AV6tSd'), '+ 1 more');
      capturedText.set(banner,banner.textContent);
    }
    document.documentElement.setAttribute('data-gp-capture-ready', '');
    watch.observe(document.body, { childList:true, characterData:true, subtree:true });
  }
  function schedule() {
    document.documentElement.removeAttribute('data-gp-capture-ready');
    if (!frame) frame = requestAnimationFrame(sanitize);
  }
  let deadline;
  watch = new MutationObserver(schedule);
  function begin() {
    watch.observe(document.body, { childList:true, characterData:true, subtree:true });
    window.addEventListener('hashchange', schedule);
    deadline = setTimeout(() => { if (!active) watch.disconnect(); }, 30000);
    schedule();
  }
  if (globalThis.GmailProBillingConfig.captureStartManually) {
    const button = document.createElement('button'); button.id = 'gp-capture-start';
    button.textContent = 'Prepare fictional demo screenshot';
    button.style.cssText = 'position:fixed;bottom:16px;right:32px;z-index:2147483647;padding:12px 18px;border:1px solid #2563eb;border-radius:8px;background:#2563eb;color:white;font:600 13px system-ui;cursor:pointer';
    button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();button.remove();begin();});
    document.documentElement.append(button);
  } else begin();
})();
