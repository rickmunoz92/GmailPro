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
    feature.stop(); document.documentElement.className = 'gmail-pro-apple-mail-mode';
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
  window.addEventListener('resize', nativeResize);
  const start = async (collapsed = false) => { feature.start({appleMailModeEnabled:true, headerCollapsed:collapsed}); await settle(); };
  const control = name => document.querySelector(`[data-gp-header-action="${name}"]`);
  async function test(name, run) {
    try { await run(); passes++; results.textContent += `PASS ${name}\n`; }
    catch (error) { failures++; results.textContent += `FAIL ${name}: ${error.message}\n`; }
    finally { feature.stop(); workspace.querySelectorAll('.ZF-Av').forEach(node=>node.remove()); }
  }
  if (new URLSearchParams(location.search).has('preview')) {
    fixture(Number(new URLSearchParams(location.search).get('width')) || 1400); await start(); results.hidden=true; return;
  }
  results.textContent = '';
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
  window.removeEventListener('resize',nativeResize);
  results.textContent += `\n${passes} passed; ${failures} failed.\n`;
  results.dataset.done='true'; results.dataset.failures=String(failures);
})();
