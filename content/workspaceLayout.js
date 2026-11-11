(() => {
  'use strict';
  const app = (globalThis.GmailPro ??= {});
  if (app.workspaceLayout) return;
  const S = app.selectors;
  const excluded = '.ii, .a3s, [contenteditable], [role="region"], [role="dialog"]';
  const splitSelector = '[role="main"] > .Nr.Nm[gh="tl"]:has(> .Nu.tf):has(> .Nt):has(> .Nu.S3)';
  let options = { ...app.settings.defaults }, running = false, generation = 0, frame = 0;
  let observer, bootstrap, deadline, left, right, status, setup, setupAllowed = true;
  let leftSaving = false, rightSaving = false, programmaticRight = false, lifecycle;
  let rightAttempts = new WeakMap(), rightRetry, inputPause;
  let readingOwner, readingHandled, readingLookup, readingMarked=false, readingMarker;
  let presetActive=false, presetHost, presetList, presetReading, drag;
  const presetStyles=new Map();
  let spine = new Set();
  const one = nodes => nodes.length === 1 ? nodes[0] : null;
  const safe = node => node && !node.closest(excluded);
  const shown = node => node?.isConnected && node.checkVisibility({visibilityProperty:true}) &&
    node.getBoundingClientRect().width > 0 && node.getBoundingClientRect().height > 0;
  const visible = node => safe(node) && shown(node);
  const account = () => app.labelOrder.account();
  const rightState = node => node?.getAttribute('aria-label') === 'Show side panel';
  const readingStage = value => {
    if(document.documentElement?.getAttribute('data-gp-reading-layout')!==value)
      document.documentElement?.setAttribute('data-gp-reading-layout',value);
  };

  function schedule() {
    if (!running || frame) return;
    frame = requestAnimationFrame(() => { frame = 0; if (running) refresh(); });
  }
  function feedback(text = '') {
    if (!status && text) {
      status = document.createElement('div'); status.className = 'gmail-pro-layout-status';
      status.setAttribute('role','status'); document.body.append(status);
    }
    if (status && status.textContent !== text) status.textContent = text;
    if (status && !text) { status.remove(); status = undefined; }
  }
  function releaseLeft() {
    if (!left) return;
    const state = left; left = undefined;
    const collapsed = state.node.hasAttribute('data-gp-app-rail-collapsed');
    state.node.removeAttribute('data-gp-app-rail'); state.node.removeAttribute('data-gp-app-rail-collapsed');
    if (state.ownedID && state.node.id === 'gmail-pro-app-rail') state.node.removeAttribute('id');
    state.button.remove();
    if (collapsed && state.node.isConnected) window.dispatchEvent(new Event('resize'));
  }
  function placeLeft(node) {
    if (left?.node !== node) releaseLeft();
    if (!node) return;
    if (!left) {
      const button = document.createElement('button'); button.type = 'button';
      button.className = 'gmail-pro-app-rail-toggle';
      const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
      svg.setAttribute('viewBox','0 0 24 24'); svg.setAttribute('aria-hidden','true');
      const path = document.createElementNS(svg.namespaceURI,'path'); path.setAttribute('d','M9 5l7 7-7 7');
      svg.append(path); button.append(svg);
      const ownedID = !node.id || (node.id === 'gmail-pro-app-rail' && node.hasAttribute('data-gp-app-rail'));
      if (ownedID) node.id = 'gmail-pro-app-rail';
      button.setAttribute('aria-controls',node.id); document.body.append(button);
      node.setAttribute('data-gp-app-rail',''); left = {node,button,ownedID};
      button.addEventListener('click', async () => {
        if (!running || leftSaving) return;
        const token = generation, previous = options.leftRailCollapsed;
        options.leftRailCollapsed = !previous; leftSaving = true; feedback(); renderLeft();
        try { await app.settings.save({leftRailCollapsed:options.leftRailCollapsed}); }
        catch {
          if (running && generation === token) {
            options.leftRailCollapsed = previous;
            feedback('Couldn’t save the left sidebar preference. Your previous setting is restored.');
          }
        } finally {
          if (running && generation === token) { leftSaving = false; renderLeft(); }
        }
      });
    }
    renderLeft();
  }
  function renderLeft() {
    if (!left) return;
    const collapsed = options.leftRailCollapsed !== false;
    const changed = left.node.hasAttribute('data-gp-app-rail-collapsed') !== collapsed;
    if (collapsed && left.node.contains(document.activeElement)) left.button.focus({preventScroll:true});
    if (changed) left.node.toggleAttribute('data-gp-app-rail-collapsed',collapsed);
    const label = (collapsed ? 'Show' : 'Hide') + ' Mail, Chat and Meet';
    if (left.button.getAttribute('aria-label') !== label) {
      left.button.setAttribute('aria-label',label); left.button.title = label;
      left.button.setAttribute('aria-expanded',String(!collapsed));
      left.button.dataset.collapsed = String(collapsed);
    }
    left.button.disabled = leftSaving;
    if (changed) window.dispatchEvent(new Event('resize'));
  }
  function applyRight() {
    if (!right || rightSaving || document.visibilityState !== 'visible') return;
    if (rightState(right) === options.rightRailCollapsed) {
      clearTimeout(rightRetry); rightRetry=undefined; return;
    }
    const previous=rightAttempts.get(right);
    const count=previous?.desired===options.rightRailCollapsed ? previous.count : 0;
    if (rightRetry || count >= 3) return;
    rightAttempts.set(right,{desired:options.rightRailCollapsed,count:count+1});
    // Gmail can expose the arrow before attaching its native handler. Verify
    // the resulting state, with at most three spaced attempts per preference.
    rightRetry=setTimeout(()=>{rightRetry=undefined;schedule();},500);
    programmaticRight = true;
    try { right.click(); } finally { programmaticRight = false; }
  }
  function nextFrame(signal) {
    return new Promise(resolve => {
      if (signal?.aborted) return resolve(false);
      const abort = () => { cancelAnimationFrame(id); resolve(false); };
      const id = requestAnimationFrame(() => { signal?.removeEventListener('abort',abort); resolve(!signal?.aborted); });
      signal?.addEventListener('abort',abort,{once:true});
    });
  }
  async function settle(signal, count = 2) {
    for (let i=0; i<count; i++) if (!await nextFrame(signal)) return false;
    return true;
  }
  function waitForChrome(find,signal,timeout=3000) {
    return new Promise(resolve=>{
      let pending=0, finished=false;
      const done=value=>{
        if(finished)return;finished=true;watcher.disconnect();clearTimeout(timer);cancelAnimationFrame(pending);
        signal.removeEventListener('abort',aborted);resolve(value);
      };
      const check=()=>{pending=0;const value=find();if(value)done(value);};
      const scheduleCheck=()=>{if(!pending)pending=requestAnimationFrame(check);};
      const aborted=()=>done(null), watcher=new MutationObserver(records=>{
        if(records.some(record=>!(record.target instanceof Element)||!record.target.closest(excluded)))scheduleCheck();
      });
      const timer=setTimeout(()=>done(null),timeout);
      signal.addEventListener('abort',aborted,{once:true});
      // Bounded native popup/split readiness. No polling or message inspection.
      watcher.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style','hidden','aria-hidden']});
      if(signal.aborted)aborted();else check();
    });
  }
  async function nativeRightClicked(event) {
    const target = event.target instanceof Element && event.target.closest(S.sidePanelToggle);
    if (!running || !right || target !== right || programmaticRight || event.button !== 0) return;
    if (rightSaving) { event.preventDefault(); event.stopImmediatePropagation(); return; }
    const token = generation, node = right, previous = options.rightRailCollapsed;
    clearTimeout(rightRetry); rightRetry=undefined; rightAttempts.delete(node);
    const desired = !rightState(node); options.rightRailCollapsed = desired; rightSaving = true;
    feedback();
    try {
      if (!await settle(lifecycle.signal)) return;
      if (!running || token !== generation || node !== right) return;
      if (rightState(node) !== desired) { options.rightRailCollapsed = previous; return; }
      await app.settings.save({rightRailCollapsed:desired});
    } catch {
      if (running && token === generation) {
        options.rightRailCollapsed = previous; rightAttempts.delete(node);
        feedback('Couldn’t save the right sidebar preference. Your previous setting is restored.');
      }
    } finally {
      if (running && token === generation) { rightSaving = false; schedule(); }
    }
  }
  function split() {
    const host = one([...document.querySelectorAll(splitSelector)].filter(visible));
    if (!host) return null;
    const list = host.querySelector(':scope > .Nu.tf'), reading = host.querySelector(':scope > .Nu.S3');
    const handle = host.querySelector(':scope > .Nt');
    const a = list.getBoundingClientRect(), b = reading.getBoundingClientRect();
    return visible(handle) && a.width > 0 && b.width > 0 && b.left >= a.right && Math.abs(a.top-b.top) < 4
      ? {host,list,reading,handle} : null;
  }
  function canInitialize(owner, token, signal) {
    return running && generation === token && !signal.aborted && setupAllowed && account() === owner &&
      document.visibilityState === 'visible';
  }
  function readingBusy() {
    return document.activeElement?.matches('input, textarea, select, [contenteditable]:not([contenteditable="false"])') ||
      [...document.querySelectorAll('[role="menu"], [role="dialog"], form:has(input[name="composeid"])')].some(shown);
  }
  function readingTarget(current) {
    const available=current.list.getBoundingClientRect().width+current.reading.getBoundingClientRect().width;
    const minList=parseFloat(getComputedStyle(current.list).minWidth)||0;
    const minReading=parseFloat(getComputedStyle(current.reading).minWidth)||0;
    return available<minList+minReading ? null : Math.max(minList,Math.min(available*.25,available-minReading));
  }
  function releasePreset(restore=true) {
    for(const [node,state] of presetStyles) {
      if(restore&&node.style.getPropertyValue('flex-grow')===state.after)
        state.before ? node.style.setProperty('flex-grow',state.before,state.priority) : node.style.removeProperty('flex-grow');
    }
    presetStyles.clear();presetHost=undefined;presetList=undefined;presetReading=undefined;
  }
  function applyPreset(current) {
    if(presetHost!==current.host||presetList!==current.list||presetReading!==current.reading)releasePreset();
    presetHost=current.host;presetList=current.list;presetReading=current.reading;
    for(const [node,grow] of [[current.list,'25'],[current.reading,'75']]) {
      if(!presetStyles.has(node))presetStyles.set(node,{before:node.style.getPropertyValue('flex-grow'),priority:node.style.getPropertyPriority('flex-grow'),after:grow});
      if(node.style.getPropertyValue('flex-grow')!==grow)node.style.setProperty('flex-grow',grow);
    }
  }
  async function initializeReading(owner, token, controller) {
    const signal = controller.signal;
    readingStage('initializing');
    try {
      if (!await settle(signal) || !canInitialize(owner,token,signal)) return;
      let current = split();
      if (!current) {
        // Open only the verified native split menu, never another Gmail menu.
        const button = one([...document.querySelectorAll(S.splitMenuButton)].filter(visible));
        if (!button || readingBusy()) return;
        button.click();
        const item=await waitForChrome(()=>{
          const menus=[...document.querySelectorAll('[role="menu"]')].filter(node=>visible(node)&&
            ['No split','Vertical split','Horizontal split'].every(text=>[...node.querySelectorAll('[role="menuitem"]')].some(item=>item.textContent.trim()===text)));
          const menu=one(menus);return menu&&one([...menu.querySelectorAll('[role="menuitem"]')].filter(node=>node.textContent.trim()==='Vertical split'));
        },signal);
        if (!item || !canInitialize(owner,token,signal)) return;
        item.click();
        current=await waitForChrome(split,signal);
        if (!current || !canInitialize(owner,token,signal)) return;
      }
      if (!current) return;
      const targetWidth=readingTarget(current);
      if(targetWidth===null)return;
      readingStage('resizing');
      // A reversible initial flex preset, with no !important width rule or
      // synthetic drag. Gmail's original divider remains the resize owner.
      applyPreset(current);
      if(!await settle(signal)||!canInitialize(owner,token,signal))return;
      if (Math.abs(current.list.getBoundingClientRect().width-readingTarget(current)) > 8) return;
      if (!canInitialize(owner,token,signal)) return;
      if (running && token === generation && account() === owner) {
        presetActive=true;readingStage('ready');app.debug?.log('workspace-reading-default-ready');
      }
    } finally {
      if (setup?.controller === controller) {
        setup = undefined;
        if (!signal.aborted) setupAllowed = false;
        if(!readingHandled&&!presetActive){releasePreset();readingStage('native-fallback');}schedule();
      }
    }
  }
  function userInteracted(event) {
    if (!event.isTrusted) return;
    const target=event.target instanceof Element&&event.target;
    const handle=target?.closest(splitSelector+' > .Nt');
    const layoutInput=safe(target)&&(handle||target.closest(S.splitMenuButton)||
      target.closest('[aria-label="Toggle split pane mode"]')||target.closest('[role="menu"].apL'));
    if (layoutInput) {
      setupAllowed=false; clearTimeout(inputPause); inputPause=undefined; setup?.controller.abort();
    } else if (setupAllowed&&!readingHandled&&!presetActive) {
      // Ordinary clicks/typing while Gmail loads defer the preset. They are
      // not a reading-layout preference and must not cancel it for this visit.
      clearTimeout(inputPause);
      inputPause=setTimeout(()=>{inputPause=undefined;schedule();},500);
      setup?.controller.abort();
    }
    if(!readingHandled&&!presetActive&&(layoutInput||inputPause))readingStage('paused-after-input');
    const current=handle&&split(), owner=current&&account();
    if(event.type==='pointerdown'&&event.button===0&&owner){
      drag={owner,token:generation,id:event.pointerId,start:event.clientX,moved:false,preset:presetActive,
        listGrow:current.list.style.flexGrow,readingGrow:current.reading.style.flexGrow};
      presetActive=false;document.addEventListener('pointermove',dragMoved,true);
    }
  }
  function dragMoved(event) {
    if(drag&&event.pointerId===drag.id&&Math.abs(event.clientX-drag.start)>2)drag.moved=true;
  }
  async function dragEnded(event) {
    const state=drag;
    if(!state||event.pointerId!==state.id)return;
    drag=undefined;document.removeEventListener('pointermove',dragMoved,true);
    if(!await settle(lifecycle.signal)||!running||generation!==state.token||account()!==state.owner)return;
    const current=split(), changed=current&&(current.list.style.flexGrow!==state.listGrow||current.reading.style.flexGrow!==state.readingGrow);
    if(changed||(event.type!=='pointercancel'&&state.moved))recordNativeChoice(state.owner,true);
    else {presetActive=state.preset;schedule();}
  }
  function recordNativeChoice(owner,transfer=false) {
    const token=generation;presetActive=false;
    if(transfer)releasePreset(false);
    if(readingOwner!==owner)readingMarked=false;
    readingOwner=owner;readingHandled=true;readingStage('saved-native-layout');
    rememberReading(owner).catch(()=>{
      if(running&&generation===token)feedback('Couldn’t remember your reading layout choice. Please try again.');
    });
  }
  function nativeReadingChoiceClicked(event) {
    if(!running||!event.isTrusted||event.button!==0||!(event.target instanceof Element)||!safe(event.target))return;
    const item=event.target.closest('[role="menuitem"]'), menu=item?.closest('[role="menu"]');
    const names=['No split','Vertical split','Horizontal split'];
    const menuChoice=menu&&names.includes(item.textContent.trim())&&
      names.every(text=>[...menu.querySelectorAll('[role="menuitem"]')].some(node=>node.textContent.trim()===text));
    const toggle=event.target.closest('[aria-label="Toggle split pane mode"]');
    const toggleChoice=toggle?.nextElementSibling?.matches(S.splitMenuButton);
    const owner=(menuChoice||toggleChoice)&&account();
    // Opening/canceling options is not a choice. Keep conditional restore data
    // until native resizing actually takes ownership of the pane styles.
    if(owner)recordNativeChoice(owner);
  }
  function rememberReading(owner) {
    if(readingOwner===owner&&readingMarked)return Promise.resolve();
    if(readingMarker?.owner===owner)return readingMarker.promise;
    const token=generation, marker={owner};
    marker.promise=app.settings.markReadingLayoutHandled(owner).then(()=>{
      if(running&&generation===token&&readingOwner===owner)readingMarked=true;
    }).finally(()=>{if(readingMarker===marker)readingMarker=undefined;});
    readingMarker=marker;return marker.promise;
  }
  function readAccount(owner) {
    if(readingOwner!==owner){
      if(readingOwner){presetActive=false;releasePreset();setupAllowed=false;}
      readingOwner=owner;readingHandled=undefined;readingLookup=undefined;readingMarked=false;
      readingStage(owner?'checking-preference':'unverified-account');
    }
    if(!owner||readingLookup||readingHandled!==undefined)return;
    const token=generation;
    readingLookup=app.settings.readingLayoutHandled(owner).then(handled=>{
      if(running&&generation===token&&readingOwner===owner){
        if(readingHandled!==true)readingHandled=handled;readingMarked ||= handled;
        if(handled)readingStage('saved-native-layout');schedule();
      }
    }).catch(()=>{
      if(running&&generation===token&&readingOwner===owner){readingHandled=true;feedback('Couldn’t load your reading layout preference. Gmail’s layout is unchanged.');}
    });
  }
  function watch(nodes) {
    const next = new Set([...spine].filter(node=>node.isConnected));
    for (const node of [document.body,...nodes].filter(Boolean)) for (let parent=node; parent; parent=parent.parentElement) next.add(parent);
    spine = next;
    for (const node of spine) observer.observe(node,{childList:true,attributes:true,attributeOldValue:true,attributeFilter:['class','style','hidden','aria-hidden','aria-label']});
  }
  function refresh() {
    observer.disconnect();
    const rails = [...document.querySelectorAll(S.appRail)].filter(safe);
    placeLeft(one(rails));
    const controls = [...document.querySelectorAll(S.sidePanelToggle)].filter(visible);
    const nextRight=one(controls);
    if (right!==nextRight) {clearTimeout(rightRetry);rightRetry=undefined;}
    right = nextRight; applyRight();
    const owner = account(), current = split();
    if(setup&&setup.owner!==owner)setup.controller.abort();
    readAccount(owner);
    if(presetActive&&!readingHandled&&current&&(presetHost!==current.host||presetList!==current.list||presetReading!==current.reading))applyPreset(current);
    const allSplitButtons = [...document.querySelectorAll(S.splitMenuButton)].filter(safe);
    const splitButtons = allSplitButtons.filter(visible);
    watch([left?.node,right,current?.host,...allSplitButtons,...document.querySelectorAll(S.labelAccount)]);
    const classicMailbox=document.querySelector('[role="navigation"]:has(> .aic > .z0 > [gh="cm"][role="button"])');
    if ((left || classicMailbox) && right && owner && (current || splitButtons.length === 1 || readingHandled)) {
      bootstrap?.disconnect(); bootstrap=undefined; clearTimeout(deadline);
    }
    if (!setup && setupAllowed && !inputPause && owner && readingHandled===false &&
        document.visibilityState === 'visible' && !readingBusy() && (current || splitButtons.length===1)) {
      const controller = new AbortController(); setup = {controller,owner};
      const token=generation;
      initializeReading(owner,token,controller).catch(()=>{
        if(running&&generation===token)feedback('Couldn’t remember the reading layout. Gmail’s divider is still available.');
      });
    }
  }
  function stop() {
    running = false; generation++; cancelAnimationFrame(frame); frame=0;
    setup?.controller.abort(); setup=undefined; lifecycle?.abort();
    clearTimeout(rightRetry);rightRetry=undefined;clearTimeout(inputPause);inputPause=undefined;
    observer?.disconnect(); bootstrap?.disconnect(); clearTimeout(deadline); spine.clear();
    document.removeEventListener('click',nativeRightClicked,true);
    document.removeEventListener('click',nativeReadingChoiceClicked,true);
    document.removeEventListener('pointerup',dragEnded,true);document.removeEventListener('pointercancel',dragEnded,true);
    document.removeEventListener('pointermove',dragMoved,true);drag=undefined;
    document.removeEventListener('pointerdown',userInteracted,true); document.removeEventListener('keydown',userInteracted,true);
    document.removeEventListener('focusout',schedule);
    document.removeEventListener('visibilitychange',schedule); window.removeEventListener('resize',schedule);
    window.removeEventListener('hashchange',schedule); window.removeEventListener('popstate',schedule);
    releaseLeft(); right=undefined; leftSaving=false; rightSaving=false; feedback();
    presetActive=false;releasePreset();
    readingOwner=undefined;readingHandled=undefined;readingLookup=undefined;readingMarked=false;readingMarker=undefined;
    document.documentElement?.removeAttribute('data-gp-reading-layout');
  }
  function update(patch = {}) {
    Object.assign(options,patch);
    if (options.appleMailModeEnabled !== true) { if (running) stop(); return; }
    if (!running) {
      running=true; generation++; setupAllowed=true; lifecycle=new AbortController(); rightAttempts=new WeakMap();
      observer=new MutationObserver(records=>{if(records.some(record=>!app.isNativeCursorMutation(record)))schedule();}); bootstrap=new MutationObserver(schedule);
      // Initial Gmail shell discovery only; stable watches are shallow chrome
      // spines, never conversation rows, messages, editors or label contents.
      bootstrap.observe(document,{childList:true,subtree:true});
      deadline=setTimeout(()=>{bootstrap?.disconnect();bootstrap=undefined;},10000);
      document.addEventListener('click',nativeRightClicked,true);
      document.addEventListener('click',nativeReadingChoiceClicked,true);
      document.addEventListener('pointerup',dragEnded,true);document.addEventListener('pointercancel',dragEnded,true);
      document.addEventListener('pointerdown',userInteracted,true); document.addEventListener('keydown',userInteracted,true);
      document.addEventListener('focusout',schedule);
      document.addEventListener('visibilitychange',schedule); window.addEventListener('resize',schedule);
      window.addEventListener('hashchange',schedule); window.addEventListener('popstate',schedule);
    }
    schedule();
  }
  app.workspaceLayout=Object.freeze({start:update,update,stop});
})();
