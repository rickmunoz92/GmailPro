(async () => {
  'use strict';
  const app=GmailPro, feature=app.keyboardShortcuts, workspace=document.getElementById('workspace'), reports=[];
  const result=document.getElementById('results'), wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const assert=(ok,why)=>{if(!ok)throw Error(why);};
  let archived=0,sent=0,discarded=0,undone=0,serial=0;
  const nativeShortcut=event=>{if(event.metaKey&&event.shiftKey&&event.key.toLowerCase()==='d')discarded++;};
  const key=(value='d',type='keydown',patch={})=>{
    const event=new KeyboardEvent(type,{key:value.toUpperCase(),code:'Key'+value.toUpperCase(),metaKey:true,shiftKey:true,bubbles:true,cancelable:true,...patch});
    document.activeElement.dispatchEvent(event);return event;
  };
  function press(value='d',patch={}) { const event=key(value,'keydown',patch);key(value,'keypress',patch);key(value,'keyup',patch);return event; }
  function setup() {
    feature.stop();app.autoBcc.stop();workspace.replaceChildren();archived=sent=discarded=undone=0;
    workspace.innerHTML='<div gh="tm"><div gh="mtb"><button aria-label="Archive">Archive</button></div></div><input aria-label="Search mail">';
    workspace.querySelector('button').onclick=()=>archived++;
    feature.start(app.settings.defaults);workspace.focus();
    for(const type of ['keydown','keypress','keyup'])document.addEventListener(type,nativeShortcut);
  }
  function draft({role='dialog',nested=false,identity='shortcut-'+(++serial),label='Send ‪(⌘Enter)‬'}={}) {
    const host=document.createElement('div');host.setAttribute('role',role);host.dataset.composeId=identity;
    host.innerHTML='<form><input type="hidden" name="composeid"><input role="combobox" aria-label="To recipients"><input name="subjectbox" aria-label="Subject"><span role="link" aria-label="Add Bcc recipients">Bcc</span><div role="listbox" hidden><input role="combobox" aria-label="BCC recipients"></div></form><div role="textbox" aria-label="Message Body" contenteditable="true">Signature and quoted history</div><button class="send"></button><button aria-label="Send & archive">Send & archive</button><button aria-label="More send options">More send options</button><button aria-label="Discard draft">Discard</button>';
    const send=host.querySelector('.send');send.setAttribute('aria-label',label);send.textContent='Send';send.onclick=()=>{sent++;host.dataset.sent=String(Number(host.dataset.sent||0)+1);};
    host.querySelector('[aria-label="Send & archive"]').onclick=()=>{throw Error('Wrong send action');};
    host.querySelector('[aria-label="Discard draft"]').onclick=()=>discarded++;
    const bcc=host.querySelector('[aria-label="BCC recipients"]');host.querySelector('[role="link"]').onclick=()=>{bcc.parentElement.hidden=false;bcc.focus();};
    bcc.onkeydown=e=>{if(e.key!=='Enter')return;const chip=document.createElement('span');chip.setAttribute('role','option');chip.dataset.hovercardId=bcc.value;bcc.before(chip);bcc.value='';};
    if(nested){const region=document.createElement('div');region.setAttribute('role','region');region.append(...host.childNodes);host.append(region);}
    workspace.append(host);host.querySelector('[contenteditable]').focus();return host;
  }
  function undoNotice(message='Conversation archived.') {
    const toast=document.createElement('div');toast.className='b8 UC bAp';toast.setAttribute('role','alert');
    toast.innerHTML='<div class="J-J5-Ji"><div class="vh"><span class="aT"><span class="bAq"></span><span class="bAo"><span class="ag a8k" id="link_undo" tabindex="0" role="link" aria-label="Undo link">Undo</span></span></span></div></div>';
    toast.querySelector('.bAq').textContent=message;
    toast.querySelector('#link_undo').onclick=()=>undone++;
    workspace.append(toast);return toast;
  }
  const undo=patch=>press('z',{shiftKey:false,...patch});
  async function test(name, run) {
    setup();try{await run();reports.push('PASS '+name);}catch(e){reports.push('FAIL '+name+': '+e.message);}
    feature.stop();app.autoBcc.stop();for(const type of ['keydown','keypress','keyup'])document.removeEventListener(type,nativeShortcut);
    if(composeLifecycle.listenersActive()||composeLifecycle.observersActive())reports.push('FAIL '+name+': lifecycle leak '+composeLifecycle.describe());
    result.textContent=reports.join('\n');
  }
  await test('archive delegates once to the native toolbar for open and bulk selections',()=>{
    for(const selected of [0,1,3]){workspace.dataset.selected=String(selected);const original=workspace.innerHTML;press('a');assert(workspace.innerHTML===original,'selection DOM untouched');}
    assert(archived===3&&sent===0&&discarded===0,'one archive per press');
  });
  for(const field of ['input','textarea','select','[contenteditable]'])await test('archive does nothing while editing '+field,()=>{
    const node=field==='[contenteditable]'?document.createElement('div'):document.createElement(field);if(field==='[contenteditable]')node.contentEditable='true';workspace.append(node);node.focus();assert(press('a').defaultPrevented&&archived===0,'reserved, no archive');
  });
  for(const type of ['menu','dialog','alertdialog'])await test('open '+type+' blocks actions and never discards',()=>{
    draft();const overlay=document.createElement('div');overlay.setAttribute('role',type);overlay.textContent='Overlay';workspace.append(overlay);press();workspace.focus();press('a');assert(sent===0&&archived===0&&discarded===0,'blocked');
  });
  await test('native pressed-state controls receive one mouse gesture',()=>{const host=draft(),send=host.querySelector('.send'),phases=[];let pressed=false,actions=0;send.onmousedown=()=>{pressed=true;phases.push('down');};send.onmouseup=()=>{if(pressed)actions++;pressed=false;phases.push('up');};send.onclick=()=>phases.push('click');press();assert(actions===1&&phases.join(',')==='down,up,click'&&discarded===0,'one native gesture');});
  await test('native action removing its button stops the remaining mouse phases',()=>{const host=draft(),send=host.querySelector('.send');send.onmouseup=()=>send.remove();press();assert(sent===0&&discarded===0,'no detached click');});
  await test('archive ignores per-row buttons, missing, disabled, hidden and ambiguous toolbar targets',()=>{
    const toolbar=workspace.querySelector('[gh="mtb"]'),button=toolbar.firstElementChild;
    const rowButton=button.cloneNode(true);rowButton.onclick=()=>archived+=100;workspace.append(rowButton);
    for(const mode of ['disabled','hidden','duplicate','missing']){
      button.disabled=mode==='disabled';button.hidden=mode==='hidden';toolbar.replaceChildren();if(mode!=='missing')toolbar.append(button);if(mode==='duplicate')toolbar.append(button.cloneNode(true));
      press('a');assert(!archived,'no target in '+mode);
    }
  });
  for(const role of ['dialog','region'])for(const field of ['[contenteditable]','[aria-label="To recipients"]','[name="subjectbox"]','.send'])await test(role+' sends only the composer focused in '+field,()=>{
    const other=draft(),host=draft({role});host.querySelector(field).focus();press();assert(host.dataset.sent==='1'&&!other.dataset.sent&&discarded===0,'correct draft only');
    assert(host.querySelector('[contenteditable]').textContent==='Signature and quoted history','content retained');
  });
  await test('nested native region and full screen use the same focused composer',()=>{const host=draft({nested:true});host.classList.add('fullscreen');press();assert(sent===1&&discarded===0,'native send');});
  await test('no focused composer and minimized drafts never send or discard',()=>{draft().hidden=true;workspace.focus();press();assert(sent===0&&discarded===0,'no guessed target');});
  await test('missing, disabled, hidden and ambiguous Send always suppress Discard',()=>{
    const host=draft(),send=host.querySelector('.send');
    for(const mode of ['disabled','hidden','duplicate','missing']){send.disabled=mode==='disabled';send.hidden=mode==='hidden';host.querySelectorAll('.send').forEach(x=>x.remove());if(mode!=='missing')host.append(send);if(mode==='duplicate')host.append(send.cloneNode(true));host.querySelector('[contenteditable]').focus();press();assert(sent===0&&discarded===0,'safe in '+mode);}
  });
  await test('Send lookalikes inside authored content are never activated',()=>{const host=draft(),fake=document.createElement('button');fake.textContent='Send';fake.onclick=()=>discarded++;host.querySelector('[contenteditable]').append(fake);press();assert(sent===1&&discarded===0,'native toolbar only');host.querySelector('.send').remove();press();assert(sent===1&&discarded===0,'no fallback into authored content');});
  await test('Send and archive/send options alone cannot match normal Send',()=>{const host=draft();host.querySelector('.send').remove();press();assert(sent===0&&discarded===0,'no alternate send');});
  await test('malformed or multiple compose forms never send or discard',()=>{
    const host=draft();host.querySelector('form').append(document.createElement('span'));host.append(host.querySelector('form').cloneNode(true));press();assert(sent===0&&discarded===0,'ambiguous form');host.querySelectorAll('form').forEach(x=>x.remove());press();assert(!sent&&!discarded,'missing form');
  });
  await test('held keys and companion events trigger once with zero native discard events',()=>{
    draft();key();key('d','keydown',{repeat:true});key('d','keydown',{repeat:true});key('d','keypress');key('d','keyup',{metaKey:false,shiftKey:false});assert(sent===1&&discarded===0,'one action');press();assert(sent===2&&discarded===0,'next press works');
  });
  await test('macOS missing letter keyup releases on modifier release and blur',()=>{
    draft();key();key();assert(sent===2,'new physical press without keyup');key('Meta','keyup',{key:'Meta',metaKey:false});key();window.dispatchEvent(new Event('blur'));key();assert(sent===4&&discarded===0,'releases and blur handled');key('d','keyup');
  });
  await test('typing after a missing Command keyup remains native',()=>{draft();key();assert(!press('d',{metaKey:false,shiftKey:false}).defaultPrevented,'ordinary D unmodified');assert(sent===1,'no extra send');});
  await test('extra modifiers, composition, native E and Command Enter stay untouched',()=>{
    draft();for(const patch of [{ctrlKey:true},{altKey:true},{metaKey:false},{shiftKey:false},{isComposing:true}])assert(!press('d',patch).defaultPrevented,'unmodified event');
    assert(!press('e',{metaKey:false,shiftKey:false}).defaultPrevented,'native E');assert(!press('Enter',{key:'Enter',shiftKey:false}).defaultPrevented,'native Send');assert(sent===0,'no actions');
  });
  await test('pre-cancelled and uncancelable events cannot activate native actions',()=>{
    draft();const event=new KeyboardEvent('keydown',{key:'D',metaKey:true,shiftKey:true,bubbles:true,cancelable:true});event.preventDefault();document.activeElement.dispatchEvent(event);key('d','keyup');press('d',{cancelable:false});assert(sent===0,'no action');
  });
  await test('independent preferences restore native handlers only when disabled',()=>{
    draft();feature.update({sendShortcutEnabled:false});press();assert(sent===0&&discarded===3,'native chord restored');workspace.focus();press('a');assert(archived===1,'archive still active');feature.update({sendShortcutEnabled:true,archiveShortcutEnabled:false});assert(!press('a').defaultPrevented,'archive restored');discarded=0;draft();press();assert(sent===1&&discarded===0,'send reenabled');
  });
  await test('fresh native resolution follows navigation and composer replacement',()=>{
    const old=draft();old.remove();workspace.focus();press();assert(sent===0&&discarded===0,'old draft not reused');const fresh=draft();window.dispatchEvent(new Event('hashchange'));press();assert(fresh.dataset.sent==='1','fresh context');
    workspace.focus();const toolbar=workspace.querySelector('[gh="mtb"]');toolbar.replaceChildren();const next=document.createElement('button');next.setAttribute('aria-label','Archive');next.onclick=()=>archived++;toolbar.append(next);press('a');assert(archived===1,'fresh toolbar');
  });
  await test('Auto BCC insertion and manual removal survive native Send activation',async()=>{
    app.autoBcc.start({autoBccEnabled:true,bccAddress:'archive@example.com'});const host=draft();await wait(220);assert(host.querySelectorAll('[data-hovercard-id]').length===1,'BCC ready');press();assert(sent===1&&host.querySelectorAll('[data-hovercard-id]').length===1&&discarded===0,'BCC unchanged');host.querySelector('[data-hovercard-id]').remove();await wait(120);press();assert(sent===2&&!host.querySelector('[data-hovercard-id]'),'manual removal respected');
  });
  await test('native validation remains in control without retries or queued send',async()=>{
    const host=draft();let validation=0;host.querySelector('.send').onclick=()=>validation++;press();await wait(100);assert(validation===1&&sent===0&&discarded===0,'one native validation');
  });
  for (const action of ['Archive','Move to']) await test('Undo delegates single and bulk '+action+' restoration to Gmail',()=>{
    for (const count of [1,3]) {
      const before=Array.from({length:count},(_,i)=>['Inbox','Original '+i]);
      let labels=before.map(()=>action==='Archive'?[]:['Destination']);
      const toast=undoNotice();toast.querySelector('#link_undo').onclick=()=>{undone++;labels=before;toast.remove();};
      assert(undo().defaultPrevented,'mailbox chord reserved');
      assert(labels===before,'native owner restored prior state');
    }
    assert(undone===2 && sent===0 && discarded===0,'one native action per press');
  });
  await test('Undo Send uses the same available native Undo without another Send',()=>{
    undoNotice('Message sent.');undo();assert(undone===1 && sent===0 && discarded===0,'Undo only');
  });
  await test('Undo ignores expired, hidden, disabled and ambiguous controls',()=>{
    assert(undo().defaultPrevented && !undone,'missing reserved');
    const toast=undoNotice(),control=toast.querySelector('#link_undo');
    toast.hidden=true;undo();toast.hidden=false;
    control.setAttribute('aria-disabled','true');undo();control.removeAttribute('aria-disabled');
    const duplicate=undoNotice();undo();duplicate.remove();
    toast.remove();undo();assert(!undone,'unavailable controls untouched');
  });
  await test('Undo rejects authored, third-party and unrelated lookalikes',()=>{
    for(const wrapper of ['.ii','.a3s','[contenteditable]','.inboxsdk__butterbar','[data-inboxsdk-id]']) {
      const box=document.createElement('div');
      if(wrapper.startsWith('.'))box.className=wrapper.slice(1);else box.setAttribute(wrapper.slice(1,-1),'true');
      workspace.append(box);box.append(undoNotice());undo();box.remove();
    }
    const fake=document.createElement('a');fake.id='link_undo';fake.setAttribute('role','link');fake.textContent='Undo';fake.onclick=()=>undone++;
    workspace.append(fake);undo();fake.remove();
    const altered=undoNotice();altered.querySelector('#link_undo').setAttribute('aria-label','Redo');undo();altered.remove();
    assert(!undone,'only native notification may activate');
  });
  await test('page-wide InboxSDK theme classes do not hide Gmail native Undo',()=>{
    document.body.classList.add('inboxsdk__gmail_dark_theme');
    try { undoNotice();undo();assert(undone===1,'native Undo still works'); }
    finally { document.body.classList.remove('inboxsdk__gmail_dark_theme'); }
  });
  for(const field of ['input','textarea','select','[contenteditable]'])await test('Undo leaves every editing event untouched in '+field,()=>{
    undoNotice();const node=document.createElement(field==='[contenteditable]'?'div':field);
    if(field==='[contenteditable]')node.contentEditable='true';workspace.append(node);node.focus();
    for(const type of ['keydown','keypress','keyup'])assert(!key('z',type,{shiftKey:false}).defaultPrevented,'native editor receives '+type);
    assert(!undone,'no mailbox action');
  });
  for(const field of ['[contenteditable]','[aria-label="To recipients"]','[name="subjectbox"]','.send'])await test('Undo preserves composer focus in '+field,()=>{
    undoNotice();const host=draft();host.querySelector(field).focus();assert(!undo().defaultPrevented && !undone,'composer owns undo');
  });
  for(const role of ['menu','dialog','alertdialog'])await test('Undo leaves shortcuts untouched with an open '+role,()=>{
    undoNotice();const overlay=document.createElement('div');overlay.setAttribute('role',role);overlay.textContent='Open overlay';workspace.append(overlay);
    assert(!undo().defaultPrevented && !undone,'overlay owns keys');
  });
  await test('Undo repeats, missing macOS releases and focus changes stay safe',()=>{
    undoNotice();key('z','keydown',{shiftKey:false});key('z','keydown',{shiftKey:false,repeat:true});key('z','keypress',{shiftKey:false});
    assert(undone===1,'held press once');key('z','keydown',{shiftKey:false});assert(undone===2,'fresh press without release');
    workspace.querySelector('input').focus();assert(!key('z','keyup',{shiftKey:false,metaKey:false}).defaultPrevented,'editing companion untouched');
    workspace.focus();window.dispatchEvent(new Event('blur'));undo();assert(undone===3,'blur resets');
  });
  await test('Undo rejects extra modifiers, IME, native Z and redo',()=>{
    undoNotice();for(const patch of [{shiftKey:true},{altKey:true},{ctrlKey:true},{isComposing:true},{metaKey:false}])assert(!undo(patch).defaultPrevented,'native combination untouched');
    assert(!undone,'no action');
  });
  await test('Undo resolves successive notifications after navigation without storing history',()=>{
    const previous=undoNotice();previous.remove();window.dispatchEvent(new Event('hashchange'));undo();assert(!undone,'expired is not retained');
    const next=undoNotice('Conversations moved.');undo();assert(undone===1,'fresh notification');next.remove();undo();assert(undone===1,'no replay');
  });
  await test('Undo preference independently activates, disables and restores its listener',()=>{
    undoNotice();feature.update({archiveShortcutEnabled:false,sendShortcutEnabled:false});undo();assert(undone===1,'undo alone active');
    feature.update({undoShortcutEnabled:false});assert(!undo().defaultPrevented,'disabled is native');assert(composeLifecycle.listenersActive()===0,'all off cleaned up');
    feature.update({undoShortcutEnabled:true});undo();assert(undone===2,'undo reenabled');
  });
  await test('start/update/stop deduplicate and release every listener without observers',()=>{
    feature.start(app.settings.defaults);feature.update({appleMailModeEnabled:true});assert(composeLifecycle.listenersActive()===4&&composeLifecycle.observersActive()===0,'four delegated listeners');feature.update({archiveShortcutEnabled:false,sendShortcutEnabled:false,undoShortcutEnabled:false});assert(composeLifecycle.listenersActive()===0,'disabled cleanup');feature.start(app.settings.defaults);feature.stop();assert(!press('a').defaultPrevented && !undo().defaultPrevented,'stopped');
  });
  const failures=reports.filter(x=>x.startsWith('FAIL')).length;
  result.textContent=reports.join('\n')+'\n\n'+(reports.length-failures)+'/'+reports.length+' checks passed.';result.dataset.failures=String(failures);
  workspace.replaceChildren();
  document.getElementById('manual').disabled=false;
  document.getElementById('manual').onclick=()=>{
    setup();const toast=undoNotice(),host=draft();
    const output=document.getElementById('manual-results');
    const render=()=>{output.textContent=JSON.stringify({archived,sent,discarded,undone,focus:document.activeElement.getAttribute('aria-label')});};
    toast.querySelector('#link_undo').addEventListener('click',render);
    host.querySelector('.send').addEventListener('click',render);workspace.querySelector('[aria-label="Archive"]').addEventListener('click',render);render();
  };
})();
