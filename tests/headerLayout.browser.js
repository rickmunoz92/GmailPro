(async () => {
  'use strict';
  const feature = GmailPro.headerLayout;
  const workspace = document.getElementById('workspace'), results = document.getElementById('results');
  const assert = (value, message) => { if (!value) throw Error(message); };
  const rect = node => node.getBoundingClientRect();
  const settle = async () => { for (let i = 0; i < 5; i++) await new Promise(requestAnimationFrame); };
  let passes = 0, failures = 0, saved = {}, failSave = false, saveResolve;
  GmailPro.settings = { save: async patch => { if (failSave) throw Error('storage unavailable'); if (saveResolve) await new Promise(resolve => { saveResolve = resolve; }); Object.assign(saved, patch); } };
  function fixture(width = 1400) {
    GmailPro.labelOrder.stop();
    feature.stop(); document.documentElement.className = 'gmail-pro-apple-mail-mode';
    history.replaceState(null, '', '#inbox');
    document.documentElement.dataset.gpTheme = 'dark'; document.documentElement.dataset.gpAccent = 'blue';
    saved = {}; failSave = false; saveResolve = undefined;
    workspace.style.width = `${width}px`;
    workspace.innerHTML = `<div class="w-asV"><header role="banner" id="gb"><button aria-label="Main menu">Menu</button><div class="search-owner"><form role="search"><div gh="sb"><input name="q" aria-label="Search mail"></div><button type="button" aria-label="Advanced search options">Filters</button><table class="gssb_c" style="display:none"><tbody><tr><td role="banner">Synthetic suggestion</td></tr></tbody></table></form></div><button aria-label="Settings">Settings</button></header></div><div class="stage"><nav role="navigation">Mailboxes</nav><main role="main"><div gh="tm"><div gh="mtb"><button>Archive</button><button>Reply</button><button>Third-party action</button></div><div class="Di"><button aria-label="Show more messages">1–50 of 500</button><button>Next</button></div></div><div class="panes"><div class="Nu tf"><div>List</div></div><div class="Nu S3"><div class="ii">Synthetic message <textarea>Draft</textarea></div></div></div></main></div>`;
    const form = workspace.querySelector('form'), input = form.querySelector('input');
    form.addEventListener('submit', e => { e.preventDefault(); form.dataset.submitted = input.value; });
    return { form, input, parent: form.parentElement, shell: workspace.querySelector('.w-asV'), toolbar: workspace.querySelector('[gh=tm]'), actions: workspace.querySelector('[gh=mtb]'), pager: workspace.querySelector('.Di') };
  }
  function nativeResize() { const stage=workspace.querySelector('.stage'), shell=workspace.querySelector('.w-asV'); if (stage) stage.style.height=`${innerHeight - rect(shell).height}px`; }
  function composeFixture() {
    const f=fixture();
    const nav=workspace.querySelector('nav');
    nav.innerHTML='<div class="aic"><div class="z0"><div gh="cm" role="button" tabindex="0">Compose</div></div></div><div class="mailboxes">Inbox and labels</div>';
    const group=document.createElement('div'); group.className='G-Ni';
    group.innerHTML='<div class="G-as3" role="button" tabindex="0"><span role="checkbox" aria-checked="false">Select</span></div>';
    f.actions.prepend(group);
    return {...f, source:nav.querySelector('[gh=cm]'), composeShell:nav.querySelector('.aic'), mailboxes:nav.querySelector('.mailboxes'), select:group.firstElementChild};
  }
  function mailboxRow(name, hash = '#label/' + name, depth = 0) {
    const row = document.createElement('div'); row.className = 'aim';
    row.innerHTML = '<div class="TO"><div class="TN"><div class="KCRnif"><svg viewBox="0 0 24 24"><path d="M3 6h12l6 6-6 6H3z"/></svg></div><div class="aio"><span class="nU"><a class="n0" draggable="false"></a></span><div class="bsU">6</div></div></div></div>';
    const line = row.querySelector('.TN'), link = row.querySelector('a');
    line.style.marginLeft = `${depth}px`; link.href = hash; link.textContent = name.split('/').at(-1);
    if (hash.startsWith('#label/')) {
      const menu = document.createElement('div'); menu.dataset.labelName = name; menu.setAttribute('aria-haspopup', 'true'); line.append(menu);
    }
    return row;
  }
  function mailboxFixture(expanded = false) {
    const f = composeFixture(), nav = workspace.querySelector('nav');
    f.mailboxes.outerHTML = '<div class="V3"><div class="nM"><div class="aic"></div><div class="yJ system"><div class="ajl" aria-labelledby="system-heading"><h2 id="system-heading">Labels</h2><div class="wT"><div class="n3"><div class="byl"><div class="TK"></div></div></div><div class="n6"><span gh="mll" role="button" tabindex="0" aria-label="More labels">More</span></div><div class="extra" style="display:none"><div class="n3"></div></div></div></div></div><div class="aAw"><span class="aAv" role="heading">Labels</span><div class="aAu" role="button" aria-label="Create new label" tabindex="0">+</div></div><div class="yJ labels"><div class="ajl" aria-labelledby="label-heading"><h2 id="label-heading">Labels</h2><div class="wT"><div class="n3"><div gh="cl"><div class="TK"></div></div></div><div class="n6"><span gh="mll" role="button" tabindex="0" aria-label="More labels">More</span></div><div class="extra" style="display:none"><div class="n3"></div></div></div></div></div></div></div>';
    const root = nav.querySelector('.nM'), system = root.querySelector('.system'), labels = root.querySelector('.labels');
    const inbox = mailboxRow('Inbox', '#inbox'); inbox.firstElementChild.classList.add('nZ');
    system.querySelector('.TK').append(inbox, ...['Starred', 'Snoozed', 'Sent', 'Scheduled', 'Drafts', 'Categories'].map(name => mailboxRow(name, '#' + name.toLowerCase())));
    labels.querySelector('.TK').append(...['Mgr', 'Projects', 'Projects/Child', 'Internal'].map(name => mailboxRow(name, '#label/' + name, name.includes('/') ? 12 : 0)));
    const toggles = [system, labels].map(section => section.querySelector('[gh=mll]'));
    for (const [index, section] of [system, labels].entries()) {
      const toggle = toggles[index], extra = section.querySelector('.extra');
      toggle.addEventListener('click', () => {
        const open = extra.style.display === 'none'; extra.style.display = open ? '' : 'none';
        toggle.setAttribute('aria-label', (open ? 'Less' : 'More') + ' labels'); toggle.textContent = open ? 'Less' : 'More';
        if (open && !extra.querySelector('.aim')) {
          if (index) extra.firstElementChild.innerHTML = '<div gh="cl"><div class="TK"></div></div>';
          const list = index ? extra.querySelector('.TK') : extra.firstElementChild;
          for (const name of index ? ['Hidden'] : ['Important', 'All Mail', 'Spam', 'Trash', 'Social', 'Updates', 'Forums', 'Promotions']) list.append(mailboxRow(name, index ? '#label/' + name : '#' + name.toLowerCase()));
          if (!index) for (const name of ['Manage subscriptions', 'Manage labels', 'Create new label']) {
            const action = document.createElement('button'); action.textContent = name; list.append(action);
          }
        }
      });
      if (expanded) toggle.click();
    }
    return {...f, nav, root, system, labels, inbox, toggles, title:root.querySelector('.aAv'), list:labels.querySelector('.TK')};
  }
  function addLabelFilters(f) {
    const filters=document.createElement('div');
    filters.className='native-label-filters'; filters.setAttribute('role','toolbar');
    filters.setAttribute('aria-label','search refinement');
    filters.innerHTML='<button type="button">From</button><button type="button">Has attachment</button>';
    const row=document.createElement('div'); row.className='native-mail-action-row';
    // Gmail nests pagination separately from the action group inside this row.
    const pagerOwner=document.createElement('div'); pagerOwner.className='native-pager-owner';
    pagerOwner.append(f.pager); row.append(f.actions,pagerOwner);
    f.toolbar.classList.add('native-label-toolbar'); f.toolbar.prepend(filters,row);
    return {filters,row};
  }
  function captionFixture(hash = '#inbox', name = 'Inbox', total = '500') {
    const f = fixture(); history.replaceState(null, '', hash);
    const selected = document.createElement('div'); selected.className = 'TO nZ';
    const link = document.createElement('a'); link.className = 'n0'; link.href = hash; link.textContent = name;
    selected.append(link); workspace.querySelector('nav').append(selected);
    const range = f.pager.querySelector('[aria-label="Show more messages"]');
    range.setAttribute('role', 'button');
    range.innerHTML = `<span class="ts">1</span>–<span class="ts">50</span> of <span class="ts">${total}</span>`;
    const list = workspace.querySelector('.Nu.tf'); list.style.display = 'flex'; list.style.flexDirection = 'column';
    list.firstElementChild.style.flexShrink = '0';
    return { ...f, range, list, link };
  }
  function spacedListFixture(hash = '#inbox', name = 'Inbox') {
    const f = captionFixture(hash, name);
    // Native Gmail shares spare space between list sections. Include its short
    // content, hidden loading section, and footer so caption placement is real.
    f.list.style.justifyContent = 'space-between';
    f.list.innerHTML = '<div class="ae4" style="height:96px;flex:none">Synthetic conversations</div><div class="zchc9b" style="display:none;margin-top:auto;height:30px">Loading</div><div role="contentinfo" class="l2" style="height:16px;flex:none;margin:16px 0">Synthetic footer</div>';
    return { ...f, content: f.list.querySelector('.ae4'), loading: f.list.querySelector('.zchc9b'), footer: f.list.querySelector('[role="contentinfo"]') };
  }
  function loadingFixture() {
    const f = captionFixture();
    const nav = workspace.querySelector('nav'); nav.replaceChildren();
    const inbox = mailboxRow('Inbox', '#inbox'); inbox.firstElementChild.classList.add('nZ');
    const rows = ['Projects/Alpha', 'Projects/Beta'].map(name => mailboxRow(name));
    nav.append(inbox, ...rows);
    for (const row of [inbox, ...rows]) row.querySelector('a.n0').target='_top';
    const inboxSlot=document.createElement('div'); inboxSlot.className='nL aif'; inboxSlot.style.display='none';
    inbox.querySelector('.TN').append(inboxSlot);
    for (const row of rows) {
      const menu = row.querySelector('[data-label-name]'), slot = document.createElement('div');
      slot.className = 'nL'; slot.style.cssText='display:none;width:20px;height:20px;flex:0 0 20px';
      menu.style.cssText='width:20px;height:20px'; menu.innerHTML='<div class="p6">⋮</div>';
      menu.before(slot); slot.append(menu);
    }
    f.list.innerHTML='<div class="ae4"><table role="grid"><tbody><tr role="row"><td><div role="link"><span data-thread-id="inbox-thread" data-legacy-thread-id="inbox-legacy">Synthetic conversation</span></div></td></tr></tbody></table></div><div class="zchc9b" style="display:none;height:24px">Native loading</div>';
    const identity = () => f.list.querySelector('[data-thread-id]');
    const nativeSelect = row => {
      for (const selected of nav.querySelectorAll('.TO.nZ')) selected.classList.remove('nZ');
      row.firstElementChild.classList.add('nZ');
      history.replaceState(null, '', row.querySelector('a').getAttribute('href'));
      window.dispatchEvent(new Event('hashchange'));
    };
    for (const row of [inbox, ...rows]) row.addEventListener('click', event => {
      if (event.target.closest('.nL')) return;
      event.preventDefault(); if (!row.hasAttribute('data-native-ignore')) nativeSelect(row);
    });
    const click = row => row.querySelector('a').click();
    const commit = (id='loaded-thread') => identity().setAttribute('data-thread-id', id);
    const busy = value => { f.list.querySelector('.zchc9b').style.display=value ? '' : 'none'; };
    return {...f, nav, inbox, alpha:rows[0], beta:rows[1], identity, nativeSelect, click, commit, busy};
  }
  const spinner = () => document.querySelector('.gmail-pro-mailbox-spinner');
  window.addEventListener('resize', nativeResize);
  const start = async (collapsed = false) => { feature.start({appleMailModeEnabled:true, headerCollapsed:collapsed}); await settle(); };
  const control = name => document.querySelector(`[data-gp-header-action="${name}"]`);
  async function test(name, run) {
    try { await run(); passes++; results.textContent += `PASS ${name}\n`; }
    catch (error) { failures++; results.textContent += `FAIL ${name}: ${error.message}\n`; }
    finally { feature.stop(); GmailPro.labelOrder.stop(); workspace.querySelectorAll('.ZF-Av').forEach(node=>node.remove()); }
  }
  if (new URLSearchParams(location.search).has('preview')) {
    if (new URLSearchParams(location.search).has('mailboxes')) mailboxFixture();
    else fixture(Number(new URLSearchParams(location.search).get('width')) || 1400);
    await start(); results.hidden=true; return;
  }
  results.textContent = '';
  await test('mailbox scroll edge stays seamless beneath the logo in both themes and restores on mode OFF', async () => {
    const f = composeFixture(), nav = workspace.querySelector('nav'), pane = document.createElement('div');
    pane.className = 'V3';
    pane.style.height = '164px'; pane.style.overflowY = 'auto';
    f.mailboxes.style.height = '500px'; pane.append(f.mailboxes); nav.append(pane);
    pane.addEventListener('scroll', () => pane.classList.toggle('adh', pane.scrollTop > 0));
    await start(true);
    for (const theme of ['dark', 'light']) {
      document.documentElement.dataset.gpTheme = theme;
      for (const offset of [0, 80, pane.scrollHeight]) {
        pane.scrollTop = offset; await settle();
        const style = getComputedStyle(pane);
        assert((pane.scrollTop > 0) === pane.classList.contains('adh'), 'native scroll state applied');
        assert(style.borderTopColor === 'rgba(0, 0, 0, 0)' && style.boxShadow === 'none', `${theme} scroll edge has no visible border or shadow`);
        assert(style.borderTopWidth === '1px', 'native border geometry preserved');
      }
    }
    assert(pane.scrollTop > 0 && pane.scrollHeight > pane.clientHeight, 'mailboxes still scroll');
    assert(getComputedStyle(nav).borderInlineEndWidth === '1px' && getComputedStyle(f.toolbar).borderBottomWidth === '1px', 'pane and toolbar dividers retained');
    feature.stop(); document.documentElement.classList.remove('gmail-pro-apple-mail-mode');
    assert(getComputedStyle(pane).borderTopColor === 'rgba(255, 255, 255, 0.2)' && getComputedStyle(pane).boxShadow !== 'none', 'native scroll decoration restores');
  });
  await test('Mailboxes header, label-style Inbox and collapsed More preserve native row ownership', async () => {
    const f = mailboxFixture(), parent = f.inbox.parentElement, rows = [...f.list.children]; await start(true);
    const more = f.root.querySelector('.gmail-pro-mailboxes-more'), mgr = f.list.firstElementChild;
    assert(f.title.textContent === 'Mailboxes' && rect(f.title).top >= rect(f.composeShell).bottom, 'header beneath logo');
    assert(rect(f.inbox).top >= rect(f.title).bottom && Math.abs(rect(f.inbox).bottom - rect(mgr).top) < 1, 'Inbox directly above Mgr');
    assert(getComputedStyle(f.inbox.querySelector('.KCRnif')).display === 'none' && getComputedStyle(f.inbox.querySelector('.TN'), '::before').content !== 'none', 'filled label icon');
    assert(rect(more).top >= rect(f.list).bottom && more.getAttribute('aria-expanded') === 'false', 'single More beneath labels');
    assert(rect(f.system.querySelector('a[href="#starred"]')).height === 0, 'extra links collapsed by default');
    assert(f.inbox.parentElement === parent && rows.every((node, i) => f.list.children[i] === node), 'Gmail owns original parent and label sequence');
    f.inbox.querySelector('.bsU').textContent = '12'; await settle();
    assert(f.inbox.querySelector('.bsU').textContent === '12' && f.inbox.querySelector('.TO').classList.contains('nZ'), 'native count and selection retained');
  });
  await test('one keyboard-accessible More reveals system links, management actions and hidden labels', async () => {
    const f = mailboxFixture(); await start(); const more = f.root.querySelector('.gmail-pro-mailboxes-more');
    more.focus(); more.click(); await settle();
    assert(more.tagName === 'BUTTON' && more.getAttribute('aria-expanded') === 'true' && more.textContent === 'Less', 'native button keyboard semantics');
    for (const link of f.system.querySelectorAll('a')) assert(rect(link).height > 0, `${link.textContent} visible`);
    const starred = f.system.querySelector('a[href="#starred"]');
    assert(rect(starred).top >= rect(more).bottom, 'standard links follow More');
    assert(rect(f.labels.querySelector('.extra a')).top >= rect(more).bottom, 'hidden labels are in More');
    let clicks = 0; const action = f.system.querySelector('.extra button'); action.addEventListener('click', () => clicks++); action.click();
    assert(clicks === 1 && [...f.system.querySelectorAll('.extra button')].every(node => rect(node).height > 0), 'original management actions work');
    more.click(); await settle(); assert(rect(starred).height === 0 && rect(f.labels.querySelector('.extra a')).height === 0, 'Less collapses all extras');
    feature.stop(); assert(f.toggles.every(node => node.getAttribute('aria-label') === 'More labels'), 'extension-owned disclosure restored');
  });
  await test('saved label ordering, nested branches and organizer coexist with Inbox', async () => {
    const f = mailboxFixture(), nodes = [...f.list.children];
    GmailPro.labelOrder.start({customLabelOrderEnabled:true, customLabelOrder:['label/Mgr','label/Internal','label/Projects'], sidebarHiddenSublabels:[]});
    await start();
    assert(rect(f.inbox).bottom === rect(nodes[0]).top && rect(nodes[3]).top < rect(nodes[1]).top, 'Inbox and saved label ordering coexist');
    assert(nodes.every((node, i) => f.list.children[i] === node) && rect(nodes[1]).bottom === rect(nodes[2]).top, 'native sequence and nested group retained');
    assert(f.title.parentElement.querySelector('.gmail-pro-label-organize') && f.title.parentElement.querySelector('[aria-label="Create new label"]'), 'heading controls retained');
    assert(GmailPro.labelOrder.edit(), 'organizer opens'); await settle();
    assert(f.root.hasAttribute('data-gp-mailboxes') && f.list.querySelectorAll('.gmail-pro-label-handle').length === 4, 'organizer works in flattened wrappers');
  });
  await test('mode OFF restores headings and disclosures; compact navigation keeps native layout', async () => {
    const f = mailboxFixture(true), parents = [...f.root.children]; await start();
    assert(!f.root.hasAttribute('data-gp-mailboxes-open'), 'defaults collapsed despite native expanded state');
    feature.stop(); assert(f.title.textContent === 'Labels' && !f.root.querySelector('.gmail-pro-mailboxes-more'), 'native headings and controls restored');
    assert(f.toggles.every(node => node.getAttribute('aria-label') === 'Less labels') && parents.every((node,i) => f.root.children[i] === node), 'original expanded state and DOM order restored');
    f.nav.style.width = '72px'; await start(); assert(!f.root.hasAttribute('data-gp-mailboxes'), 'compact layout stays native');
    f.nav.style.width = '200px'; window.dispatchEvent(new Event('resize')); await settle(); assert(f.root.hasAttribute('data-gp-mailboxes'), 'expanded layout recovers');
  });
  await test('sidebar replacement and repeated refresh keep one More and remain idle', async () => {
    const f = mailboxFixture(); await start(); f.root.replaceWith(f.root.cloneNode(true)); await settle();
    const root = f.nav.querySelector('.nM');
    assert(root.hasAttribute('data-gp-mailboxes') && root.querySelectorAll('.gmail-pro-mailboxes-more').length === 1, 'cloned sidebar recovered');
    let writes = 0; const observer = new MutationObserver(records => writes += records.length); observer.observe(root,{childList:true,subtree:true,attributes:true,characterData:true});
    window.dispatchEvent(new Event('resize')); await settle(); observer.disconnect(); assert(writes === 0, 'unchanged sidebar refresh writes nothing');
    feature.stop(); assert(root.querySelector('.aAv').textContent === 'Labels', 'cloned heading restores original wording');
  });
  await test('native Inbox and section rebuilds preserve an open More and original disclosure states', async () => {
    const f = mailboxFixture(); await start(); const more = f.root.querySelector('.gmail-pro-mailboxes-more'); more.focus(); more.click(); await settle();
    f.inbox.replaceWith(f.inbox.cloneNode(true)); await settle();
    assert(f.root.hasAttribute('data-gp-mailboxes-open') && f.root.querySelector('.gmail-pro-mailboxes-more').getAttribute('aria-expanded') === 'true', 'Inbox replacement keeps More open');
    assert(document.activeElement === f.root.querySelector('.gmail-pro-mailboxes-more'), 'keyboard focus follows the replacement toggle');
    const replacement = f.system.cloneNode(true), toggle = replacement.querySelector('[gh=mll]');
    toggle.addEventListener('click', () => {
      const expanded = toggle.getAttribute('aria-label') === 'Less labels';
      toggle.setAttribute('aria-label', (expanded ? 'More' : 'Less') + ' labels');
      replacement.querySelector('.extra').style.display = expanded ? 'none' : '';
    });
    f.system.replaceWith(replacement); await settle();
    assert(f.root.hasAttribute('data-gp-mailboxes-open') && f.root.querySelectorAll('.gmail-pro-mailboxes-more').length === 1, 'section replacement keeps one open toggle');
    feature.stop(); assert([...f.root.querySelectorAll('[gh=mll]')].every(node=>node.getAttribute('aria-label') === 'More labels'), 'initial native disclosure restored even after a rebuilt section');
  });
  await test('unknown sidebar structure leaves native mailbox controls usable', async () => {
    const f = mailboxFixture(); f.system.querySelector('.wT').append(document.createElement('div')); await start();
    assert(!f.root.hasAttribute('data-gp-mailboxes') && f.title.textContent === 'Labels' && rect(f.inbox).height > 0, 'unsupported topology stays native');
  });
  await test('ignored native More actions never retry on header refresh and allow a new user gesture', async () => {
    const f = mailboxFixture(); let attempts = 0;
    f.toggles[0].addEventListener('click', event => { attempts++; event.stopImmediatePropagation(); }, true);
    await start(); const more = f.root.querySelector('.gmail-pro-mailboxes-more'); more.click(); await settle();
    window.dispatchEvent(new Event('resize')); await settle();
    assert(attempts === 1 && rect(f.system.querySelector('a[href="#starred"]')).height > 0, 'one bounded native attempt, primary links usable');
    more.click(); more.click(); await settle(); assert(attempts === 2, 'new explicit opening can retry');
  });
  await test('Compose icon follows selection and frees the native sidebar row', async () => {
    const f=composeFixture(), originalTop=rect(f.mailboxes).top; let clicks=0;
    f.source.addEventListener('click',()=>clicks++);
    await start(true);
    const icon=document.querySelector('.gmail-pro-toolbar-compose');
    assert(f.select.nextElementSibling===icon,'Compose immediately follows Select');
    assert(Math.abs(rect(icon).top+rect(icon).height/2-rect(f.select).top-rect(f.select).height/2)<0.5,'Compose aligned with native checkbox');
    assert(icon.getAttribute('aria-label')==='Compose' && icon.title==='Compose','accessible name and tooltip');
    assert(icon.querySelector('svg') && !icon.textContent,'icon-only presentation');
    assert(rect(f.mailboxes).top<originalTop,'mailboxes move up');
    icon.click(); assert(clicks===1,'one native Compose activation');
    feature.stop(); assert(!icon.isConnected && rect(f.composeShell).height>0,'native sidebar and controls restored');
    assert(f.source.isConnected && !f.composeShell.hasAttribute('data-gp-compose-relocated'),'original button retained');
  });
  await test('Compose recovers after native button and toolbar replacement', async () => {
    const f=composeFixture(); await start();
    const replacement=f.source.cloneNode(true); f.source.replaceWith(replacement); await settle();
    let clicks=0; replacement.addEventListener('click',()=>clicks++);
    document.querySelector('.gmail-pro-toolbar-compose').click(); assert(clicks===1,'replacement receives action');
    f.toolbar.replaceWith(f.toolbar.cloneNode(true)); await settle();
    assert(document.querySelectorAll('.gmail-pro-toolbar-compose').length===1,'one Compose after toolbar replacement');
    window.dispatchEvent(new Event('hashchange')); await settle();
    assert(document.querySelectorAll('.gmail-pro-toolbar-compose').length===1,'one Compose after navigation');
  });
  await test('sidebar wordmark is centered, accent-aware, opens settings, and cleans up', async () => {
    const f=composeFixture(); await start(true);
    const brand=document.querySelector('.gmail-pro-sidebar-brand');
    assert(brand.textContent==='Gmail Pro' && brand.getAttribute('aria-label')==='Open Gmail Pro settings','named wordmark');
    assert(getComputedStyle(brand).fontSize==='21px' && rect(f.composeShell).height===44,'compact popup-sized branding');
    assert(Math.abs(rect(brand).left+rect(brand).width/2-rect(f.composeShell).left-rect(f.composeShell).width/2)<0.5,'centered in sidebar');
    const before=getComputedStyle(brand.querySelector('span')).color;
    document.documentElement.dataset.gpAccent='purple';
    assert(getComputedStyle(brand.querySelector('span')).color!==before,'Pro follows accent');
    const original=globalThis.chrome; let request;
    globalThis.chrome={runtime:{sendMessage:async message=>{request=message;return {ok:true};}}};
    try { brand.click(); await settle(); assert(request?.type==='gmail-pro-open-settings' && !brand.disabled,'settings bridge activated'); }
    finally { globalThis.chrome=original; }
    feature.stop(); assert(!brand.isConnected && getComputedStyle(f.source.parentElement).display!=='none','branding removed and native Compose restored');
  });
  await test('missing selection or unsafe sidebar restores native Compose', async () => {
    const f=composeFixture(); await start(); f.select.remove(); await settle();
    assert(!document.querySelector('.gmail-pro-toolbar-compose') && rect(f.composeShell).height>0,'missing selection restores Compose');
    const replacement=document.createElement('div'); replacement.className='G-as3'; replacement.setAttribute('role','button'); replacement.innerHTML='<span role="checkbox">Select</span>'; f.actions.prepend(replacement);
    f.source.after(document.createElement('button')); await settle();
    assert(!document.querySelector('.gmail-pro-toolbar-compose') && rect(f.composeShell).height>0,'mixed sidebar content never hidden');
  });
  await test('Compose survives compact search and restores when toolbar space is unsafe', async () => {
    const f=composeFixture(); workspace.style.width='1000px'; await start(true);
    assert(document.querySelector('.gmail-pro-toolbar-compose') && !control('search').hidden,'Compose and compact search coexist');
    control('search').click(); await settle(); control('close').click(); await settle();
    assert(document.activeElement===control('search'),'compact focus returns correctly');
    f.actions.style.width='1100px'; await settle();
    assert(!document.querySelector('.gmail-pro-toolbar-compose') && rect(f.composeShell).height>0,'native Compose restored when space is unsafe');
    let mutations=0; const observer=new MutationObserver(records=>{mutations+=records.length;});
    observer.observe(f.actions,{childList:true,subtree:true}); await settle(); observer.disconnect();
    assert(mutations===0,'unsafe layout does not repeatedly add/remove Compose');
  });
  await test('Phish Alert bitmap is neutral in both themes and restores on mode OFF', async () => {
    const f=fixture(), host=document.createElement('div'); host.className='inboxsdk__button'; host.dataset.tooltip='Phish Alert';
    host.innerHTML='<img class="inboxsdk__button_iconImg" alt="Phish Alert">'; f.actions.append(host);
    const img=host.firstElementChild;
    await start(); assert(getComputedStyle(img).filter.includes('grayscale(1)'),'dark neutral tint');
    document.documentElement.dataset.gpTheme='light'; assert(getComputedStyle(img).filter.includes('invert(0.4)'),'light neutral tint');
    document.documentElement.classList.remove('gmail-pro-apple-mail-mode'); assert(getComputedStyle(img).filter==='none','native branding restored');
  });
  await test('native form stays in its parent and fits between actions and pager', async () => {
    const f=fixture(); await start();
    assert(f.form.parentElement===f.parent,'same parent');
    assert(rect(f.form).left>=rect(f.actions).right,'search after actions');
    assert(rect(f.form).right<rect(f.pager).left,'search before pager');
    assert(rect(f.form).height===36,'compact 36px field');
    assert(rect(f.form).top>=rect(f.toolbar).top,'within toolbar');
    assert(control('toggle').getAttribute('aria-expanded')==='true','expanded by default');
    const r=rect(f.input); assert(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===f.input,'native input receives hits');
    assert(Math.abs(r.top+r.height/2-rect(f.form).top-18)<0.5,'plain startup input centered');
  });
  await test('native padded icons and absolutely positioned text stay vertically centered', async () => {
    const f=fixture();
    f.form.querySelector('[gh=sb]').innerHTML='<table class="native-search-table"><tbody><tr><td><table><tbody><tr><td class="gsib_a"><div><input name="q" aria-label="Search mail"><input aria-hidden="true" class="ghost"></div></td></tr></tbody></table></td></tr></tbody></table>';
    f.form.querySelector('button').innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12h18"/></svg>';
    await start(true);
    const input=f.form.querySelector('input'), icon=f.form.querySelector('svg');
    assert(rect(icon).left>=rect(f.form).left && rect(icon).right<=rect(f.form).right,'icon stays inside field');
    const centered=()=>{ const center=rect(f.form).top+18; for (const node of [input,icon]) assert(Math.abs(rect(node).top+rect(node).height/2-center)<0.5,'contents centered in search row'); };
    centered();
    f.form.querySelector('.gssb_c').style.display='table'; await settle(); centered();
    feature.stop(); assert(getComputedStyle(icon).paddingTop==='8px','native icon padding restored');
    assert(getComputedStyle(input.parentElement).height==='0px','native input wrapper restored');
  });
  await test('search width stays fixed across selection actions and uses compact fallback', async () => {
    const f=fixture(); await start();
    assert(rect(f.form).width===360,'fixed field width');
    f.actions.style.width='620px'; await settle();
    assert(control('search').hidden && rect(f.form).width===360,'more actions do not shrink field');
    f.actions.style.width='760px'; await settle();
    assert(!control('search').hidden,'crowded toolbar uses icon');
    control('search').click(); await settle();
    assert(rect(f.form).width===360,'compact overlay retains width when it fits');
    f.actions.style.width='360px'; await settle();
    assert(control('search').hidden && rect(f.form).width===360,'cleared selection restores same width');
  });
  await test('collapse reclaims pane height and retains search accessibility', async () => {
    const f=fixture(); await start(); const before=rect(workspace.querySelector('.Nu')).height, original=rect(f.shell).height;
    control('toggle').click(); await settle();
    assert(saved.headerCollapsed===true,'saved collapse');
    assert(rect(f.shell).height===0,'no reserved header space');
    assert(rect(workspace.querySelector('.Nu')).height>=before+original-1,'pane gains header height');
    assert(getComputedStyle(f.form).visibility==='visible','search visible');
    assert(getComputedStyle(workspace.querySelector('[aria-label=Settings]')).visibility==='hidden','header controls hidden');
    assert(!f.form.closest('[aria-hidden=true],[inert]'),'no inaccessible ancestor');
    control('toggle').click(); await settle(); assert(rect(f.shell).height===original,'height restored');
  });
  await test('right split fills Gmail viewport despite a cached main height', async () => {
    const f=fixture(), main=f.toolbar.closest('main'), viewport=document.createElement('div');
    viewport.className='Tm'; viewport.style.cssText='flex:1;height:calc(100vh - 16px)';
    main.before(viewport); viewport.append(main); main.style.height='calc(100vh - 80px)';
    main.querySelector('.panes').classList.add('Nr','Nm');
    await start(true); assert(Math.abs(rect(main).bottom-rect(viewport).bottom)<1,'main fills measured viewport');
    feature.stop(); assert(main.style.height==='calc(-80px + 100vh)' || main.style.height==='calc(100vh - 80px)','native height preserved');
    assert(!main.hasAttribute('data-gp-header-main'),'override removed');
  });
  await test('saved collapse is applied at startup', async () => { const f=fixture(); await start(true); assert(rect(f.shell).height===0,'saved choice'); assert(Object.keys(saved).length===0,'no startup write'); });
  await test('narrow icon opens and closes without losing query', async () => {
    const f=fixture(1000); await start(true); f.input.value='subject:synthetic';
    assert(!control('search').hidden,'search icon shown'); assert(rect(f.form).right<0,'field concealed');
    control('search').click(); await settle();
    assert(document.activeElement===f.input && rect(f.form).left>=0,'native input focused onscreen');
    control('close').click(); await settle();
    assert(f.input.value==='subject:synthetic','query preserved'); assert(document.activeElement===control('search'),'focus returned');
  });
  await test('native programmatic search focus opens compact field', async () => {
    const f=fixture(1000); await start(true); f.input.focus(); await settle();
    assert(rect(f.form).left>=0 && !control('close').hidden,'native focus reveals search');
  });
  await test('Escape closes compact search after Gmail popups are dismissed', async () => {
    const f=fixture(1000); await start(); control('search').click(); await settle();
    const suggestions=f.form.querySelector('.gssb_c'); suggestions.style.display='table';
    f.input.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true})); await settle();
    assert(rect(f.form).left>=0,'native popup gets Escape first');
    suggestions.style.display='none'; f.input.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true})); await settle();
    assert(document.activeElement===control('search'),'closed field returns focus');
  });
  await test('suggestions keep native size and are not clipped', async () => {
    const f=fixture(); await start(true); const table=f.form.querySelector('.gssb_c'); table.style.display='table'; await settle();
    assert(rect(table).height>0 && getComputedStyle(table).visibility==='visible','suggestions visible under collapsed header');
    assert(rect(f.form).height>36,'form grows with native suggestions');
  });
  await test('advanced filter panel interaction does not close compact search', async () => {
    const f=fixture(1000); await start(true); control('search').click(); await settle();
    const panel=document.createElement('div'); panel.className='ZF-Av'; panel.innerHTML='<div class="ZF-zT"><input aria-label="From"></div>'; workspace.append(panel);
    panel.querySelector('input').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true})); await settle();
    assert(!control('close').hidden,'search stays open with filters');
    assert(Math.abs(rect(panel).left-rect(f.form).left)<1,'native panel follows relocated field');
    feature.stop(); assert(!panel.hasAttribute('data-gp-search-panel'),'native popup positioning restored');
  });
  await test('native submit listener receives unchanged query', async () => { const f=fixture(); await start(); f.input.value='in:inbox synthetic'; f.form.requestSubmit(); assert(f.form.dataset.submitted==='in:inbox synthetic','native submit preserved'); });
  await test('toolbar replacement reattaches without duplicate controls', async () => {
    const f=fixture(); await start(true); f.toolbar.replaceWith(f.toolbar.cloneNode(true)); await settle();
    assert(document.querySelectorAll('.gmail-pro-header-controls').length===1,'one controls group'); assert(rect(f.form).top<50,'search in replacement toolbar');
  });
  await test('native search form replacement is rediscovered', async () => {
    const f=fixture(); await start(); const replacement=f.form.cloneNode(true); replacement.removeAttribute('data-gp-toolbar-search'); replacement.removeAttribute('style'); f.form.replaceWith(replacement); await settle();
    assert(replacement.hasAttribute('data-gp-toolbar-search'),'new native form positioned'); assert(!f.form.hasAttribute('data-gp-toolbar-search'),'old form restored');
  });
  await test('resizing and action changes choose icon then restore full field', async () => {
    const f=fixture(); await start(); f.actions.style.width='760px'; await settle(); assert(!control('search').hidden,'larger native action group triggers icon');
    f.actions.style.width='360px'; await settle(); assert(control('search').hidden,'field returns automatically');
    workspace.style.width='1000px'; await settle(); assert(!control('search').hidden,'resize triggers icon');
  });
  await test('missing or ambiguous toolbar restores native header and search', async () => {
    const f=fixture(); await start(true); const clone=f.toolbar.cloneNode(true); f.toolbar.after(clone); await settle();
    assert(rect(f.shell).height>0 && !f.form.hasAttribute('data-gp-toolbar-search'),'native fallback');
    clone.remove(); await settle(); assert(rect(f.shell).height===0,'saved collapse resumes when unambiguous');
  });
  await test('insufficient room restores a usable native layout', async () => {
    const f=fixture(700); await start(true); assert(!f.form.hasAttribute('data-gp-toolbar-search') && rect(f.shell).height>0,'safe native fallback');
  });
  await test('route changes close compact overlay and retain saved collapse', async () => {
    const f=fixture(1000); await start(true); control('search').click(); await settle(); control('toggle').focus(); window.dispatchEvent(new Event('hashchange')); await settle();
    assert(control('close').hidden && rect(f.shell).height===0,'navigation resets temporary overlay');
  });
  await test('mail views hide redundant filter chips and reclaim space while retaining advanced search', async () => {
    for (const collapsed of [false,true]) {
      const f=composeFixture(), {filters,row}=addLabelFilters(f); await start(collapsed);
      assert(rect(filters).height===0 && getComputedStyle(filters).display==='none','redundant filter row hidden');
      assert(rect(f.toolbar).height===49,'single toolbar row reclaims filter space');
      assert(f.form.getAttribute('data-gp-toolbar-search')==='field','inline field remains available');
      assert(rect(f.form).width===360 && Math.abs(rect(f.form).top+18-rect(row).top-rect(row).height/2)<0.5,'search centered on mail actions');
      assert((rect(f.shell).height===0)===collapsed,'saved header preference respected');
      assert(f.form.parentElement===f.parent,'native search ownership unchanged');
      assert(document.querySelectorAll('.gmail-pro-toolbar-compose').length===1 && document.querySelector('.gmail-pro-sidebar-brand'),'Compose and branding retained');
      const advanced=f.form.querySelector('[aria-label="Advanced search options"]');
      let clicks=0; advanced.addEventListener('click',()=>clicks++);
      const target=rect(advanced);
      assert(document.elementFromPoint(target.x+target.width/2,target.y+target.height/2)===advanced,'native advanced search receives hits');
      advanced.click(); assert(clicks===1,'native advanced-search handler retained');
      feature.stop(); document.documentElement.classList.remove('gmail-pro-apple-mail-mode');
      assert(!f.form.hasAttribute('data-gp-toolbar-search') && rect(f.shell).height>0 && rect(filters).height===32 && rect(f.toolbar).height===101,'mode OFF restores native filters and toolbar height');
    }
  });
  await test('Inbox, mailboxes, and replacement action rows retain one consistent header', async () => {
    const f=composeFixture(); f.input.value='label:synthetic'; await start(true);
    const label=addLabelFilters(f); await settle();
    assert(f.form.hasAttribute('data-gp-toolbar-search') && rect(f.shell).height===0,'filter insertion discovered without route event');
    assert(rect(label.filters).height===0 && rect(f.toolbar).height===49,'late filter row hidden without leaving a gap');
    label.row.replaceWith(label.row.cloneNode(true)); window.dispatchEvent(new Event('hashchange')); await settle();
    assert(f.form.hasAttribute('data-gp-toolbar-search') && document.querySelectorAll('.gmail-pro-toolbar-compose').length===1,'replacement row recovered without duplicate Compose');
    const row=f.toolbar.querySelector('.native-mail-action-row');
    f.toolbar.append(...row.children); row.remove(); label.filters.remove(); f.toolbar.classList.remove('native-label-toolbar');
    window.dispatchEvent(new Event('popstate')); await settle();
    assert(f.form.hasAttribute('data-gp-toolbar-search') && rect(f.shell).height===0,'returning to Inbox retains collapse');
    assert(document.querySelectorAll('.gmail-pro-header-controls').length===1 && document.querySelectorAll('.gmail-pro-toolbar-compose').length===1,'one header and Compose after round trip');
    assert(f.input.value==='label:synthetic' && f.form.parentElement===f.parent,'query and native ownership retained');
  });
  await test('compact search stays aligned when hidden mailbox filters change height', async () => {
    const f=fixture(1000), {filters,row}=addLabelFilters(f); f.input.value='synthetic'; await start(true);
    assert(control('search') && !control('search').hidden,'compact search available on labels');
    control('search').click(); await settle();
    assert(document.activeElement===f.input && f.form.getAttribute('data-gp-toolbar-search')==='field','original search focused');
    const top=rect(f.form).top;
    filters.style.height='64px'; f.toolbar.style.height='133px'; await settle();
    assert(rect(filters).height===0 && rect(f.toolbar).height===49 && rect(f.form).top===top,'hidden filter changes reserve no extra space');
    assert(Math.abs(rect(f.form).top+18-rect(row).top-rect(row).height/2)<0.5,'search stays centered on action row');
    window.dispatchEvent(new Event('hashchange')); await settle();
    assert(control('close').hidden && rect(f.shell).height===0 && f.input.value==='synthetic','navigation closes overlay and retains query/preference');
  });
  await test('an oversized mail-action row still restores usable native layout', async () => {
    const f=fixture(), {row}=addLabelFilters(f); row.style.height='100px'; f.toolbar.style.height='181px';
    await start(true); assert(!f.form.hasAttribute('data-gp-toolbar-search') && rect(f.shell).height>0,'unsupported action row falls back safely');
  });
  await test('failed preference write restores previous layout and offers retry', async () => {
    const f=fixture(); await start(); failSave=true; control('toggle').click(); await settle();
    assert(rect(f.shell).height>0,'reverted failed save'); assert(document.querySelector('[role=status]').textContent.includes('try again'),'visible error');
    failSave=false; control('toggle').click(); await settle(); assert(rect(f.shell).height===0 && saved.headerCollapsed,'retry succeeds');
  });
  await test('disable during pending write cannot reactivate the layout', async () => {
    const f=fixture(); await start(); saveResolve=true; control('toggle').click(); await settle(); feature.stop(); saveResolve(); await settle();
    assert(!f.form.hasAttribute('data-gp-toolbar-search') && !document.querySelector('.gmail-pro-header-controls'),'late write cannot restore UI');
  });
  await test('OFF restores styles and later navigation stays inert', async () => {
    const f=fixture(); const parent=f.form.parentElement; await start(true); feature.update({appleMailModeEnabled:false}); await settle();
    assert(f.form.parentElement===parent && !f.form.hasAttribute('data-gp-toolbar-search'),'native form restored');
    assert(!f.form.style.getPropertyValue('--gp-search-left'),'position removed'); assert(rect(f.shell).height>0,'header restored');
    window.dispatchEvent(new Event('hashchange')); f.actions.style.width='620px'; await settle();
    assert(!document.querySelector('.gmail-pro-header-controls'),'listeners and observers stopped');
  });
  await test('repeated start does not duplicate controls', async () => { fixture(); await start(); await start(); assert(document.querySelectorAll('.gmail-pro-header-controls').length===1,'one controller'); });
  await test('late initial shell is discovered without navigation', async () => {
    fixture(); const markup=workspace.innerHTML; workspace.replaceChildren(); await start();
    assert(!document.querySelector('.gmail-pro-header-controls'),'no UI before shell');
    workspace.innerHTML=markup; await settle(); assert(control('toggle'),'late shell discovered');
  });
  await test('idle and received-message mutations cause no header writes', async () => {
    const f=fixture(); await start(true); let writes=0;
    const observer=new MutationObserver(records=>{writes+=records.length;});
    observer.observe(f.form,{attributes:true}); observer.observe(control('toggle').parentElement,{attributes:true,subtree:true});
    const body=workspace.querySelector('.ii');
    for (let i=0;i<100;i++) body.append(document.createTextNode('synthetic'));
    await settle(); observer.disconnect(); assert(writes===0,'no work from message mutations or idle frames');
  });
  const caption = () => document.querySelector('.gmail-pro-mailbox-caption');
  await test('mailbox caption uses the native total and occupies only 22px in the list', async () => {
    const f = captionFixture(), paneTop = rect(workspace.querySelector('.Nu.S3')).top;
    await start(true);
    assert(caption().textContent === 'Inbox • 500 messages', 'total rather than 50 visible conversations');
    assert(!f.list.contains(caption()) && f.list.hasAttribute('data-gp-mailbox-caption') && rect(caption()).height === 22, 'slim caption outside native scroll surface');
    assert(Math.abs(rect(caption()).top - rect(f.toolbar).bottom) < 1, 'directly below toolbar border');
    assert(rect(workspace.querySelector('.Nu.S3')).top < paneTop && rect(workspace.querySelector('.Nu.S3')).top === rect(f.list).top, 'reading pane receives no caption gap');
    assert(getComputedStyle(caption()).fontSize === '11px', 'small text');
    const top = rect(caption()).top; f.list.scrollTop = 80; await settle();
    assert(rect(caption()).top === top, 'caption remains pinned during native list scrolling');
    feature.stop(); assert(!caption(), 'OFF removes caption');
  });
  await test('short mailbox and label lists stay directly beneath the caption after native layout changes', async () => {
    for (const [hash, name] of [['#inbox','Inbox'],['#sent','Sent'],['#starred','Starred'],['#snoozed','Snoozed'],['#label/Projects%2FFlowserve','Flowserve'],['#search/synthetic','Search results']]) {
      for (const collapsed of [false, true]) {
        feature.stop(); const f = spacedListFixture(hash, name); await start(collapsed);
        const check = () => {
          assert(Math.abs(rect(f.content).top - rect(caption()).bottom) < 1, name + ': conversations immediately follow caption');
          assert(Math.abs(rect(f.footer).bottom + 16 - rect(f.list).bottom) < 1, name + ': short-list footer remains at bottom');
        };
        check();
        for (const height of [48, 288]) {
          f.content.style.height = height + 'px'; window.dispatchEvent(new Event('resize')); await settle(); check();
        }
        f.loading.style.display = 'flex'; await settle(); check();
        f.loading.style.display = 'none'; f.content.replaceWith(f.content.cloneNode(true));
        f.content = f.list.querySelector('.ae4'); window.dispatchEvent(new Event('hashchange')); await settle(); check();
        feature.stop(); assert(!caption(), 'caption removed on OFF');
        assert(Math.abs(rect(f.content).top - rect(f.list).top) < 1 && getComputedStyle(f.content).marginBottom === '0px', 'native spacing restored');
      }
    }
  });
  await test('long lists keep native scrolling with no gap before conversations', async () => {
    const f = spacedListFixture(); f.content.style.height = '1500px'; await start(true);
    assert(Math.abs(rect(f.content).top - rect(caption()).bottom) < 1, 'overflowing list immediately follows caption');
    const scrollHeight = f.list.scrollHeight, top = rect(caption()).top;
    f.list.scrollTop = 100; await settle();
    assert(f.list.scrollTop === 100 && f.list.scrollHeight === scrollHeight && rect(caption()).top === top, 'native scrolling and fixed caption retained');
  });
  await test('caption belongs to the toolbar outside the native scroll surface', async () => {
    const f = spacedListFixture('#label/Projects%2FFlowserve', 'Flowserve');
    f.content.style.height = '1500px'; await start(true);
    assert(!f.list.contains(caption()) && caption().parentElement === f.toolbar, 'caption outside scrolling pane, within toolbar');
    assert(getComputedStyle(caption()).position === 'absolute', 'toolbar-anchored header');
    const before = rect(caption()).toJSON();
    assert(document.elementFromPoint(before.left + before.width / 2, before.top + before.height / 2) === caption(), 'caption shields scrolled rows from header clicks');
    let writes = 0; const observer = new MutationObserver(records => { writes += records.length; });
    observer.observe(caption(), { attributes: true, characterData: true, childList: true, subtree: true });
    for (const offset of [1, 12, 150, 600, 10000, 0]) {
      f.list.scrollTop = offset; await settle();
      assert(rect(caption()).top === before.top && rect(caption()).left === before.left && rect(caption()).width === before.width, 'fixed bounds throughout native scrolling');
      assert(document.elementFromPoint(before.left + before.width / 2, before.top + before.height / 2) === caption(), 'scrolled content cannot cover the caption');
    }
    observer.disconnect(); assert(writes === 0, 'scrolling never rewrites caption');
    f.list.style.flex = 'none'; f.list.style.width = '320px'; await settle();
    assert(Math.abs(rect(caption()).width - rect(f.list).width) < 1, 'caption follows native splitter width');
    f.list.scrollTop = 100;
    feature.update({ headerCollapsed: false }); await settle();
    assert(Math.abs(rect(caption()).top - rect(f.toolbar).bottom) < 1 && f.list.scrollTop === 100, 'header expansion moves caption without resetting scroll');
    feature.stop(); assert(!caption() && !f.list.hasAttribute('data-gp-mailbox-caption'), 'OFF cleans up caption and reserved space');
  });
  await test('caption is locked to its toolbar through rapid scroll-pane movement', async () => {
    const f = spacedListFixture('#label/Projects%2FFlowserve', 'Flowserve');
    f.content.style.height = '1500px'; await start(true);
    assert(caption().parentElement === f.toolbar, 'caption is part of the toolbar itself');
    const anchor = rect(f.toolbar).bottom;
    let writes = 0; const observer = new MutationObserver(records => { writes += records.length; });
    observer.observe(caption(), { attributes: true });
    for (const shift of [12, -8, 25, -15, 0]) {
      f.list.style.transform = `translateY(${shift}px)`;
      f.list.scrollTop = shift > 0 ? 600 : 0; await settle();
      assert(rect(caption()).top === anchor && rect(f.toolbar).bottom === anchor, 'caption follows toolbar, never transient pane coordinates');
    }
    observer.disconnect(); assert(writes === 0, 'pane movement cannot rewrite caption positioning');
    assert(!caption().style.getPropertyValue('--gp-caption-top') && !caption().style.getPropertyValue('--gp-caption-left'), 'no independent screen positioning');
    f.toolbar.replaceWith(f.toolbar.cloneNode(true)); await settle();
    const replacement = workspace.querySelector('[gh=tm]');
    assert(caption().parentElement === replacement && Math.abs(rect(caption()).top - rect(replacement).bottom) < 1, 'native toolbar replacement retains its own caption');
    assert(document.querySelectorAll('.gmail-pro-mailbox-caption').length === 1, 'no duplicate captions');
  });
  await test('nested labels show a decoded final name, including literal markup characters', async () => {
    const f = captionFixture('#label/Projects%2FCustomers%2FFlowserve', 'Projects/Customers/Flowserve', '231');
    f.link.href = '#label/Projects/Customers/Flowserve'; await start();
    assert(caption().textContent === 'Flowserve • 231 messages', 'last label component');
    feature.stop(); captionFixture('#label/Projects%2F%3Cb%3E%20%26%20Co', '<b> & Co', '1,250'); await start();
    assert(caption().textContent === '<b> & Co • 1,250 messages' && !caption().querySelector('b'), 'safe text and formatted total');
  });
  await test('caption follows all native mailboxes and search results', async () => {
    for (const [route, name] of [['sent','Sent'],['starred','Starred'],['snoozed','Snoozed'],['drafts','Drafts'],['all','All Mail'],['important','Important'],['spam','Spam'],['trash','Trash'],['scheduled','Scheduled']]) {
      feature.stop(); captionFixture('#' + route, name); await start(); assert(caption().textContent === name + ' • 500 messages', name);
    }
    feature.stop(); const f = captionFixture('#search/subject%3Asynthetic', ''); f.link.parentElement.remove(); await start();
    assert(caption().textContent === 'Search results • 500 messages', 'search title');
  });
  await test('caption persists through floating draft URL changes for Reply, Reply All and Forward', async () => {
    for (const [hash, name] of [['#inbox','Inbox'],['#sent','Sent'],['#label/Projects%2FFlowserve/p2','Flowserve'],['#search/subject%3Asynthetic/p2','Search results']]) {
      for (const action of ['Reply', 'Reply All', 'Forward']) {
        const f = captionFixture(hash, name); f.link.href = hash.replace(/\/p[1-9]\d*$/, ''); await start(true);
        const original = caption(), bounds = rect(original).toJSON(), expected = name + ' • 500 messages';
        const draft = document.createElement('div'); draft.setAttribute('role', 'dialog');
        draft.innerHTML = `<form><input name="composeid" value="synthetic"><textarea aria-label="${action} draft"></textarea></form>`;
        workspace.append(draft); await settle();
        for (const suffix of ['?compose=new-draft', '?compose=saved-draft', '?compose=saved-draft,second-draft', '']) {
          history.replaceState(null, '', hash + suffix); window.dispatchEvent(new Event('hashchange')); await settle();
          assert(caption() === original && caption().textContent === expected, action + ': native draft state keeps the mailbox name and total');
          assert(rect(caption()).top === bounds.top && rect(caption()).width === bounds.width && f.list.hasAttribute('data-gp-mailbox-caption'), action + ': caption position and reserved space persist');
        }
        draft.remove(); feature.stop();
        assert(!caption() && !f.list.hasAttribute('data-gp-mailbox-caption'), 'mode OFF still cleans up');
      }
    }
  });
  await test('draft parameters preserve encoded question marks in label names and search identity', async () => {
    const label = '#label/Projects%2FQuestions%3Fcompose%3Dliteral';
    captionFixture(label, 'Questions?compose=literal', '231');
    history.replaceState(null, '', label + '?compose=synthetic'); await start();
    assert(caption()?.textContent === 'Questions?compose=literal • 231 messages', 'only the actual URL parameter is removed');
    feature.stop();
    const search = '#search/subject%3Aquestions%3Fcompose%3Dliteral'; captionFixture(search, 'Search results');
    history.replaceState(null, '', search + '?compose=synthetic'); await start();
    history.replaceState(null, '', search + '?compose=saved'); window.dispatchEvent(new Event('hashchange')); await settle();
    assert(caption()?.textContent === 'Search results • 500 messages', 'draft identity changes never invalidate an unchanged search count');
  });
  await test('native totals update and mailbox navigation stays conservative while a draft is open', async () => {
    const f = captionFixture(); history.replaceState(null, '', '#inbox?compose=synthetic'); await start();
    assert(caption()?.textContent === 'Inbox • 500 messages', 'startup with an open draft retains the total');
    f.range.querySelectorAll('.ts')[2].firstChild.data = '501'; await settle();
    assert(caption()?.textContent === 'Inbox • 501 messages', 'live native total remains the source of truth');
    const label = '#label/Projects%2FFlowserve'; f.link.href = label; f.link.textContent = 'Flowserve';
    history.replaceState(null, '', label + '?compose=synthetic'); window.dispatchEvent(new Event('hashchange')); await settle();
    assert(caption()?.textContent === 'Flowserve', 'a different mailbox never inherits the previous total');
    f.range.querySelectorAll('.ts')[2].firstChild.data = '231'; await settle();
    assert(caption()?.textContent === 'Flowserve • 231 messages', 'the new native count completes navigation');
  });
  await test('native count edits update singular, approximate and unavailable totals', async () => {
    const f = captionFixture(); await start();
    f.range.innerHTML = '<span class="ts">1</span>–<span class="ts">1</span> of <span class="ts">1</span>'; await settle();
    assert(caption().textContent === 'Inbox • 1 message', 'singular');
    f.range.querySelectorAll('.ts')[2].firstChild.data = '2,013'; await settle();
    assert(caption().textContent === 'Inbox • 2,013 messages', 'in-place native text mutation');
    f.range.innerHTML = '<span class="ts">1</span>–<span class="ts">50</span> of about <span class="ts">2,013</span>'; await settle();
    assert(caption().textContent === 'Inbox • about 2,013 messages', 'approximation preserved');
    f.range.innerHTML = '<span class="ts">1</span>–<span class="ts">50</span> of <span class="ts">many</span>'; await settle();
    assert(caption().textContent === 'Inbox', 'unknown total is never invented');
  });
  await test('navigation withholds an old count until native pagination updates, including equal totals', async () => {
    const f = captionFixture(); await start();
    history.replaceState(null, '', '#label/Projects%2FFlowserve'); f.link.href = location.hash; f.link.textContent = 'Flowserve';
    window.dispatchEvent(new Event('hashchange')); await settle();
    assert(caption().textContent === 'Flowserve', 'new name does not use Inbox total');
    f.range.querySelectorAll('.ts')[2].firstChild.data = '500'; await settle();
    assert(caption().textContent === 'Flowserve • 500 messages', 'equal native count still completes transition');
    history.replaceState(null, '', location.hash + '/p2'); window.dispatchEvent(new Event('hashchange')); await settle();
    assert(caption().textContent === 'Flowserve • 500 messages', 'pagination retains mailbox identity');
  });
  await test('explicit native empty state shows zero and missing structure stays conservative', async () => {
    const f = captionFixture('#snoozed', 'Snoozed'); f.range.remove();
    f.list.innerHTML = '<div class="ae4"><table role="grid"><tbody></tbody></table><table><tbody><tr><td class="TC" style="height:28px">No snoozed conversations</td></tr></tbody></table></div>';
    await start(); assert(caption().textContent === 'Snoozed • 0 messages', 'confirmed empty');
    f.list.querySelector('.TC').remove(); window.dispatchEvent(new Event('hashchange')); await settle();
    assert(caption().textContent === 'Snoozed', 'missing native count is not zero');
  });
  await test('caption recovers from replaced and cloned list roots without duplicates', async () => {
    const f = captionFixture(); await start();
    f.list.replaceWith(f.list.cloneNode(true)); await settle();
    assert(document.querySelectorAll('.gmail-pro-mailbox-caption').length === 1 && caption().textContent === 'Inbox • 500 messages', 'one caption in replacement list');
    assert(!f.list.hasAttribute('data-gp-mailbox-caption') && workspace.querySelector('.Nu.tf').hasAttribute('data-gp-mailbox-caption'), 'reserved space follows replacement owner');
    caption().remove(); await settle(); assert(caption()?.isConnected, 'native removal recovered');
    await start(); assert(document.querySelectorAll('.gmail-pro-mailbox-caption').length === 1, 'repeated start');
  });
  await test('caption is legible in both themes, truncates long labels, and remains idle', async () => {
    const f = captionFixture('#label/Projects%2F' + 'Long'.repeat(60), 'Long'.repeat(60)); await start();
    assert(getComputedStyle(caption()).textOverflow === 'ellipsis' && rect(caption()).width <= rect(f.list).width, 'bounded long title');
    assert(caption().title === caption().textContent, 'complete title available');
    const dark = getComputedStyle(caption()).color;
    document.documentElement.dataset.gpTheme = 'light'; assert(getComputedStyle(caption()).color !== dark, 'theme-aware neutral color');
    let writes = 0; const observer = new MutationObserver(records => { writes += records.length; });
    observer.observe(caption(), { childList: true, characterData: true, attributes: true, subtree: true });
    for (let i=0; i<100; i++) workspace.querySelector('.ii').append(document.createTextNode('synthetic'));
    window.dispatchEvent(new Event('resize')); await settle(); observer.disconnect();
    assert(writes === 0, 'no caption writes from unchanged counts or message contents');
  });
  await test('mailbox spinner appears before native click handling and restores the original dots on load', async () => {
    const f=loadingFixture(); await start(); const menu=f.alpha.querySelector('[data-label-name]'), dot=menu.firstElementChild;
    const original=menu.innerHTML, nativeThread=f.identity(); let immediate=false, menus=0;
    f.alpha.addEventListener('click', () => { immediate=!!spinner(); }); menu.addEventListener('click',()=>menus++);
    f.click(f.alpha);
    assert(immediate && spinner()?.getAttribute('role')==='status', 'synchronous accessible feedback');
    assert(f.identity()===nativeThread && nativeThread.getAttribute('data-thread-id')==='inbox-thread', 'current messages retained while Gmail loads');
    assert(getComputedStyle(dot).visibility==='hidden' && getComputedStyle(spinner(),'::before').borderTopWidth==='2px', 'ring replaces native dots');
    assert(rect(menu).width===20 && rect(menu).height===20, 'native menu geometry unchanged');
    await settle(); assert(spinner(), 'route/selection changes alone never indicate loaded');
    f.commit(); await settle();
    assert(!spinner() && menu.innerHTML===original && !menu.hasAttribute('data-gp-mailbox-loading') && !menu.parentElement.hasAttribute('data-gp-mailbox-loading'), 'original nodes/attributes restored');
    dot.click(); assert(menus===1 && menu.firstElementChild===dot, 'native menu handlers remain intact');
  });
  await test('native Inbox uses its existing empty indicator slot and restores it after loading', async () => {
    const f=loadingFixture(); await start(); f.click(f.alpha); f.commit('alpha-ready'); await settle();
    const slot=f.inbox.querySelector('.nL'), original=slot.outerHTML;
    f.click(f.inbox); assert(slot.contains(spinner()), 'Inbox immediately owns feedback');
    const box=spinner().getBoundingClientRect(); assert(box.width===20 && box.height===20, 'empty native slot provides a stable ring area');
    await settle(); assert(spinner(), 'Inbox route alone still waits for content');
    f.commit('inbox-ready'); await settle(); assert(!spinner() && slot.outerHTML===original, 'native empty slot fully restored');
  });
  await test('staged mailbox rows wait for native identity metadata before clearing the spinner', async () => {
    const f=loadingFixture(); await start(); f.click(f.alpha); await settle();
    const table=f.list.querySelector('table'); table.replaceWith(table.cloneNode(true));
    const identity=f.identity(); identity.removeAttribute('data-thread-id'); await settle();
    assert(spinner(), 'incomplete replacement does not signal completion');
    identity.setAttribute('data-thread-id','alpha-ready'); await settle(); assert(!spinner(), 'late native metadata completes load');
  });
  await test('native loading keeps the spinner until completion even when rows and counts update early', async () => {
    const f=loadingFixture(); await start(); f.click(f.alpha); f.busy(true); await settle();
    f.commit(); f.range.querySelectorAll('.ts')[2].textContent='12'; await settle();
    assert(spinner(), 'still busy during progressive loading');
    f.busy(false); await settle(); assert(!spinner(), 'native loading completion clears');
    f.click(f.beta); f.busy(true); f.busy(false); await settle();
    assert(!spinner(), 'cached loading cycle within one mutation batch clears too');
  });
  await test('rapid mailbox clicks move one spinner and ignore completion from the earlier destination', async () => {
    const f=loadingFixture(); await start(); f.click(f.alpha); f.busy(true); await settle();
    f.click(f.beta); assert(document.querySelectorAll('.gmail-pro-mailbox-spinner').length===1 && f.beta.contains(spinner()) && !f.alpha.querySelector('[data-gp-mailbox-loading]'), 'latest destination owns one spinner');
    f.commit('late-alpha'); await settle(); assert(f.beta.contains(spinner()), 'earlier rows cannot clear a still-loading destination');
    f.commit('beta-ready'); f.busy(false); await settle(); assert(!spinner(), 'latest load completes');
  });
  await test('same-count and empty mailboxes clear loading using native completion evidence', async () => {
    const f=loadingFixture(); await start(); f.click(f.alpha); await settle();
    f.range.querySelectorAll('.ts')[2].firstChild.data='500'; await settle();
    assert(!spinner(), 'equal native count commit completes an identical cached list');
    f.click(f.beta); await settle(); f.range.remove();
    f.list.querySelector('.ae4').innerHTML='<table role="grid"><tbody></tbody></table><table><tbody><tr><td class="TC">No conversations</td></tr></tbody></table>';
    await settle(); assert(!spinner(), 'confirmed native empty state completes');
  });
  await test('mailbox spinner rebinds native sidebar/menu replacements and releases detached owners', async () => {
    const f=loadingFixture(); await start(); f.click(f.alpha); await settle();
    const oldSlot=f.alpha.querySelector('.nL'), clone=f.alpha.cloneNode(true); f.alpha.replaceWith(clone);
    await settle(); assert(clone.contains(spinner()) && document.querySelectorAll('.gmail-pro-mailbox-spinner').length===1, 'cloned sidebar rebinds without duplicates');
    assert(!oldSlot.hasAttribute('data-gp-mailbox-loading') && !oldSlot.querySelector('.gmail-pro-mailbox-spinner'), 'detached slot released');
    f.commit(); await settle(); assert(!spinner() && !clone.querySelector('[data-gp-mailbox-loading]'), 'clone completion releases inherited marks');
  });
  await test('menu, expansion, modified clicks, current mailbox and mode OFF retain native behavior', async () => {
    const f=loadingFixture(); await start();
    for (const modifiers of [{ctrlKey:true},{metaKey:true},{shiftKey:true},{altKey:true}]) {
      f.alpha.querySelector('a').dispatchEvent(new MouseEvent('click',{bubbles:true,button:0,...modifiers}));
      assert(!spinner(), 'modified click ignored'); history.replaceState(null,'','#inbox');
    }
    f.alpha.querySelector('[data-label-name]').click(); assert(!spinner(), 'menu click ignored');
    const expand=document.createElement('a'); expand.href='#label/Projects'; expand.setAttribute('aria-label','Expand label: Projects'); f.alpha.querySelector('.TN').prepend(expand);
    expand.click(); assert(!spinner(), 'expansion link ignored'); history.replaceState(null,'','#inbox');
    f.click(f.inbox); assert(!spinner(), 'current mailbox ignored');
    feature.stop(); f.click(f.alpha); assert(!spinner(), 'mode OFF ignored');
  });
  await test('navigation away, disabled mode, ignored clicks and expired loads release loading state', async () => {
    const f=loadingFixture(); await start(); f.click(f.alpha); await settle();
    history.replaceState(null,'','#sent'); window.dispatchEvent(new PopStateEvent('popstate')); assert(!spinner(), 'Back/other navigation cancels immediately');
    history.replaceState(null,'','#inbox'); f.click(f.alpha); feature.stop();
    assert(!spinner() && !f.nav.querySelector('[data-gp-mailbox-loading]'), 'OFF releases all owned presentation');
    history.replaceState(null,'','#inbox'); await start(); f.alpha.setAttribute('data-native-ignore','');
    const nativeTimeout=window.setTimeout; let expire;
    window.setTimeout=(fn,ms,...args)=>ms===15000 ? (expire=fn,-999) : nativeTimeout(fn,ms,...args);
    try { f.click(f.alpha); assert(spinner() && expire, 'ignored native navigation is bounded'); expire(); assert(!spinner(), 'timeout restores dots'); }
    finally { window.setTimeout=nativeTimeout; }
  });
  await test('pending mailbox spinner stays idle through unrelated row state and owned marker changes', async () => {
    const f=loadingFixture(); await start(); f.click(f.alpha); await settle();
    let writes=0; const observer=new MutationObserver(records=>{writes+=records.length;});
    observer.observe(spinner().parentElement,{childList:true,attributes:true,subtree:true});
    f.identity().closest('tr').classList.add('zE','aps'); f.identity().setAttribute('data-gp-message-row','');
    await settle(); observer.disconnect(); assert(writes===0 && spinner(), 'no polling, repeated spinner writes, or false completion');
  });
  window.removeEventListener('resize',nativeResize);
  results.textContent += `\n${passes} passed; ${failures} failed.\n`;
  results.dataset.done='true'; results.dataset.failures=String(failures);
})();
