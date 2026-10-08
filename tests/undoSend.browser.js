(async () => {
  'use strict';
  const app = GmailPro, workspace = document.getElementById('workspace'), output = document.getElementById('results');
  const reports = [], wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const assert = (value, message) => { if (!value) throw Error(message); };
  const css = node => getComputedStyle(node), rect = node => node.getBoundingClientRect();
  const visible = node => node.checkVisibility({visibilityProperty:true, opacityProperty:true}) &&
    rect(node).bottom > 0 && rect(node).top < innerHeight;
  const fill = f => getComputedStyle(f.card.querySelector('.bAq'), '::after');
  const progress = f => f.card.querySelector('.bAq').getAnimations({subtree:true}).find(animation=>animation.animationName==='gmail-pro-undo-send-progress');
  const options = { ...app.settings.defaults, appleMailModeEnabled:true, appearanceTheme:'dark', headerCollapsed:true };
  function stop() { app.keyboardShortcuts.stop(); app.headerLayout.stop(); app.appearance.stop(); workspace.replaceChildren(); }
  function fixture({ message = 'Message sent', undo = true, undoRole = 'alert', view = true, viewId = 'link_vsm', collapsed = true } = {}) {
    workspace.innerHTML = '<div class="w-asV aiw"><header role="banner"><button aria-label="Main menu">Menu</button><div class="search-owner"><form role="search"><div gh="sb"><input name="q" aria-label="Search mail"></div><button type="button" aria-label="Advanced search options">Filters</button></form></div><button aria-label="Settings">Settings</button></header><div class="notice-owner"></div></div><div class="stage"><nav role="navigation">Mailboxes</nav><main role="main" tabindex="-1"><div gh="tm"><div gh="mtb"><button aria-label="Archive">Archive</button><button>Reply</button></div><div class="Di"><button aria-label="Show more messages">1–8 of 8</button></div></div><div class="panes"><div class="Nu tf"><div class="fixture-list">Inbox<br><br>Project update<br><br>Weekly notes<br><br>Meeting follow-up</div></div><div class="Nu S3"><div class="fixture-message ii">Your messages stay in Gmail.<br><br>Undo Send uses Gmail’s own cancellation window.</div></div></div></main></div>';
    const root = document.createElement('div');
    root.className = 'b8 UC bAp'; root.setAttribute('role', 'alert');
    root.setAttribute('aria-live', 'assertive'); root.setAttribute('aria-atomic', 'true');
    root.innerHTML = '<div class="J-J5-Ji"><div class="UD"></div><div class="vh"><span class="aT"><span class="bAq"></span><span class="bAo"></span></span><div class="bBe" role="button" tabindex="0" aria-label="Close"><div class="bBf"></div></div></div><div class="UB"></div></div>';
    root.querySelector('.bAq').textContent = message;
    const actions = root.querySelector('.bAo');
    // Live Gmail sent markup captured 2026-10-07: Undo has role=alert,
    // aria-live=assertive, no aria-label, and is hidden inline on expiration.
    if (undo) {
      const action = document.createElement('span');
      action.className = 'ag a8k'; action.id = 'link_undo'; action.tabIndex = 0;
      action.setAttribute('role', undoRole); action.setAttribute('idlink', '');
      if (undoRole === 'alert') action.setAttribute('aria-live', 'assertive');
      action.textContent = 'Undo'; actions.append(document.createTextNode('\u00a0'), action);
    }
    if (view) {
      const action = document.createElement('span');
      action.className = 'ag a8k'; action.setAttribute('role', 'link'); action.tabIndex = 0;
      action.textContent = 'View message'; if (viewId) action.id = viewId;
      actions.append(document.createTextNode('\u00a0'), action);
    }
    workspace.querySelector('.notice-owner').append(root);
    const card = root.querySelector('.vh'), link = root.querySelector('#link_undo'), viewLink = actions.querySelector('[role="link"]:not(#link_undo)'), close = root.querySelector('.bBe');
    let undos = 0, views = 0, closes = 0;
    const expire = () => { root.style.cssText = 'position: relative; top: -10000px;'; };
    link?.addEventListener('click', () => { undos++; root.classList.remove('bAp'); card.replaceChildren(); expire(); });
    viewLink?.addEventListener('click', () => { views++; });
    close.addEventListener('click', () => { closes++; expire(); });
    for (const control of [link, viewLink, close].filter(Boolean)) control.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); control.click(); }
    });
    const native = { position:css(card).position, radius:css(card).borderRadius, background:css(card).backgroundColor };
    app.appearance.start(options); app.headerLayout.start({...options, headerCollapsed:collapsed});
    app.keyboardShortcuts.start({...options, archiveShortcutEnabled:false, deleteShortcutEnabled:false, readShortcutEnabled:false, expandShortcutEnabled:false, sendShortcutEnabled:false, replyAllShortcutEnabled:false, forwardShortcutEnabled:false});
    return {root, card, link, viewLink, close, native, expire, undos:()=>undos, views:()=>views, closes:()=>closes};
  }
  const key = (node, value) => {
    for (const type of ['keydown', 'keypress', 'keyup']) node.dispatchEvent(new KeyboardEvent(type, {key:value, code:'Key'+value.toUpperCase(), bubbles:true, cancelable:true}));
  };
  const luminance = value => {
    const ctx = document.createElement('canvas').getContext('2d');
    ctx.fillStyle = value; ctx.fillRect(0, 0, 1, 1);
    return [...ctx.getImageData(0,0,1,1).data].slice(0,3).map(n=>n/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4).reduce((s,n,i)=>s+n*[.2126,.7152,.0722][i],0);
  };
  const contrast = (a,b) => { const x=luminance(a), y=luminance(b); return (Math.max(x,y)+.05)/(Math.min(x,y)+.05); };
  const params=new URLSearchParams(location.search), preview=params.get('preview');
  if(preview){
    const f=fixture(params.has('long') ? {message:'A long native notification with additional context about this message and its delivery.'} : {});
    app.appearance.update({appearanceTheme:preview==='light'?'light':'dark'});
    if(params.has('elapsed')) {
      const animation=progress(f); animation.pause();
      animation.currentTime=Math.min(5000,Math.max(0,Number(params.get('elapsed'))*1000||0));
    }
    output.textContent='Synthetic preview · Gmail owns Undo Send'; return;
  }
  async function test(name, run) {
    try { await run(); reports.push('PASS '+name); } catch (error) { reports.push('FAIL '+name+': '+error.message); }
    stop(); output.textContent = reports.join('\n');
  }
  await test('collapsed header keeps native Undo Send visible at bottom left', async () => {
    const f=fixture(); await wait(100);
    assert(workspace.querySelector('.w-asV').hasAttribute('data-gp-header-collapsed'), 'real header controller collapsed');
    assert(css(workspace.querySelector('header')).visibility==='hidden', 'header is hidden');
    assert(visible(f.card)&&visible(f.link)&&css(f.card).position==='fixed', 'native controls are visible');
    assert(Math.abs(rect(f.card).left-20)<1&&Math.abs(innerHeight-rect(f.card).bottom-20)<1, '20px bottom-left placement');
    assert(document.elementFromPoint(rect(f.link).x+rect(f.link).width/2,rect(f.link).y+rect(f.link).height/2)===f.link,'Undo is clickable above chrome');
    assert(f.root.getAttribute('aria-live')==='assertive'&&f.root.getAttribute('aria-atomic')==='true','native announcements retained');
    assert(f.link.getAttribute('role')==='alert'&&f.link.getAttribute('aria-live')==='assertive','live Gmail Undo semantics retained');
    f.link.click(); assert(f.undos()===1&&!visible(f.card),'native Undo cancels once and expires');
  });
  await test('expanded header uses the same notice and restores native presentation when mode is off', async () => {
    const f=fixture({collapsed:false}); await wait(100); const markup=f.root.outerHTML;
    assert(visible(f.card)&&css(f.card).position==='fixed','expanded header notice visible');
    app.headerLayout.stop(); app.appearance.stop();
    assert(css(f.card).position===f.native.position&&css(f.card).borderRadius===f.native.radius&&css(f.card).backgroundColor===f.native.background,'native presentation restored');
    assert(f.root.outerHTML===markup,'no native text, nodes or attributes changed');
    f.link.click(); assert(f.undos()===1,'native handler still works');
  });
  for (const appearanceTheme of ['light','dark']) for (const accentColor of ['blue','purple','pink','red','orange','yellow','green','graphite']) {
    await test(appearanceTheme+' / '+accentColor+' follows tokens with readable message and actions', async () => {
      const f=fixture(); await wait(50); app.appearance.update({appearanceTheme,accentColor});
      const root=css(document.documentElement), bg=root.getPropertyValue('--gp-bg-tertiary').trim();
      assert(luminance(css(f.card).backgroundColor)===luminance(bg),'theme surface');
      assert(contrast(css(f.card).color,css(f.card).backgroundColor)>=4.5,'message contrast');
      assert(contrast(css(f.link).color,css(f.link).backgroundColor)>=4.5,'Undo contrast');
      assert(contrast(css(f.viewLink).color,css(f.card).backgroundColor)>=4.5,'View message contrast');
      assert(rect(f.link).height>=36&&css(f.card).borderRadius==='12px','comfortable button and rounded card');
      assert(luminance(fill(f).backgroundColor)===luminance(root.getPropertyValue('--gp-accent-ui').trim()),'timer follows accent');
    });
  }
  await test('top timer fills left to right over the verified five-second cancellation window', async () => {
    const f=fixture(); await wait(50);
    const animation=progress(f), bounds=rect(f.card), style=fill(f);
    assert(animation&&animation.effect.getTiming().duration===5000,'five-second duration');
    assert(style.height==='3px'&&style.top==='0px'&&style.left==='0px'&&style.right==='0px','thin line reaches both inner border edges');
    assert(Math.abs(parseFloat(style.width)-f.card.clientWidth)<.5,'line spans the full toast width inside its border');
    assert(style.pointerEvents==='none'&&style.transformOrigin.startsWith('0px'),'nonblocking line grows from left');
    animation.pause();
    for(const [time,scale] of [[0,0],[2500,.5],[5000,1]]) {
      animation.currentTime=time;
      assert(Math.abs(new DOMMatrix(fill(f).transform).a-scale)<.01,'elapsed time maps to fill width at '+time);
    }
    assert(rect(f.card).width===bounds.width&&rect(f.card).height===bounds.height,'progress does not change layout');
    assert(animation.effect.getTiming().iterations===1&&animation.effect.getTiming().fill==='both','fills once and stays full');
    f.link.click(); assert(f.undos()===1&&!visible(f.card),'native Undo still works');
  });
  await test('timer does not depend on the View message action ID', async () => {
    for (const viewId of ['', 'native-view-action', 'link_vsm']) {
      stop(); const f=fixture({viewId}); await wait(50);
      assert(progress(f)&&fill(f).content!=='none','timer appears for View message ID '+(viewId||'(absent)'));
      assert(Math.abs(parseFloat(fill(f).width)-f.card.clientWidth)<.5,'full width for each native action variant');
      f.viewLink.click(); assert(f.views()===1,'existing View message action remains usable');
    }
  });
  await test('timer anchors to the card despite Gmail positioning the message wrapper', async () => {
    const f=fixture(); await wait(50);
    const wrapper=f.card.querySelector('.aT'), message=f.card.querySelector('.bAq');
    assert(css(wrapper).position==='static'&&message.offsetParent===f.card,'toast is the timer containing block');
    assert(css(f.card).overflowX==='hidden'&&css(f.card).overflowY==='hidden','timer clips to the rounded card');
    assert(Math.abs(parseFloat(fill(f).width)-f.card.clientWidth)<.5,'track spans the full card, independent of content padding');
    f.link.focus(); assert(css(f.link).outlineWidth==='2px','native focus ring remains visible');
    app.headerLayout.stop(); app.appearance.stop();
    assert(css(wrapper).position==='relative','native wrapper positioning restores when mode is off');
  });
  await test('Gmail alert-role Undo gets the timer, premium button and mailbox shortcut', async () => {
    const f=fixture(); await wait(50);
    assert(f.link.getAttribute('role')==='alert','actual sent Undo role');
    assert(fill(f).animationName==='gmail-pro-undo-send-progress','timer matches live Gmail markup');
    assert(css(f.link).borderStyle==='solid'&&css(f.link).borderRadius==='7px','premium Undo button matches native alert role');
    workspace.querySelector('main').focus(); key(document.activeElement,'z');
    assert(f.undos()===1,'mailbox Z reaches actual native control');
  });
  await test('Gmail hides Undo at expiration without removing its node; timer follows that state', async () => {
    for (const state of ['visibility:hidden','visibility: hidden;','display:none','display: none;','hidden','aria-hidden','inert','aria-disabled']) {
      stop(); const f=fixture(); await wait(50);
      if(state==='hidden') f.link.hidden=true;
      else if(state==='aria-hidden') f.link.setAttribute('aria-hidden','true');
      else if(state==='inert') f.link.inert=true;
      else if(state==='aria-disabled') f.link.setAttribute('aria-disabled','true');
      else f.link.style.cssText=state;
      assert(visible(f.card),'sent toast remains visible');
      assert(fill(f).content==='none'&&fill(f).animationName==='none','timer disappears with native inactive Undo: '+state);
      workspace.querySelector('main').focus(); key(document.activeElement,'z');
      assert(f.undos()===0,'inactive Undo is not activated');
      f.viewLink.click(); assert(f.views()===1,'View message remains available');
    }
  });
  await test('timer disappears with native Undo and starts fresh when Gmail replaces the notice message', async () => {
    const f=fixture(); await wait(50); const animation=progress(f);
    animation.pause(); animation.currentTime=4000;
    const message=f.card.querySelector('.bAq'); message.replaceWith(message.cloneNode(true));
    const next=progress(f);
    assert(next&&next!==animation&&next.currentTime<250,'new native message starts at beginning');
    f.link.remove(); assert(fill(f).content==='none'&&fill(f).animationName==='none','no countdown once Undo is gone');
    f.viewLink.click(); assert(f.views()===1,'View message remains functional');
  });
  await test('reduced motion retains time indication with discrete progress steps', async () => {
    const f=fixture(); await wait(50);
    const expected=matchMedia('(prefers-reduced-motion: reduce)').matches?'steps(5)':'linear';
    assert(fill(f).animationTimingFunction===expected,'motion preference honored');
    const rules=[];
    const collect=list=>{for(const rule of list){if(rule.conditionText==='(prefers-reduced-motion: reduce)')rules.push(rule);if(rule.cssRules)collect(rule.cssRules);}};
    for(const sheet of document.styleSheets)collect(sheet.cssRules);
    assert(rules.some(rule=>[...rule.cssRules].some(inner=>inner.style?.animationTimingFunction==='steps(5)')),'browser parses reduced-motion steps');
  });
  await test('native expiration sentinel does not leave a stale clickable notice', async () => {
    const f=fixture(); await wait(50); f.expire();
    assert(!visible(f.card)&&!visible(f.link),'offscreen native state honored even with bAp retained');
    workspace.querySelector('main').focus(); key(document.activeElement,'z');
    assert(!f.undos(),'expired link is not activated');
  });
  for (const state of ['hidden','aria-hidden','inert','display','visibility']) await test('native '+state+' state still hides the notice', async () => {
    const f=fixture(); await wait(50);
    if(state==='hidden') f.root.hidden=true;
    else if(state==='aria-hidden') f.root.setAttribute('aria-hidden','true');
    else if(state==='inert') f.root.inert=true;
    else f.root.style[state]=state==='display'?'none':'hidden';
    assert(!visible(f.card),'hidden state retained');
    workspace.querySelector('main').focus(); key(document.activeElement,'z'); assert(!f.undos(),'hidden action not triggered');
  });
  await test('View message and Close use existing native handlers', async () => {
    const f=fixture(); await wait(50); f.viewLink.click(); f.close.click();
    assert(f.views()===1&&f.closes()===1&&!f.undos()&&!visible(f.card),'native view and dismissal');
  });
  await test('Enter reaches native Undo and mailbox Z still works with the header collapsed', async () => {
    let f=fixture(); await wait(50); f.link.focus();
    assert(css(f.link).outlineStyle==='solid'&&css(f.link).outlineWidth==='2px','visible keyboard focus');
    key(f.link,'Enter'); assert(f.undos()===1,'native focused activation');
    stop(); f=fixture(); await wait(50); workspace.querySelector('main').focus(); key(document.activeElement,'z');
    assert(f.undos()===1,'existing mailbox Undo bridge');
  });
  await test('native archive, failures and notices without Undo remain accessible', async () => {
    for(const message of ['Conversation archived.','Sending…','Something went wrong. Retry.','Action undone.']) {
      stop(); const f=fixture({message,undo:message==='Conversation archived.',undoRole:'link',view:false}); await wait(50);
      assert(visible(f.card)&&f.card.textContent.includes(message),'native notice text visible');
      assert(fill(f).animationName==='none','only Undo Send gets the countdown');
      if(f.link){f.link.click();assert(f.undos()===1,'Archive Undo retained');}
      else assert(!f.root.querySelector('#link_undo'),'no invented cancellation action');
    }
  });
  await test('native node replacement and repeated notifications use current handlers', async () => {
    const previous=fixture(); await wait(50); previous.root.remove();
    const next=previous.root.cloneNode(true); workspace.querySelector('.notice-owner').append(next);
    let current=0; next.querySelector('#link_undo').addEventListener('click',()=>current++);
    workspace.querySelector('main').focus(); key(document.activeElement,'z');
    assert(current===1&&!previous.undos()&&visible(next.querySelector('.vh')),'replacement owns action and presentation');
  });
  await test('InboxSDK, authored messages and unknown markup keep native styling', async () => {
    const f=fixture(); await wait(50);
    const sdk=f.card.cloneNode(true); sdk.classList.add('inboxsdk__butterbar'); sdk.dataset.inboxsdkId='gmail'; f.card.after(sdk);
    assert(css(sdk).position===f.native.position&&css(sdk).borderRadius===f.native.radius,'third-party card untouched');
    assert(getComputedStyle(sdk.querySelector('.bAq'),'::after').animationName==='none','third-party card has no timer');
    const body=document.createElement('div'); body.className='ii'; body.innerHTML='<div class="w-asV">'+f.root.outerHTML+'</div>';
    workspace.querySelector('main').append(body);
    assert(css(body.querySelector('.vh')).position===f.native.position&&css(body.querySelector('.vh')).borderRadius===f.native.radius,'authored lookalike excluded');
    assert(getComputedStyle(body.querySelector('.bAq'),'::after').animationName==='none','authored content has no timer');
    f.card.querySelector('.aT').classList.remove('aT'); assert(css(f.card).borderRadius===f.native.radius,'unknown structure falls back');
  });
  await test('long notice wraps within the viewport without hiding actions', async () => {
    const f=fixture({message:'A long native notification with additional context about this message and its delivery.'}); await wait(50);
    assert(rect(f.card).right<=innerWidth-19&&f.card.scrollWidth<=f.card.clientWidth,'fits viewport without horizontal overflow');
    for(const node of [f.link,f.viewLink,f.close])assert(rect(node).left>=rect(f.card).left&&rect(node).right<=rect(f.card).right&&visible(node),'actions remain inside card');
  });
  const failures=reports.filter(line=>line.startsWith('FAIL')).length;
  output.textContent=reports.join('\n')+'\n\n'+(reports.length-failures)+'/'+reports.length+' checks passed.';
  output.dataset.failures=String(failures);
})();
