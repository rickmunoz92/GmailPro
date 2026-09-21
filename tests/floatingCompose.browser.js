(async () => {
  'use strict';
  const app = GmailPro, workspace = document.getElementById('workspace'), results = document.getElementById('results');
  const reports = [], wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const assert = (ok, why) => { if (!ok) throw Error(why); };
  const prefs = {reply:'floatingReplyEnabled',replyAll:'floatingReplyAllEnabled',forward:'floatingForwardEnabled'};
  let shell, heading, mount, serial = 0;
  app.reverseThreads = {currentConversation: () => ({heading})};
  function setup() {
    app.autoBcc.stop(); app.floatingCompose.stop(); mount?.remove(); workspace.replaceChildren();
    shell = document.createElement('div'); shell.className='iY';
    shell.innerHTML='<h2 data-thread-perm-id="thread" data-legacy-thread-id="legacy">Thread</h2>';
    heading=shell.firstElementChild; workspace.append(shell);
    mount=document.createElement('div'); mount.innerHTML='<div><div></div></div>'; document.body.append(mount);
    app.floatingCompose.start(app.settings.defaults);
  }
  function startBcc(enabled=true) { app.autoBcc.start({autoBccEnabled:enabled,bccAddress:'archive@example.com'}); }
  function addForm(host) {
    const form=document.createElement('form');
    form.innerHTML='<input type="hidden" name="composeid"><input role="combobox" aria-label="To recipients"><span role="link" aria-label="Add Bcc recipients">Bcc</span><div role="listbox" hidden><input role="combobox" aria-label="BCC recipients"></div>';
    const bcc=form.querySelector('[aria-label="BCC recipients"]');
    form.querySelector('[role="link"]').onclick=()=>{bcc.parentElement.hidden=false;bcc.focus();};
    bcc.onkeydown=e=>{if(e.key!=='Enter')return; const chip=document.createElement('span');chip.setAttribute('role','option');chip.dataset.hovercardId=bcc.value;bcc.before(chip);bcc.value='';};
    host.prepend(form); return form;
  }
  function draft(floating=true, early=false, identity) {
    const host=document.createElement('div');host.setAttribute('role',floating?'dialog':'region');host.dataset.composeId=identity||'test-'+(++serial);
    host.innerHTML='<div contenteditable="true" role="textbox" aria-label="Message Body">Signature and quoted text</div>';
    if(!early)addForm(host);
    (floating?mount.firstElementChild.firstElementChild:shell).append(host);
    host.querySelector('[contenteditable]').focus();return host;
  }
  function action(kind='reply', {menu=false, phase='click', ignoreShift=false}={}) {
    const control=document.createElement('span');control.setAttribute('role',menu?'menuitem':'button');
    control.setAttribute('aria-label',{reply:'Reply',replyAll:'Reply all',forward:'Forward'}[kind]);control.innerHTML='<span>Action</span>';
    (menu?workspace:shell).append(control); const calls=[];let made;
    control.addEventListener(phase,e=>{calls.push(e); made=draft(!ignoreShift&&e.getModifierState('Shift'));});
    return {control,calls,get made(){return made;}};
  }
  async function test(name, run) {
    setup();try{await run();reports.push('PASS '+name);}catch(e){reports.push('FAIL '+name+': '+e.message);}
    app.autoBcc.stop();app.floatingCompose.stop();
    if(composeLifecycle.observersActive()||composeLifecycle.listenersActive())reports.push('FAIL '+name+': leak '+composeLifecycle.describe());
    results.textContent=reports.join('\n');
  }
  for(const kind of Object.keys(prefs)) {
    await test(kind+' opens directly with one native Shift action',()=>{
      const a=action(kind);a.control.firstElementChild.click();
      assert(a.calls.length===1&&a.calls[0].shiftKey&&a.calls[0].getModifierState('Shift'),'one real Shift event');
      assert(a.calls[0].target===a.control.firstElementChild,'original nested target');
      assert(a.made.matches('[role="dialog"]')&&!workspace.querySelector('[role="region"]'),'no inline draft');
      assert(a.made.textContent.includes('Signature and quoted text'),'native content');
    });
    await test(kind+' preference off preserves Gmail inline behavior',()=>{
      app.floatingCompose.update({[prefs[kind]]:false});const a=action(kind);a.control.click();assert(a.made.matches('[role="region"]')&&!a.calls[0].shiftKey,'native inline');
    });
    await test(kind+' with independent Auto BCC preserves body focus',async()=>{
      startBcc();const a=action(kind);a.control.click();await wait(220);
      assert(a.made.querySelectorAll('[data-hovercard-id="archive@example.com"]').length===1,'one BCC');
      assert(document.activeElement===a.made.querySelector('[contenteditable]'),'body focus');
    });
  }
  await test('all native phases carry Shift once with coordinates and pointer identity',()=>{
    const a=action('reply',{phase:'mousedown'}), seen=[];
    for(const type of ['pointerdown','mousedown','mouseup','click'])a.control.addEventListener(type,e=>seen.push(e));
    for(const type of ['pointerdown','mousedown','mouseup','click'])a.control.firstElementChild.dispatchEvent(new (type==='pointerdown'?PointerEvent:MouseEvent)(type,{bubbles:true,cancelable:true,composed:true,button:0,buttons:type.includes('down')?1:0,clientX:43,clientY:27,detail:1,pointerId:7,pointerType:'mouse'}));
    assert(seen.length===4&&seen.every(e=>e.getModifierState('Shift')&&e.clientX===43&&e.clientY===27&&e.detail===1),'one event per phase, native data');
    assert(seen[0].pointerId===7&&seen[0].pointerType==='mouse'&&a.calls.length===1,'pointer and early header handler');
  });
  await test('detached native message menu',()=>{const a=action('forward',{menu:true});a.control.click();assert(a.made.matches('[role="dialog"]'),'direct floating');});
  await test('persistent toolbar bridge preserves Shift without duplicate activation',()=>{
    const a=action('replyAll'),top=document.createElement('button');top.dataset.gpMessageAction='replyAll';workspace.append(top);
    top.onclick=e=>a.control.dispatchEvent(new MouseEvent('click',{bubbles:true,shiftKey:e.shiftKey}));top.click();assert(a.calls.length===1&&a.made.matches('[role="dialog"]'),'one native activation');
  });
  for(const modifier of ['shiftKey','ctrlKey','metaKey','altKey'])await test('explicit '+modifier+' untouched',()=>{
    const a=action(),original=new MouseEvent('click',{bubbles:true,[modifier]:true});a.control.dispatchEvent(original);assert(a.calls[0]===original,'original event');
  });
  await test('right click and disabled controls untouched',()=>{
    const a=action();const e=new MouseEvent('click',{bubbles:true,button:2});a.control.dispatchEvent(e);assert(a.calls[0]===e,'right click');
    a.control.setAttribute('aria-disabled','true');a.control.click();assert(!a.calls[1].shiftKey,'disabled');
  });
  await test('native cancellation reaches original event',()=>{
    const a=action();a.control.addEventListener('click',e=>e.preventDefault());
    assert(!a.control.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true})),'cancelled');
  });
  for(const area of ['.ii','[contenteditable]','[role="dialog"]','[role="region"]','outside'])await test('exclude '+area,()=>{
    const a=action(),box=document.createElement('div');
    if(area==='outside')workspace.append(box);else {if(area==='.ii')box.className='ii';else if(area==='[contenteditable]')box.contentEditable='true';else box.setAttribute('role',area.includes('dialog')?'dialog':'region');shell.append(box);}
    box.append(a.control);a.control.click();assert(!a.calls[0].shiftKey,'unmodified');
  });
  await test('unknown action and native keyboard shortcuts stay native',()=>{
    const a=action();a.control.setAttribute('aria-label','Localized unknown');a.control.click();assert(!a.calls[0].shiftKey,'unknown untouched');
    for(const key of ['r','a','f'])shell.dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true}));assert(a.calls.length===1,'no shortcut interception');
  });
  await test('ignored Shift never triggers delayed conversion or hides a draft',async()=>{
    const a=action('reply',{ignoreShift:true});a.control.click();let pops=0;
    const pop=document.createElement('button');pop.setAttribute('aria-label','Pop out reply');pop.onclick=()=>pops++;a.made.append(pop);
    await wait(550);assert(!pops&&a.made.matches('[role="region"]')&&a.made.checkVisibility(),'inline stays usable');
    assert(!a.made.hasAttribute('data-gp-floating-pending')&&composeLifecycle.observersActive()===0,'no observer or hiding');
  });
  await test('stop, disable-all, and repeated start have no residual hooks',()=>{
    app.floatingCompose.update(Object.fromEntries(Object.values(prefs).map(p=>[p,false])));assert(composeLifecycle.listenersActive()===0,'disabled cleanup');
    app.floatingCompose.start(app.settings.defaults);app.floatingCompose.start(app.settings.defaults);assert(composeLifecycle.listenersActive()===4,'only four hooks');
    app.floatingCompose.stop();const a=action();a.control.click();assert(!a.calls[0].shiftKey,'native after stop');
  });
  await test('Auto BCC off leaves native recipient fields unchanged',async()=>{
    startBcc(false);const a=action();a.control.click();await wait(220);assert(!a.made.querySelector('[data-hovercard-id]')&&a.made.querySelector('[role="listbox"]').hidden,'no BCC manipulation');
  });
  await test('early focused detached shell discovers form without refocusing',async()=>{
    startBcc();const host=draft(true,true);const body=document.activeElement;await wait(20);addForm(host);await wait(220);
    assert(host.querySelectorAll('[data-hovercard-id]').length===1&&document.activeElement===body,'late form and focus');
  });
  await test('early nested region watches its floating dialog',async()=>{
    startBcc();const host=document.createElement('div');host.setAttribute('role','dialog');host.dataset.composeId='test-'+(++serial);
    host.innerHTML='<div role="region"><div contenteditable="true" role="textbox" aria-label="Message Body">Signature</div></div>';
    mount.firstElementChild.firstElementChild.append(host);const region=host.firstElementChild;region.firstElementChild.focus();await wait(20);addForm(region);await wait(220);
    assert(host.querySelectorAll('[data-hovercard-id]').length===1,'nested form discovered');
  });
  await test('existing recipient suppresses duplicate addition',async()=>{
    startBcc();const host=draft();host.querySelector('[aria-label="To recipients"]').value='archive@example.com';await wait(220);assert(!host.querySelector('[data-hovercard-id]'),'no duplicate');
  });
  await test('manual removal survives form replacement with same draft identity',async()=>{
    startBcc();const host=draft();await wait(220);host.querySelector('[data-hovercard-id]').remove();await wait(120);
    const id=host.dataset.composeId;host.remove();await wait(20);const next=draft(true,false,id);await wait(220);assert(!next.querySelector('[data-hovercard-id]'),'removal respected');
  });
  await test('multiple drafts, minimized and fullscreen surfaces remain independent',async()=>{
    startBcc();const first=draft(),second=draft();second.querySelector('[aria-label="To recipients"]').focus();await wait(220);
    first.hidden=true;second.classList.add('fullscreen');await wait(120);
    assert(first.hidden&&[first,second].every(h=>h.querySelectorAll('[data-hovercard-id]').length===1),'one BCC per draft and no reopening');
    assert(document.activeElement===second.querySelector('[aria-label="To recipients"]'),'recipient focus retained');
  });
  await test('incomplete host watcher releases on removal and bounded deadline',async()=>{
    startBcc();const baseline=composeLifecycle.observersActive(),host=draft(true,true);assert(composeLifecycle.observersActive()===baseline+1,'short-lived watch');host.remove();await wait(20);assert(composeLifecycle.observersActive()===baseline,'removed cleanup');
    draft(true,true);await wait(5100);assert(composeLifecycle.observersActive()===baseline,'deadline cleanup');
  });
  mount.remove();const failures=reports.filter(x=>x.startsWith('FAIL')).length;
  results.textContent=reports.join('\n')+'\n\n'+(reports.length-failures)+'/'+reports.length+' checks passed.';results.dataset.failures=String(failures);
})();
