(async () => {
  'use strict';
  const app=GmailPro, feature=app.workspaceLayout, defaults=app.settings.defaults;
  const workspace=document.querySelector('#workspace'), results=document.querySelector('#results');
  const assert=(value,text)=>{if(!value)throw Error(text);};
  const frames=async(count=12)=>{for(let i=0;i<count;i++)await new Promise(requestAnimationFrame);};
  const width=node=>node.getBoundingClientRect().width;
  let saved={}, writes=[], failure=false, passes=0, failures=0, handled=new Set();
  app.settings={...app.settings,load:async()=>({...defaults,...saved}),save:async patch=>{
    if(failure)throw Error('storage unavailable'); writes.push(structuredClone(patch)); Object.assign(saved,patch);
  },readingLayoutHandled:async owner=>handled.has(owner),markReadingLayoutHandled:async owner=>{
    if(failure)throw Error('storage unavailable');handled.add(owner);writes.push({layoutHandled:owner});
  }};
  function fixture({split=true,closed=false,initial={},size=1400,minList=200,minReading=240,ignoreRight=false,ignoreRightClicks=0,menuDelay=0,splitDelay=0}={}) {
    feature.stop(); saved=structuredClone(initial); writes=[]; failure=false; handled=new Set();
    document.documentElement.className='gmail-pro-apple-mail-mode';
    document.documentElement.dataset.gpTheme='dark'; document.documentElement.dataset.gpAccent='blue';
    workspace.style.width=size+'px';
    workspace.innerHTML='<header role="banner"><button aria-label="Google Account: Demo (demo@example.test)">Account</button></header><div class="fixture-stage"><nav role="navigation" class="WR"><div class="Xa"><div class="V6 CL W9" role="link" tabindex="0" aria-label="Mail">Mail</div><div class="apW" role="heading">Mail</div></div><div class="Xa"><div class="V6 CL su" role="link" tabindex="0" aria-label="Chat">Chat</div></div><div class="Xa"><div class="V6 CL Xj" role="link" tabindex="0" aria-label="Meet">Meet</div></div></nav><nav class="fixture-mailboxes">Mailboxes</nav><main role="main"><div gh="tm"><div class="G-Ni"><div role="button" aria-label="Toggle split pane mode"></div><div class="apG" role="button" aria-haspopup="true" tabindex="0">Split options</div></div></div></main><div class="bAw"><aside role="complementary" aria-label="Side panel">Apps</aside><div class="brC-dA-I-Jw"><div class="brC-dA-I" role="button" tabindex="0"></div></div></div></div><div role="menu" hidden></div>';
    const f={rail:workspace.querySelector('.WR'),mailboxes:workspace.querySelector('.fixture-mailboxes'),main:workspace.querySelector('main'),
      nativeRightClicks:0,menuClicks:0,splitSelections:0,drags:0,appClicks:0,ratio:80};
    function attachRight(node) {
      node.addEventListener('click',()=>{
        f.nativeRightClicks++; if(ignoreRight||f.nativeRightClicks<=ignoreRightClicks)return;
        const close=node.getAttribute('aria-label')==='Hide side panel';
        node.setAttribute('aria-label',close?'Show side panel':'Hide side panel');
        workspace.querySelector('.bAw').toggleAttribute('data-closed',close);
        workspace.querySelector('aside').style.display=close?'none':'';
      });
      node.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();node.click();}});
    }
    f.right=workspace.querySelector('.brC-dA-I'); f.right.setAttribute('aria-label',closed?'Show side panel':'Hide side panel');
    f.right.innerHTML='<div class="aT5-aOt-I-JX-atM"></div><div class="aT5-aOt-I-JX-Jw"><svg width="20" height="20" viewBox="0 0 24 24" fill="#5F6368"><path d="M8.59 16.59 13.17 12 8.59 7.41 10 6l6 6-6 6z"/></svg></div>';
    workspace.querySelector('.bAw').toggleAttribute('data-closed',closed); workspace.querySelector('aside').style.display=closed?'none':''; attachRight(f.right);
    f.replaceRight=()=>{const n=f.right.cloneNode(true);f.right.replaceWith(n);f.right=n;attachRight(n);return n;};
    for(const node of f.rail.querySelectorAll('[role=link]'))node.addEventListener('click',()=>f.appClicks++);
    f.createSplit=()=>{
      f.main.querySelector('[gh=tl]')?.remove();
      const host=document.createElement('div'); host.className='Nr Nm';host.setAttribute('gh','tl');
      host.innerHTML='<div class="Nu tf">Synthetic conversations</div><div class="Nt"></div><div class="Nu S3">Synthetic reading pane</div>';
      f.main.append(host); f.host=host;f.list=host.querySelector('.tf');f.reading=host.querySelector('.S3');f.handle=host.querySelector('.Nt');
      f.list.style.minWidth=minList+'px';f.reading.style.minWidth=minReading+'px';
      f.list.style.flexGrow=String(f.ratio);f.reading.style.flexGrow=String(100-f.ratio);
      f.handle.addEventListener('mousedown',()=>{
        const move=event=>{
          const available=width(f.list)+width(f.reading), left=host.getBoundingClientRect().left;
          const target=Math.max(minList,Math.min(available-minReading,event.clientX-left-width(f.handle)/2));
          f.ratio=100*target/available; f.list.style.flexGrow=String(f.ratio);f.reading.style.flexGrow=String(100-f.ratio);
        };
        const up=()=>{f.drags++;document.removeEventListener('mousemove',move);document.removeEventListener('mouseup',up);};
        document.addEventListener('mousemove',move);document.addEventListener('mouseup',up);
      });
    };
    const menu=workspace.querySelector('[role=menu]');menu.tabIndex=-1;
    menu.addEventListener('keydown',event=>{if(event.key==='Escape'){menu.hidden=true;workspace.querySelector('.apG').focus();}});
    for(const text of ['No split','Vertical split','Horizontal split']) {
      const item=document.createElement('div');item.setAttribute('role','menuitem');item.textContent=text;
      item.addEventListener('click',()=>{
        menu.hidden=true;
        if(text==='Vertical split'){
          f.splitSelections++;if(splitDelay)setTimeout(f.createSplit,splitDelay);else f.createSplit();
        }else if(text==='No split')f.main.querySelector('[gh=tl]')?.remove();
      });menu.append(item);
    }
    workspace.querySelector('.apG').addEventListener('click',()=>{
      f.menuClicks++;const open=()=>{menu.hidden=false;menu.focus();};if(menuDelay)setTimeout(open,menuDelay);else open();
    });
    if(split)f.createSplit();
    f.start=async()=>{feature.start({...defaults,...saved,appleMailModeEnabled:true});await frames();};
    f.drag=async ratio=>{
      const a=f.list.getBoundingClientRect(), h=f.handle.getBoundingClientRect(), available=width(f.list)+width(f.reading);
      f.handle.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:0,buttons:1,clientX:h.left+h.width/2,clientY:h.top+20}));
      document.dispatchEvent(new MouseEvent('mousemove',{bubbles:true,buttons:1,clientX:a.left+available*ratio+h.width/2,clientY:h.top+20}));
      document.dispatchEvent(new MouseEvent('mouseup',{bubbles:true,button:0}));await frames();
    };
    return f;
  }
  if(new URLSearchParams(location.search).has('cancel')){
    const f=fixture(), button=document.createElement('button');button.textContent='Turn layout off';workspace.append(button);
    button.addEventListener('click',()=>{
      feature.stop();const pass=f.list.style.flexGrow==='80'&&f.reading.style.flexGrow==='20'&&!handled.size;
      results.textContent=pass?'PASS canceled options and a divider click without movement restore original pane weights.':'FAIL canceled gesture lost native restoration.';
      results.dataset.done='true';results.dataset.failures=pass?'0':'1';
    });
    results.textContent='Open and cancel split options, click the divider without moving, then turn layout off.';
    await f.start();return;
  }
  if(new URLSearchParams(location.search).has('manual')){
    const f=fixture(), realRead=app.settings.readingLayoutHandled;
    let release, released=false;
    app.settings.readingLayoutHandled=owner=>released?realRead(owner):new Promise(resolve=>release=resolve);
    const controls=document.createElement('div');
    controls.innerHTML='<button id="release-read">Release delayed preference read</button><button id="restart-layout">Restart layout</button>';
    workspace.append(controls);
    controls.querySelector('#release-read').addEventListener('click',()=>{released=true;release(false);results.textContent='Delayed preference read released.';});
    controls.querySelector('#restart-layout').addEventListener('click',async()=>{
      feature.stop();await f.start();
      const pass=handled.has('demo@example.test')&&!f.main.querySelector('[gh=tl]')&&f.drags===0&&f.splitSelections===0&&writes.filter(p=>p.layoutHandled).length===1;
      results.textContent=pass?'PASS trusted native split choice before initialization survives stale read and restart.':'FAIL early native preference was overwritten.';
      results.dataset.done='true';results.dataset.failures=pass?'0':'1';
    });
    results.textContent='Choose native Split options → No split, release the delayed read, then restart layout.';
    await f.start();return;
  }
  if(new URLSearchParams(location.search).has('startup')){
    const f=fixture({split:false}), realRead=app.settings.readingLayoutHandled;
    let release;
    app.settings.readingLayoutHandled=()=>new Promise(resolve=>release=resolve);
    const button=document.createElement('button');button.textContent='Continue normal startup';workspace.append(button);
    button.addEventListener('click',async()=>{
      app.settings.readingLayoutHandled=realRead;release(false);
      await new Promise(resolve=>setTimeout(resolve,800));await frames();
      const pass=f.splitSelections===1&&Math.abs(width(f.list)/(width(f.list)+width(f.reading))-.25)<.01&&!handled.size;
      results.textContent=pass?'PASS ordinary early input defers setup, then initializes 25/75 without recording a native choice.':'FAIL early input canceled the initial layout.';
      results.dataset.done='true';results.dataset.failures=pass?'0':'1';
    });
    results.textContent='Click Continue normal startup while the account preference is still loading.';
    await f.start();return;
  }
  async function test(name,run){try{await run();passes++;results.textContent+='PASS '+name+'\n';}catch(error){failures++;results.textContent+='FAIL '+name+': '+error.message+'\n';}finally{feature.stop();}}
  results.textContent='';
  await test('both rails default collapsed, native right split is enabled once and the list gets a quarter of usable space',async()=>{
    const f=fixture({split:false});
    workspace.querySelector('header button').setAttribute('aria-label','Google Account: Demo (demo@example.test), Google membership');
    await f.start();await frames();
    assert(width(f.rail)===0&&width(f.mailboxes)===216,'left collapse reclaims only the app rail');
    assert(f.right.getAttribute('aria-label')==='Show side panel'&&f.nativeRightClicks===1,'native right control collapses once');
    assert(f.menuClicks===1&&f.splitSelections===1&&f.drags===0,'native split enabled without synthetic dragging');
    assert(Math.abs(width(f.list)/(width(f.list)+width(f.reading))-.25)<.01,'quarter applies to mail panes, excluding sidebars');
    assert(!handled.size,'default preset does not claim the user chose a native layout');
    assert(!writes.some(p=>'leftRailCollapsed'in p||'rightRailCollapsed'in p),'defaults do not write rail preferences');
  });
  await test('delayed native menu and split mounts are awaited without timing guesses',async()=>{
    const f=fixture({split:false,menuDelay:150,splitDelay:150});await f.start();await frames(50);
    assert(f.splitSelections===1&&f.drags===0,'async native readiness completes once');
    assert(Math.abs(width(f.list)/(width(f.list)+width(f.reading))-.25)<.01,'delayed view reaches quarter width');
  });
  await test('hidden cached split controls do not block the visible inbox default',async()=>{
    const f=fixture({split:false}), cached=f.main.querySelector('[gh=tm]').cloneNode(true);
    cached.style.display='none';f.main.prepend(cached);await f.start();
    assert(f.menuClicks===1&&f.splitSelections===1,'only the visible native menu is opened');
    assert(Math.abs(width(f.list)/(width(f.list)+width(f.reading))-.25)<.01,'visible inbox gets the preset');
  });
  await test('typing in an active field defers setup until focus leaves it',async()=>{
    const f=fixture({split:false}), input=document.createElement('input');
    workspace.querySelector('header').append(input);input.focus();await f.start();
    assert(f.menuClicks===0,'initialization does not take focus from typing');
    input.blur();await frames();
    assert(f.splitSelections===1&&Math.abs(width(f.list)/(width(f.list)+width(f.reading))-.25)<.01,'focus leaving resumes the default');
  });
  await test('native resizing remains free and later starts preserve its saved ratio',async()=>{
    const f=fixture();await f.start();await f.drag(.4);const count=f.drags;
    // Trusted browser interaction is covered by ?manual=1. Supply its stored
    // marker here while the synthetic drag models Gmail's persisted weights.
    await app.settings.markReadingLayoutHandled('demo@example.test');
    feature.stop();await f.start();
    assert(f.drags===count&&Math.abs(width(f.list)/(width(f.list)+width(f.reading))-.4)<.01,'default never overrides a later native drag');
    f.createSplit();await frames();assert(f.drags===count,'Gmail replacement panes retain native size');
  });
  await test('left toggle has accessible state, keeps original app nodes and remembers explicit expansion',async()=>{
    const f=fixture();await f.start();const link=f.rail.querySelector('[role=link]'), button=document.querySelector('.gmail-pro-app-rail-toggle');
    assert(button.tagName==='BUTTON'&&button.getAttribute('aria-expanded')==='false'&&button.getAttribute('aria-controls')===f.rail.id,'keyboard-native button controls its rail');
    button.click();await frames();assert(width(f.rail)===68&&saved.leftRailCollapsed===false,'expansion saved');
    link.click();assert(f.appClicks===1&&link===f.rail.querySelector('[role=link]'),'native app handler and node retained');
    feature.stop();await f.start();assert(width(f.rail)===68,'saved expansion survives restart');
    link.focus();feature.update({leftRailCollapsed:true});await frames();
    assert(document.activeElement===document.querySelector('.gmail-pro-app-rail-toggle'),'collapsing moves focus outside hidden links');
  });
  await test('native right toggle remains independent and remembers user expansion',async()=>{
    const f=fixture();await f.start();f.right.click();await frames();
    assert(saved.rightRailCollapsed===false&&f.right.getAttribute('aria-label')==='Hide side panel','native expansion saved');
    assert(width(f.rail)===0,'right expansion leaves left collapsed');
    const clicks=f.nativeRightClicks;feature.stop();await f.start();assert(f.nativeRightClicks===clicks,'explicit right choice retained');
  });
  await test('right collapse retries a not-yet-ready handler and stops after success',async()=>{
    const f=fixture({ignoreRightClicks:1});await f.start();
    await new Promise(resolve=>setTimeout(resolve,600));await frames();
    assert(f.nativeRightClicks===2&&f.right.getAttribute('aria-label')==='Show side panel','startup collapse recovers');
    assert(!writes.some(p=>'rightRailCollapsed'in p),'default recovery does not save a user preference');
    await new Promise(resolve=>setTimeout(resolve,550));await frames();assert(f.nativeRightClicks===2,'no retries after success');
  });
  await test('native right edge control stays visible and clickable in both themes',async()=>{
    const f=fixture();await f.start();
    for(const theme of ['light','dark']){
      document.documentElement.dataset.gpTheme=theme;
      const box=f.right.getBoundingClientRect(), style=getComputedStyle(f.right);
      assert(box.width===32&&box.height===56&&box.right===innerWidth&&box.bottom===innerHeight,'full edge target fits the viewport');
      assert(f.right.contains(document.elementFromPoint(box.left+16,box.top+28)),'native button receives pointer hits');
      assert(getComputedStyle(f.right.querySelector('svg')).fill===style.color,'native arrow follows theme contrast');
    }
    feature.stop();document.documentElement.classList.remove('gmail-pro-apple-mail-mode');
    assert(getComputedStyle(f.right).position!=='fixed','mode OFF restores native position');
  });
  await test('failed rail saves restore the prior view with actionable feedback',async()=>{
    const f=fixture();await f.start();failure=true;
    document.querySelector('.gmail-pro-app-rail-toggle').click();await frames();
    assert(width(f.rail)===0&&document.querySelector('[role=status]').textContent.includes('Couldn’t save'),'left rollback');
    f.right.click();await frames();
    assert(f.right.getAttribute('aria-label')==='Show side panel','right rollback');
  });
  await test('replacement rails rebind once and OFF restores native left geometry and markup',async()=>{
    const f=fixture();await f.start();const clone=f.rail.cloneNode(true);f.rail.replaceWith(clone);f.replaceRight();await frames();
    assert(width(clone)===0&&document.querySelectorAll('.gmail-pro-app-rail-toggle').length===1,'one collapsed replacement owner');
    feature.stop();assert(width(clone)===68&&!clone.hasAttribute('data-gp-app-rail')&&!clone.id,'OFF releases inherited owned markers and ID');
    assert(!document.querySelector('.gmail-pro-app-rail-toggle'),'OFF removes the edge button');
    assert(f.list.style.flexGrow==='80'&&f.reading.style.flexGrow==='20','OFF restores native weights when no user resized');
  });
  await test('pane replacement inside the same native host receives the preset and releases old styles',async()=>{
    const f=fixture();await f.start();const host=f.host, replacement=f.list.cloneNode(true);
    replacement.style.flexGrow='80';f.list.replaceWith(replacement);f.list=replacement;await frames();
    assert(f.host===host&&Math.abs(width(f.list)/(width(f.list)+width(f.reading))-.25)<.01,'same-host replacement keeps the default proportion');
    feature.stop();assert(f.list.style.flexGrow==='80'&&f.reading.style.flexGrow==='20','replacement owns a separate reversible preset');
  });
  await test('a narrow view clamps to native minima and never leaves fixed pane sizing',async()=>{
    const f=fixture({size:1000,minList:300,minReading:240});await f.start();
    assert(Math.abs(width(f.list)-300)<2&&width(f.reading)>=240,'native minimum wins over quarter');
    assert(!f.list.style.width&&!f.reading.style.width&&!f.list.style.flexBasis,'no permanent sizing override');
  });
  await test('unknown account and duplicate controls fail closed; ignored native toggles have bounded retries',async()=>{
    let f=fixture({ignoreRight:true});await f.start();feature.stop();
    await new Promise(resolve=>setTimeout(resolve,550));assert(f.nativeRightClicks===1,'OFF cancels a pending retry');
    f=fixture({ignoreRight:true});await f.start();await new Promise(resolve=>setTimeout(resolve,1600));await frames();
    assert(f.nativeRightClicks===3,'ignored native toggle stops after three attempts');
    feature.stop();await new Promise(resolve=>setTimeout(resolve,550));assert(f.nativeRightClicks===3,'OFF cancels pending retry work');
    f=fixture();workspace.querySelector('header button').removeAttribute('aria-label');await f.start();
    assert(f.drags===0&&!handled.size,'unverified account gets no saved layout');
    f=fixture({split:false});workspace.querySelector('.fixture-stage').prepend(f.rail.cloneNode(true));
    f.right.parentElement.append(f.right.cloneNode(true));await f.start();
    assert(!document.querySelector('.gmail-pro-app-rail-toggle')&&!workspace.querySelector('[data-gp-app-rail]'),'ambiguous rails stay native');
  });
  await test('classic WR mailbox navigation is never collapsed as an app rail',async()=>{
    const f=fixture();f.rail.remove();
    f.mailboxes.className='fixture-mailboxes aeN WR';f.mailboxes.setAttribute('role','navigation');
    f.mailboxes.innerHTML='<div class="aic"><div class="z0"><div gh="cm" role="button">Compose</div></div></div><div class="nM">Synthetic mailbox labels</div>';
    await f.start();
    assert(width(f.mailboxes)>0&&!f.mailboxes.hasAttribute('data-gp-app-rail')&&!document.querySelector('.gmail-pro-app-rail-toggle'),'only verified Mail/Chat/Meet controls can be hidden');
  });
  await test('initialized workspace stays idle without writes, resizes or ongoing message observation',async()=>{
    const f=fixture();await f.start();let mutations=0,resizes=0;
    const observer=new MutationObserver(records=>mutations+=records.length);observer.observe(workspace,{attributes:true,childList:true,subtree:true});
    const resized=()=>resizes++;window.addEventListener('resize',resized);const count=writes.length;
    await frames(40);observer.disconnect();window.removeEventListener('resize',resized);
    assert(mutations===0&&resizes===0&&writes.length===count,'no idle mutation, synthetic resize or save');
  });
  results.textContent+=`\n${passes} passed; ${failures} failed.\n`;results.dataset.done='true';results.dataset.failures=String(failures);
})();
