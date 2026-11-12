(async () => {
  'use strict';
  const app = GmailPro, workspace = document.getElementById('workspace'), results = document.getElementById('results');
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const assert = (value, message) => { if (!value) throw Error(message); };
  let passes = 0, failures = 0, timers = [];
  function stop() {
    app.archiveRead.stop(); app.keyboardShortcuts.stop(); app.readingPane.stop(); app.reverseThreads.stop();
    for (const timer of timers) clearTimeout(timer); timers = [];
  }
  function gesture(node, action) {
    let down = false, up = false;
    node.addEventListener('mousedown', event => { down = event.buttons === 1; up = false; });
    node.addEventListener('mouseup', () => { up = down; down = false; });
    node.addEventListener('click', () => { if (up) { up = false; action(); } });
  }
  function click(node, modifiers = {}) {
    for (const type of ['pointerdown', 'mousedown', 'mouseup', 'click']) node.dispatchEvent(new MouseEvent(type,
      { bubbles:true, cancelable:true, button:0, buttons:/down$/.test(type)?1:0, detail:1, ...modifiers }));
  }
  function fixture({ selected = [0], unread = [0], delay = 0, ignoreRead = false, enabled = true, open = false, integrated = false } = {}) {
    stop(); history.replaceState(null, '', '#inbox'); workspace.innerHTML = '<main role="main"><div gh="tm"><div gh="mtb"><button aria-label="Archive">Archive</button><button aria-label="Mark as read">Read</button><button aria-label="Mark as unread">Unread</button><button aria-label="Delete">Delete</button></div></div><div class="Nu tf"></div><div class="Nu S3"></div></main>';
    const main = workspace.querySelector('main'), list = main.querySelector('.tf');
    const rows = [0,1,2].map(i => GmailProTestRow({ unread:unread.includes(i), threadId:'#thread-'+i, legacyThreadId:'legacy-'+i }));
    const grid = rows[0].closest('table'); list.append(grid);
    for (const row of rows.slice(1)) { const table = row.closest('table'); grid.tBodies[0].append(row); table.remove(); }
    const box = row => row.querySelector(':scope > td > [role="checkbox"]');
    rows.forEach((row,i) => box(row).setAttribute('aria-checked', selected.includes(i)?'true':'false'));
    if (open) {
      rows[0].classList.add('aps');
      main.querySelector('.S3').innerHTML = '<div class="iY"><h2 data-thread-perm-id="thread-0" data-legacy-thread-id="legacy-0">Synthetic</h2><div role="list"><div role="listitem" aria-expanded="true" tabindex="-1" jsaction="message:.CLIENT"><div><div class="adn" data-message-id="msg" data-legacy-message-id="msg-legacy"><div class="ii"><div class="a3s">Synthetic body</div></div></div></div></div></div></div>';
    }
    const archive = main.querySelector('button[aria-label="Archive"]'), read = main.querySelector('button[aria-label="Mark as read"]'), unreadButton = main.querySelector('button[aria-label="Mark as unread"]');
    const calls = [], targetRows = () => rows.filter(row => row.isConnected && box(row).getAttribute('aria-checked') === 'true');
    const targets = () => targetRows().length ? targetRows() : rows.filter(row => row.isConnected && row.classList.contains('aps'));
    const sync = () => { read.hidden = !targets().some(row => row.classList.contains('zE')); unreadButton.hidden = !read.hidden; };
    const mark = targets => {
      calls.push({kind:'read', rows:targets.map(row => rows.indexOf(row))});
      if (ignoreRead) return;
      const finish = () => {
        for (const row of targets) { row.classList.remove('zE'); row.classList.add('yO'); row.querySelector('.brr').setAttribute('data-tooltip','Mark as unread'); }
        sync();
      };
      if (delay) timers.push(setTimeout(finish,delay)); else finish();
    };
    const store = targets => {
      calls.push({kind:'archive', rows:targets.map(row => rows.indexOf(row)), allRead:targets.every(row => row.classList.contains('yO') && !row.classList.contains('zE'))});
      for (const row of targets) row.remove();
      const toast = document.createElement('div'); toast.className='b8'; toast.setAttribute('role','alert');
      toast.innerHTML='<div class="J-J5-Ji"><div class="vh"><span class="aT"><span class="bAq">Conversation archived.</span><span class="bAo"><span id="link_undo" role="link" aria-label="Undo link">Undo</span></span></span></div></div>';
      toast.querySelector('[id="link_undo"]').addEventListener('click',()=> { for(const row of targets) grid.tBodies[0].append(row); toast.remove(); sync(); }); main.append(toast);
    };
    for (const row of rows) {
      const tools = row.querySelector('.bqY'); tools.innerHTML = '<li class="bqX brq" data-tooltip="Archive">Archive row</li><li class="bqX brr" data-tooltip="Mark as read">Read row</li>';
      gesture(tools.querySelector('.brq'),()=>store([row])); gesture(tools.querySelector('.brr'),()=>mark([row]));
    }
    gesture(read,()=>mark(targets())); gesture(archive,()=>store(targets()));
    sync();
    const settings={...app.settings.defaults,appleMailModeEnabled:enabled};
    if(integrated) app.readingPane.start(settings);
    app.archiveRead.start(settings); app.keyboardShortcuts.start(settings);
    return { main, rows, box, calls, archive, read, sync, grid, click, mark, store };
  }
  async function test(name, run) {
    try { await run(); passes++; results.textContent+='PASS '+name+'\n'; }
    catch(error) { failures++; results.textContent+='FAIL '+name+': '+error.message+'\n'; }
    finally { stop(); }
  }
  results.textContent='';
  await test('toolbar marks unread selection read before archiving once',async()=>{
    const f=fixture();click(f.archive);await wait(80);
    assert(f.calls.length===2 && f.calls[0].kind==='read' && f.calls[1].allRead,'read then one archive');
    assert(f.rows[1].isConnected && f.rows[2].isConnected,'other conversations untouched');
  });
  await test('mixed bulk selection keeps the exact selected targets',async()=>{
    const f=fixture({selected:[0,1],unread:[0,2]});click(f.archive);await wait(80);
    assert(f.calls.length===2 && f.calls[1].allRead && f.calls[1].rows.join()==='0,1','exact bulk read and archive');
    assert(f.rows[2].classList.contains('zE') && f.rows[2].isConnected,'unselected unread untouched');
  });
  await test('already-read conversation archives without an extra read',async()=>{
    const f=fixture({unread:[]});click(f.archive);assert(f.calls.length===1 && f.calls[0].kind==='archive','native archive');
  });
  await test('row hover archives only the hovered row while preserving another selection',async()=>{
    const f=fixture({selected:[1],unread:[0,1]});click(f.rows[0].querySelector('.brq'));await wait(80);
    assert(f.calls.length===2 && f.calls[1].rows.join()==='0' && f.calls[1].allRead,'hovered row read and archived');
    assert(f.box(f.rows[1]).getAttribute('aria-checked')==='true' && f.rows[1].classList.contains('zE'),'selection untouched');
  });
  await test('waits for Gmail read confirmation and absorbs repeated Archive',async()=>{
    const f=fixture({delay:180});click(f.archive);click(f.archive);await wait(70);
    assert(f.calls.length===1,'no early archive or duplicate read');await wait(180);
    assert(f.calls.length===2 && f.calls[1].allRead,'one archive after confirmation');
  });
  await test('read state changing during a held Archive click still archives',async()=>{
    const f=fixture();f.archive.dispatchEvent(new MouseEvent('pointerdown',{bubbles:true,cancelable:true,button:0}));
    f.mark([f.rows[0]]);f.archive.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,button:0}));await wait(80);
    assert(f.calls.length===2 && f.calls[1].allRead,'already-confirmed read skips the read control');
  });
  await test('a read button becoming an unread toggle during mousedown is never clicked',async()=>{
    const f=fixture();let toggles=0;
    f.read.addEventListener('mousedown',()=>{f.mark([f.rows[0]]);f.read.hidden=false;f.read.setAttribute('aria-label','Mark as unread');});
    f.read.addEventListener('click',()=>toggles++);click(f.archive);await wait(80);
    assert(toggles===0 && f.calls.length===2 && f.calls[1].allRead,'no unread toggle after native state change');
  });
  await test('selection changes cancel a pending Archive',async()=>{
    const f=fixture({delay:180});click(f.archive);f.box(f.rows[0]).setAttribute('aria-checked','false');f.box(f.rows[1]).setAttribute('aria-checked','true');await wait(260);
    assert(f.calls.length===1 && f.rows.every(row=>row.isConnected),'no stale archive');
  });
  await test('mixed checkbox state cancels a pending Archive',async()=>{
    const f=fixture({delay:180});click(f.archive);f.box(f.rows[1]).setAttribute('aria-checked','mixed');await wait(260);
    assert(f.calls.length===1,'ambiguous selection never archived');
  });
  await test('thread identity recycling cancels pending Archive',async()=>{
    const f=fixture({delay:180});click(f.archive);f.rows[0].querySelector('[data-thread-id]').setAttribute('data-thread-id','#different');await wait(260);
    assert(f.calls.length===1,'new identity never archived');
  });
  await test('toolbar replacement cancels pending Archive',async()=>{
    const f=fixture({delay:180});click(f.archive);f.archive.closest('[gh="mtb"]').replaceWith(f.archive.closest('[gh="mtb"]').cloneNode(true));await wait(260);
    assert(f.calls.length===1,'replacement toolbar never invoked');
  });
  await test('account path changes cancel pending Archive',async()=>{
    const f=fixture({delay:180});const path=location.pathname;click(f.archive);history.replaceState(null,'','/tests/other-account#inbox');await wait(260);history.replaceState(null,'',path+'#inbox');
    assert(f.calls.length===1,'no cross-account action');
  });
  await test('navigation cancels pending Archive',async()=>{
    const f=fixture({delay:180});click(f.archive);history.replaceState(null,'','#sent');window.dispatchEvent(new HashChangeEvent('hashchange'));await wait(260);
    assert(f.calls.length===1,'no archive after navigation');
  });
  await test('disabling the mode cancels pending Archive',async()=>{
    const f=fixture({delay:180});click(f.archive);app.archiveRead.update({appleMailModeEnabled:false});await wait(260);
    assert(f.calls.length===1,'disabled work cancelled');
  });
  await test('intervening pointer input cancels pending Archive',async()=>{
    const f=fixture({delay:180});click(f.archive);click(f.rows[1]);await wait(260);assert(f.calls.length===1,'new user intent wins');
  });
  await test('mode off retains native Archive behavior',async()=>{
    const f=fixture({enabled:false});click(f.archive);assert(f.calls.length===1 && !f.calls[0].allRead,'native behavior retained');
  });
  await test('modified Archive gestures retain native behavior',async()=>{
    const f=fixture();click(f.archive,{shiftKey:true});assert(f.calls.length===1 && f.calls[0].kind==='archive','modified gesture stays native');
  });
  await test('Archive lookalikes in received message bodies stay native',async()=>{
    const f=fixture();const body=document.createElement('div');body.className='ii';body.innerHTML='<button aria-label="Archive">Archive</button>';f.main.append(body);
    let count=0;gesture(body.firstChild,()=>count++);click(body.firstChild);assert(count===1 && !f.calls.length,'message content never intercepted');
  });
  await test('Archive leaves the native Undo control available',async()=>{
    const f=fixture();click(f.archive);await wait(80);click(f.main.querySelector('[id="link_undo"]'));
    assert(f.rows[0].isConnected && f.rows[0].classList.contains('yO'),'Archive Undo restores Inbox while read state remains');
  });
  await test('Command Shift A uses the same read-before-archive operation',async()=>{
    if(!/mac/i.test(navigator.platform)) return;
    const f=fixture();document.body.tabIndex=-1;document.body.focus();
    for(const type of ['keydown','keypress','keyup']) document.body.dispatchEvent(new KeyboardEvent(type,{key:'A',metaKey:true,shiftKey:true,bubbles:true,cancelable:true}));
    await wait(80);assert(f.calls.length===2 && f.calls[1].allRead,'shortcut shares pipeline');
  });
  await test('keyboard activation of Archive marks read first',async()=>{
    const f=fixture();f.archive.focus();
    for(const type of ['keydown','keypress','keyup']) f.archive.dispatchEvent(new KeyboardEvent(type,{key:'Enter',bubbles:true,cancelable:true}));
    await wait(80);assert(f.calls.length===2 && f.calls[1].allRead,'accessible activation');
  });
  await test('open reading-pane conversation uses its matching native identity',async()=>{
    const f=fixture({selected:[],open:true,integrated:true});await wait(60);click(f.archive);await wait(80);
    assert(f.calls.length===2 && f.calls[1].allRead,'read controller and archive controller cooperate');
  });
  await test('unconfirmed read times out without archiving',async()=>{
    const f=fixture({ignoreRead:true});click(f.archive);await wait(5150);
    assert(f.calls.length===1 && f.rows[0].isConnected,'no unconfirmed archive or repeated reads');
    assert(document.querySelector('.gmail-pro-filing-notice')?.textContent.includes('wasn’t archived'),'actionable failure notice');
  });
  results.textContent+=`\n${passes} passed, ${failures} failed\n`;
})();
