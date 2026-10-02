(async () => {
  "use strict";
  const app = GmailPro, workspace = document.getElementById("workspace"), result = document.getElementById("results"), reports = [];
  const assert = (value, message) => { if (!value) throw Error(message); };
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const settle = () => wait(40);
  function fixture({ enabled = true, load = true, ignoreReads = 0, confirmDelay = 0, unreadCloseDelay = 0 } = {}) {
    workspace.innerHTML = `<div role="main"><div gh="tm"><div gh="mtb"><button aria-label="Archive">Archive</button><button aria-label="Delete">Delete</button><button aria-label="Mark as read">Read</button><button aria-label="Mark as unread">Unread</button><button role="button" aria-label="More email options">More</button></div></div><div class="Nu tf"><table role="grid"><tbody>${['one','two'].map(id => `<tr role="row" class="zA zE" data-test-id="${id}"><td><span role="checkbox" aria-checked="false" tabindex="0">Select</span></td><td role="gridcell"><div role="link"><span data-thread-id="#thread-${id}" data-legacy-thread-id="legacy-${id}">${id}</span></div></td></tr>`).join('')}</tbody></table></div><div class="Nu S3"></div></div>`;
    const main = workspace.firstElementChild, rows = [...main.querySelectorAll('tr')], pane = main.querySelector('.S3'), action = main.querySelector('[aria-label="Mark as read"]'), unreadAction = main.querySelector('[aria-label="Mark as unread"]');
    const reads = [], attempts = [];
    function open(row) {
      rows.forEach(node => node.classList.toggle('aps', node === row));
      action.hidden = !row.classList.contains('zE');
      unreadAction.hidden = row.classList.contains('zE');
      const id = row.dataset.testId;
      pane.innerHTML = `<div class="iY"><h2 data-thread-perm-id="thread-${id}" data-legacy-thread-id="legacy-${id}">Synthetic conversation</h2><div role="list"><div role="listitem" tabindex="-1" jsaction="message:.CLIENT" aria-expanded="true"><div><div data-message-id="msg-${id}" data-legacy-message-id="legacy-msg-${id}"><div class="ii"><div class="a3s">Synthetic body</div></div></div></div></div></div></div>`;
    }
    for (const row of rows) row.addEventListener('click', event => {
      if (load && event.target.closest('[role="link"]') && !event.shiftKey && !event.metaKey && !event.ctrlKey && !event.altKey) open(row);
    });
    // Gmail toolbar controls require native pressed/released state. A bare
    // programmatic click must not make this fixture falsely pass.
    let pressed=false, released=false;
    action.addEventListener('mousedown', event => { pressed=event.button===0 && event.buttons===1; released=false; });
    action.addEventListener('mouseup', event => { released=pressed && event.buttons===0; pressed=false; });
    action.addEventListener('click', () => {
      if (!released) return;
      released=false;
      const row = rows.find(node => node.classList.contains('aps'));
      attempts.push({ id: row?.dataset.testId, time: performance.now() });
      if (attempts.length <= ignoreReads) return;
      reads.push({ id: row?.dataset.testId, time: performance.now() });
      const confirm = () => { row?.classList.replace('zE', 'yO'); action.hidden=true; unreadAction.hidden=false; };
      if (confirmDelay) setTimeout(confirm, confirmDelay); else confirm();
    });
    unreadAction.addEventListener('click', () => {
      const row = rows.find(node => node.classList.contains('aps'));
      row?.classList.replace('yO', 'zE');
      action.hidden=false; unreadAction.hidden=true;
      const close = () => { row?.classList.remove('aps'); pane.replaceChildren(); };
      if (unreadCloseDelay) setTimeout(close, unreadCloseDelay); else close();
    });
    main.addEventListener('keydown', event => {
      if (!['ArrowDown','ArrowUp'].includes(event.key) || event.shiftKey || event.metaKey || event.ctrlKey || event.altKey) return;
      const current = rows.findIndex(row => row.classList.contains('aps'));
      const next = rows[current + (event.key === 'ArrowDown' ? 1 : -1)];
      if (next?.isConnected) open(next);
    });
    for (const name of ['Archive','Delete']) main.querySelector(`[aria-label="${name}"]`).addEventListener('click', () => {
      const current = rows.findIndex(row => row.classList.contains('aps'));
      rows[current]?.remove();
      const next = rows[current + 1];
      if (next?.isConnected) open(next); else pane.replaceChildren();
    });
    app.readingPane.start({ appleMailModeEnabled: enabled });
    const click = (index = 0, options = {}) => rows[index].querySelector('[role="link"]').dispatchEvent(new MouseEvent('click', { bubbles:true, button:0, ...options }));
    return { main, rows, pane, action, unreadAction, reads, attempts, open, click };
  }
  async function test(name, run) {
    try { await run(); reports.push(`PASS ${name}`); }
    catch (error) { reports.push(`FAIL ${name}: ${error.message}`); }
    app.keyboardShortcuts.stop(); app.readingPane.stop(); app.reverseThreads.stop(); workspace.replaceChildren(); await settle();
    result.textContent = reports.join('\n');
  }
  function notice() {
    const root=document.createElement('div'); root.className='b8 UC'; root.setAttribute('role','alert');
    root.innerHTML='<div class="J-J5-Ji"><div class="vh"></div></div>'; workspace.append(root);
    let closed=0, undone=0;
    function show(text='Conversation marked as read.', {sdk=false, close=true}={}) {
      const box=root.firstElementChild;
      box.innerHTML=`<div class="vh${sdk ? ' inboxsdk__butterbar' : ''}"><span class="aT"><span class="bAq"></span><span class="bAo"><span id="link_undo" role="link" tabindex="0" aria-label="Undo link">Undo</span></span></span>${close ? '<div class="bBe" role="button" tabindex="0" aria-label="Close">Close</div>' : ''}</div>`;
      box.querySelector('.bAq').textContent=text;
      box.querySelector('[role="link"]').addEventListener('click',()=>undone++);
      const control=box.querySelector('.bBe'); let pressed=false, released=false;
      control?.addEventListener('mousedown',()=>{pressed=true;});
      control?.addEventListener('mouseup',()=>{released=pressed;pressed=false;});
      control?.addEventListener('click',()=>{if(released){closed++;box.innerHTML='<div class="vh"></div>';}});
    }
    return {root,show,closed:()=>closed,undone:()=>undone};
  }
  await test('click marks the displayed unread conversation immediately and exactly once', async () => {
    const f=fixture(), start=performance.now(); f.click(); await settle();
    assert(f.reads.length===1 && f.reads[0].id==='one','native mark read without a dwell');
    assert(f.reads[0].time-start<250,'read starts before the old 300ms delay');
    await wait(340); assert(f.attempts.length===1,'no repeated native action');
  });
  await test('two synchronous opening clicks read only the final displayed conversation', async () => {
    const f=fixture(); f.click(); f.click(1); await settle();
    assert(f.reads.length===1 && f.reads[0].id==='two' && f.rows[0].classList.contains('zE'),'no stale target');
  });
  for (const key of ['ArrowDown','ArrowUp']) await test(key+' marks the next displayed conversation immediately', async () => {
    const f=fixture(), first=key==='ArrowDown'?0:1, next=1-first;
    f.click(first); await settle(); const start=performance.now();
    f.rows[first].dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true})); await settle();
    assert(f.reads.length===2 && f.reads[1].id===f.rows[next].dataset.testId && f.reads[1].time-start<250,'arrow opening read immediately');
  });
  for (const action of ['Archive','Delete']) for (const keyboard of [false,true]) await test(action+' via '+(keyboard?'shortcut':'toolbar')+' marks its next conversation immediately', async () => {
    const f=fixture(); app.keyboardShortcuts.start(app.settings.defaults); f.click(); await settle(); const start=performance.now();
    if (keyboard) for (const type of ['keydown','keypress','keyup']) document.body.dispatchEvent(new KeyboardEvent(type,
      {key:action==='Archive'?'A':'Backspace',metaKey:action==='Archive',shiftKey:action==='Archive',bubbles:true,cancelable:true}));
    else f.main.querySelector(`[aria-label="${action}"]`).click();
    await settle();
    assert(!f.rows[0].isConnected && f.rows[1].matches('.aps.yO'),'Gmail advances and confirms read');
    assert(f.reads.length===2 && f.reads[1].id==='two' && f.reads[1].time-start<250,'automatic successor read');
  });
  await test('a reused pane and heading follow native selection without a click or keyboard hook', async () => {
    const f=fixture(); f.click(); await settle();
    f.rows[0].classList.remove('aps'); f.rows[1].classList.add('aps');
    f.action.hidden=false; f.unreadAction.hidden=true;
    const heading=f.pane.querySelector('h2'); heading.setAttribute('data-thread-perm-id','thread-two'); heading.setAttribute('data-legacy-thread-id','legacy-two');
    await settle(); assert(f.reads.length===2 && f.reads[1].id==='two','reused native pane read');
  });
  await test('slow loading reads immediately once the matching body becomes visible', async () => {
    const f=fixture({load:false}); f.click(); await wait(360); assert(!f.reads.length,'no read during loading');
    const start=performance.now(); f.open(f.rows[0]); await settle();
    assert(f.reads.length===1 && f.reads[0].time-start<250,'no delay after loading');
  });
  await test('clicking a slow successor never retries against the previously displayed conversation', async () => {
    const f=fixture({load:false,ignoreReads:Infinity}); f.open(f.rows[0]); await settle(); const attempts=f.attempts.length;
    f.click(1); await wait(320); assert(f.attempts.length===attempts,'old displayed target is not restarted');
    f.open(f.rows[1]); await settle(); assert(f.attempts.length===attempts+1 && f.attempts.at(-1).id==='two','new target attempted on readiness');
  });
  await test('nested body rendering is detected without another opening gesture', async () => {
    const f=fixture({load:false}); f.click(); f.open(f.rows[0]); const body=f.pane.querySelector('.a3s'); body.remove();
    await wait(360); assert(!f.reads.length,'missing body cannot read');
    const start=performance.now(); f.pane.querySelector('.ii').append(body); await wait(140);
    assert(f.reads.length===1 && f.reads[0].time-start<250,'bounded readiness check reads without dwell');
  });
  await test('an ignored native gesture is retried until Gmail confirms read', async () => {
    const f=fixture({ignoreReads:2}); f.click(); await settle();
    assert(f.attempts.length===1 && !f.reads.length && f.rows[0].classList.contains('zE'),'first ignored action stays pending');
    await wait(540); assert(f.reads.length===1 && f.attempts.length===3 && !f.rows[0].classList.contains('zE'),'third attempt confirms read');
    await wait(300); assert(f.attempts.length===3,'confirmation stops retries');
  });
  for (const kind of ['hidden','disabled','missing','ambiguous']) await test(kind+' read control can become ready after opening', async () => {
    const f=fixture({load:false}); let extra;
    if (kind==='disabled') f.action.disabled=true;
    if (kind==='missing') f.action.remove();
    if (kind==='ambiguous') { extra=f.action.cloneNode(true); f.action.after(extra); }
    f.click(); f.open(f.rows[0]); if (kind==='hidden') f.action.hidden=true;
    await wait(310); assert(!f.reads.length,'no unavailable or guessed control');
    if (kind==='hidden') f.action.hidden=false;
    if (kind==='disabled') f.action.disabled=false;
    if (kind==='missing') f.main.querySelector('[gh="mtb"]').prepend(f.action);
    extra?.remove(); await wait(280); assert(f.reads.length===1,'late control used without another opening');
  });
  await test('delayed native read acknowledgement stops retries', async () => {
    const f=fixture({confirmDelay:120}); f.click(); await settle();
    assert(f.attempts.length===1 && f.rows[0].classList.contains('zE'),'waiting on confirmation');
    await wait(290); assert(f.attempts.length===1 && !f.rows[0].classList.contains('zE'),'confirmation stops retries');
  });
  await test('switching during a retry immediately reads only the new displayed target', async () => {
    const f=fixture({ignoreReads:1}); f.click(); await settle(); f.click(1); await settle();
    assert(f.reads.length===1 && f.reads[0].id==='two' && f.rows[0].classList.contains('zE'),'new target read immediately');
    await wait(290); assert(f.attempts.length===2,'old retry cancelled');
  });
  for (const [name, change] of [
    ['closing the conversation', f => { f.rows[0].classList.remove('aps'); f.pane.replaceChildren(); }],
    ['removing the row', f => f.rows[0].remove()],
    ['moving the row outside its grid', f => f.main.append(f.rows[0])],
    ['removing the identity', f => f.rows[0].querySelector('[data-thread-id]').remove()],
    ['recycling a row identity', f => f.rows[0].querySelector('[data-thread-id]').setAttribute('data-thread-id','#thread-recycled')],
    ['changing the legacy identity', f => f.rows[0].querySelector('[data-thread-id]').setAttribute('data-legacy-thread-id','different')],
    ['changing the open conversation', f => f.pane.querySelector('h2').setAttribute('data-thread-perm-id','thread-other')],
    ['bulk selection', f => f.rows[1].querySelector('[role="checkbox"]').setAttribute('aria-checked','true')],
    ['hidden conversation', f => f.pane.hidden=true],
    ['navigation', () => window.dispatchEvent(new HashChangeEvent('hashchange'))],
    ['history navigation', () => window.dispatchEvent(new PopStateEvent('popstate'))],
    ['tab visibility change', () => document.dispatchEvent(new Event('visibilitychange'))],
    ['window blur', () => window.dispatchEvent(new Event('blur'))],
    ['keyboard input without an opening', f => f.rows[0].dispatchEvent(new KeyboardEvent('keydown',{key:'j',bubbles:true}))],
    ['turning the mode off', () => app.readingPane.update({appleMailModeEnabled:false})],
    ['page cleanup', () => app.readingPane.stop()]
  ]) await test(name+' cancels a pending retry', async () => {
    const f=fixture({ignoreReads:Infinity}); f.click(); await settle(); const attempts=f.attempts.length;
    change(f); await wait(320); assert(f.attempts.length===attempts && !f.reads.length,'no stale native action');
  });
  await test('clearing bulk selection does not restart the cancelled visit', async () => {
    const f=fixture({ignoreReads:Infinity}); f.click(); await settle(); const attempts=f.attempts.length;
    const box=f.rows[1].querySelector('[role="checkbox"]'); box.setAttribute('aria-checked','true'); await settle();
    box.setAttribute('aria-checked','false'); await wait(320); assert(f.attempts.length===attempts,'requires another opening');
  });
  await test('toolbar replacement resolves the current native action at activation', async () => {
    const f=fixture({load:false}); f.click(); let count=0;
    const replacement=f.action.cloneNode(true); replacement.addEventListener('click',()=>count++); f.action.replaceWith(replacement);
    f.open(f.rows[0]); await settle(); assert(count===1 && !f.reads.length,'fresh control only');
  });
  await test('a conversation switch during mousedown cancels the remaining native read phases', async () => {
    const f=fixture(); f.action.addEventListener('mousedown',()=>f.open(f.rows[1]),{once:true}); f.click(); await settle();
    assert(f.reads.length===1 && f.reads[0].id==='two' && f.rows[0].classList.contains('zE'),'no stale click after synchronous navigation');
  });
  await test('native toolbar requires a complete press/release gesture', async () => {
    const f=fixture({enabled:false}); f.open(f.rows[0]); f.action.click(); assert(!f.reads.length,'bare click ignored');
    app.readingPane.start({appleMailModeEnabled:true}); f.click(); await settle(); assert(f.reads.length===1,'complete native gesture');
  });
  await test('already-read messages and mode OFF remain untouched', async () => {
    const f=fixture({enabled:false}); f.click(); await settle(); assert(!f.reads.length,'mode OFF');
    f.rows[0].classList.replace('zE','yO'); app.readingPane.start({appleMailModeEnabled:true}); f.click(); await settle(); assert(!f.reads.length,'already read');
  });
  await test('checkboxes and modified selection clicks never start a read', async () => {
    const f=fixture({enabled:false}); f.open(f.rows[0]); app.readingPane.start({appleMailModeEnabled:true});
    f.rows[0].querySelector('[role="checkbox"]').click();
    for (const modifier of ['shiftKey','metaKey','ctrlKey','altKey']) f.click(0,{[modifier]:true});
    await wait(320); assert(!f.reads.length,'selection is not opening');
  });
  await test('manual unread stays unread until another opening click', async () => {
    const f=fixture(); f.click(); await settle(); f.rows[0].classList.replace('yO','zE'); await wait(320);
    assert(f.reads.length===1,'manual unread respected'); f.click(); await settle(); assert(f.reads.length===2,'explicit reopening reads immediately');
  });
  for (const unreadCloseDelay of [0,120]) await test('manual unread keeps the same conversation open after '+unreadCloseDelay+'ms native deselection', async () => {
    const f=fixture({unreadCloseDelay}); f.click(); await settle(); f.unreadAction.click(); await wait(520);
    assert(f.rows[0].matches('.aps.zE') && f.pane.querySelector('h2')?.getAttribute('data-thread-perm-id')==='thread-one','same conversation remains readable and unread');
    assert(f.reads.length===1,'restoration cannot auto-read'); f.click(1); await settle(); f.click(0); await settle();
    assert(f.reads.length===3 && f.rows[0].matches('.aps.yO'),'return reads immediately');
  });
  await test('manual unread cancels an in-flight retry and suppresses restoration reads', async () => {
    const f=fixture({ignoreReads:1}); f.click(); await settle(); f.unreadAction.hidden=false; f.unreadAction.click(); await wait(520);
    assert(f.attempts.length===1 && f.rows[0].matches('.aps.zE'),'manual unread wins');
  });
  await test('Command Shift U toggles read/unread without losing selection or restarting auto-read', async () => {
    const f=fixture(); app.keyboardShortcuts.start(app.settings.defaults); f.click(); await settle();
    const press=()=>{for(const type of ['keydown','keypress','keyup'])document.body.dispatchEvent(new KeyboardEvent(type,{key:'U',code:'KeyU',metaKey:true,shiftKey:true,bubbles:true,cancelable:true}));};
    press(); await wait(420); assert(f.rows[0].matches('.aps.zE') && f.pane.querySelector('h2') && f.reads.length===1,'shortcut unread stays open');
    press(); await settle(); assert(f.rows[0].matches('.aps.yO') && f.reads.length===2,'next press marks read');
    press(); await wait(420); assert(f.rows[0].matches('.aps.zE') && f.reads.length===2,'repeated unread stays in effect');
  });
  await test('arrow navigation away and back reads a manually unread conversation', async () => {
    const f=fixture(); f.click(); await settle(); f.unreadAction.click(); await wait(160);
    f.rows[0].dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true})); await settle();
    f.rows[1].dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowUp',bubbles:true})); await settle();
    assert(f.reads.length===3 && f.rows[0].matches('.aps.yO'),'fresh visit reads after explicit unread');
  });
  await test('a user opening cancels pending unread restoration', async () => {
    const f=fixture({unreadCloseDelay:120}); f.click(); await settle(); f.unreadAction.click(); f.click(1); await wait(180);
    assert(!f.rows[0].classList.contains('aps') && f.rows[0].classList.contains('zE') && f.rows[1].matches('.aps.yO'),'old message never reopens over the successor');
  });
  await test('manual unread with bulk selection keeps Gmail native behavior', async () => {
    const f=fixture(); f.click(); await settle(); f.rows[1].querySelector('[role="checkbox"]').setAttribute('aria-checked','true');
    f.unreadAction.click(); await wait(320); assert(!f.rows[0].classList.contains('aps') && !f.pane.children.length,'no forced bulk opening');
  });
  await test('turning mode off cancels pending unread restoration', async () => {
    const f=fixture({unreadCloseDelay:120}); f.click(); await settle(); f.unreadAction.click(); app.readingPane.stop(); await wait(280);
    assert(!f.rows[0].classList.contains('aps') && !f.pane.children.length,'native deselection after cleanup');
  });
  await test('ignored read actions expire and unrelated chrome cannot restart the visit', async () => {
    const f=fixture({ignoreReads:Infinity}); f.click(); await wait(10400); const attempts=f.attempts.length;
    assert(attempts>1 && !f.reads.length,'bounded retries without faking read');
    f.main.querySelector('[gh="mtb"]').append(document.createElement('span')); await wait(380);
    assert(f.attempts.length===attempts,'expired visit never restarts');
  });
  await test('native read before discovery does not trigger another action', async () => {
    const f=fixture(); f.click(); f.rows[0].classList.replace('zE','yO'); await settle(); assert(!f.reads.length,'Gmail already read it');
  });
  await test('startup with an already-open unread conversation does not change its status', async () => {
    const f=fixture({enabled:false}); f.open(f.rows[0]); app.readingPane.start({appleMailModeEnabled:true}); await settle(); assert(!f.reads.length,'startup respects existing status');
    f.click(1); await settle(); assert(f.reads.length===1 && f.reads[0].id==='two','subsequent opening reads');
  });
  await test('repeated start and unrelated settings do not duplicate reads', async () => {
    const f=fixture(); f.click(); app.readingPane.start({appleMailModeEnabled:true}); app.readingPane.update({accentColor:'red'});
    await settle(); assert(f.reads.length===1,'one native read');
  });
  for (const kind of ['route','account']) await test(kind+' changes cannot restart a read against retained old DOM', async () => {
    const f=fixture({ignoreReads:Infinity}); f.click(); await settle(); const attempts=f.attempts.length, original=location.href;
    try {
      history.replaceState(null,'',kind==='route'?'#another-mailbox':'/tests/autoRead.html/account');
      window.dispatchEvent(new PopStateEvent('popstate')); await wait(320);
      assert(f.attempts.length===attempts,'old conversation is not reopened on URL change');
    } finally { history.replaceState(null,'',original); }
  });
  await test('replacing a manually unread row does not start a new reading visit', async () => {
    const f=fixture(); f.click(); await settle(); f.rows[0].classList.replace('yO','zE');
    const replacement=f.rows[0].cloneNode(true); f.rows[0].replaceWith(replacement); f.rows[0]=replacement;
    f.action.hidden=false; f.unreadAction.hidden=true; await wait(320);
    assert(f.reads.length===1 && replacement.matches('.aps.zE'),'same conversation stays deliberately unread');
  });
  await test('a pending read follows a replacement row with the same two native identities', async () => {
    const f=fixture({ignoreReads:1}); f.click(); await settle();
    const replacement=f.rows[0].cloneNode(true); f.rows[0].replaceWith(replacement); f.rows[0]=replacement;
    await wait(280); assert(f.reads.length===1 && replacement.matches('.aps.yO'),'retry confirms current native row');
  });
  await test('ambiguous toolbars never receive a guessed read action', async () => {
    const f=fixture({load:false}); f.click(); f.open(f.rows[0]);
    f.main.querySelector('[gh="tm"]').append(f.main.querySelector('[gh="mtb"]').cloneNode(true));
    await wait(320); assert(!f.attempts.length,'no action when multiple native toolbars are visible');
  });
  await test('hover and keyboard-focus classes do not rescan reading chrome', async () => {
    const f=fixture(); f.click(); await settle(); let calls=0; const discovery=app.reverseThreads;
    app.reverseThreads={...discovery,currentConversation:()=>{calls++;return discovery.currentConversation();}};
    try {
      f.rows[0].classList.add('hover','btb'); f.rows[1].classList.add('hover'); await settle();
      assert(calls===0 && f.reads.length===1,'presentation-only changes are inert');
    } finally { app.reverseThreads=discovery; }
  });
  await test('automatic read quietly dismisses its exact native confirmation', async () => {
    const f=fixture(), n=notice(); f.action.addEventListener('click',()=>n.show());
    f.click(); await wait(390);
    assert(f.reads.length===1 && n.closed()===1 && !n.root.textContent,'read succeeds and notification closes');
    assert(!n.root.hasAttribute('style') && !n.root.hasAttribute('hidden'),'native alert container is not hidden or restyled');
  });
  await test('delayed acknowledgement is dismissed when Gmail renders it', async () => {
    const f=fixture(), n=notice(); f.click(); await wait(390); n.show(); await settle();
    assert(n.closed()===1,'asynchronous confirmation closes');
  });
  await test('archive, delete, unread and error notifications retain their Undo controls', async () => {
    const f=fixture(), n=notice(); f.click(); await wait(390);
    for (const text of ['Conversation archived.','Conversation moved to Trash.','Conversation marked as unread.','Unable to mark conversation as read.','Conversation marked as read. Please retry.']) {
      n.show(text); await settle();
      assert(n.closed()===0 && n.root.textContent.includes(text),'unrelated notification retained');
      n.root.querySelector('[role="link"]').click();
    }
    assert(n.undone()===5,'all native Undo handlers remain usable');
  });
  await test('a reused alert displays the next archive notification normally', async () => {
    const f=fixture(), n=notice(); f.action.addEventListener('click',()=>n.show()); f.click(); await wait(390);
    n.show('Conversation archived.'); await settle(); n.root.querySelector('[role="link"]').click();
    assert(n.closed()===1 && n.undone()===1 && n.root.textContent.includes('archived'),'no lingering suppression');
  });
  await test('third-party notices are never dismissed even with identical text', async () => {
    const f=fixture(), n=notice(); f.click(); await wait(390); n.show(undefined,{sdk:true}); await settle();
    assert(n.closed()===0 && n.root.textContent,'third-party notice retained');
    n.show(); await settle(); assert(n.closed()===1,'native acknowledgement still handled');
  });
  await test('staged Close control is awaited without hiding unknown notification markup', async () => {
    const f=fixture(), n=notice(); f.click(); await wait(390); n.show(undefined,{close:false}); await settle();
    assert(n.closed()===0 && n.root.textContent,'no guessed control or CSS hiding');
    n.show(); await settle(); assert(n.closed()===1,'native close available later');
  });
  await test('manual read notifications without an automatic action stay native', async () => {
    fixture(); const n=notice(); n.show(); await settle(); assert(n.closed()===0,'no idle notification observer');
  });
  await test('mode OFF releases the pending notification observer', async () => {
    const f=fixture(), n=notice(); f.click(); await wait(390); app.readingPane.stop(); n.show(); await settle();
    assert(n.closed()===0,'late notice remains native after cleanup');
  });
  await test('notification wait expires and a later automatic read can start a fresh wait', async () => {
    const f=fixture(), n=notice(); f.click(); await wait(5500); n.show(); await settle();
    assert(n.closed()===0,'observer expires without a matching acknowledgement');
    f.action.addEventListener('click',()=>n.show()); f.click(1); await wait(390);
    assert(n.closed()===1 && f.reads.length===2,'next read gets an independent acknowledgement');
  });
  await test('message HTML cannot imitate the native confirmation area', async () => {
    const f=fixture(), n=notice(); f.click(); f.pane.querySelector('.a3s').append(n.root);
    await wait(290); n.show(); await settle(); assert(n.closed()===0,'received HTML untouched');
  });
  result.textContent += `\n\n${reports.filter(line=>line.startsWith('PASS')).length}/${reports.length} checks passed`;
  result.dataset.failures=String(reports.filter(line=>line.startsWith('FAIL')).length);
})();
