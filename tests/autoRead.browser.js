(async () => {
  "use strict";
  const app = GmailPro, workspace = document.getElementById("workspace"), result = document.getElementById("results"), reports = [];
  const assert = (value, message) => { if (!value) throw Error(message); };
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const settle = () => wait(40);
  function fixture({ enabled = true, load = true, ignoreReads = 0, confirmDelay = 0, unreadCloseDelay = 0 } = {}) {
    workspace.innerHTML = `<div role="main"><div gh="tm"><div gh="mtb"><button aria-label="Mark as read">Read</button><button aria-label="Mark as unread">Unread</button><button role="button" aria-label="More email options">More</button></div></div><div class="Nu tf"><table role="grid"><tbody>${['one','two'].map(id => `<tr role="row" class="zA zE" data-test-id="${id}"><td><span role="checkbox" aria-checked="false" tabindex="0">Select</span></td><td role="gridcell"><div role="link"><span data-thread-id="#thread-${id}" data-legacy-thread-id="legacy-${id}">${id}</span></div></td></tr>`).join('')}</tbody></table></div><div class="Nu S3"></div></div>`;
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
  await test('marks once through Gmail only after at least 300ms of an open unread message', async () => {
    const f=fixture(), start=performance.now(); f.click(); await wait(180);
    assert(f.reads.length===0 && f.rows[0].classList.contains('zE'),'still unread before threshold');
    await wait(200); assert(f.reads.length===1 && f.reads[0].id==='one','native mark read exactly once');
    assert(f.reads[0].time-start>=300,'never earlier than 300ms');
    await wait(340); assert(f.reads.length===1,'no repeated native action');
  });
  await test('switching quickly cancels the first message and gives the second a full delay', async () => {
    const f=fixture(); f.click(); await wait(140); const start=performance.now(); f.click(1);
    await wait(190); assert(f.reads.length===0,'neither read at old deadline');
    await wait(180); assert(f.reads.length===1 && f.reads[0].id==='two' && f.reads[0].time-start>=300,'only second read');
    assert(f.rows[0].classList.contains('zE'),'first stays unread');
  });
  await test('message loading time does not count toward reading time', async () => {
    const f=fixture({load:false}); f.click(); await wait(360); assert(!f.reads.length,'no action during loading');
    const start=performance.now(); f.open(f.rows[0]); await wait(180); assert(!f.reads.length,'full dwell after load');
    await wait(190); assert(f.reads.length===1 && f.reads[0].time-start>=300,'loaded message read');
  });
  await test('nested body rendering without a chrome mutation still starts a full dwell', async () => {
    const f=fixture({load:false}); f.click(); f.open(f.rows[0]); const body=f.pane.querySelector('.a3s'); body.remove();
    await wait(360); assert(!f.reads.length,'missing body is not reading time');
    const start=performance.now(); f.pane.querySelector('.ii').append(body); await wait(180);
    assert(!f.reads.length,'late body gets its own dwell');
    await wait(280); assert(f.reads.length===1 && f.reads[0].time-start>=300,'body readiness detected without another click');
  });
  await test('an ignored native gesture is retried until Gmail confirms read', async () => {
    const f=fixture({ignoreReads:2}); f.click(); await wait(380);
    assert(f.attempts.length===1 && !f.reads.length && f.rows[0].classList.contains('zE'),'first ignored action stays pending');
    await wait(540); assert(f.reads.length===1 && f.attempts.length===3 && !f.rows[0].classList.contains('zE'),'third attempt confirms read');
    await wait(360); assert(f.attempts.length===3,'confirmation stops retries');
  });
  for (const kind of ['hidden','disabled','missing','ambiguous']) await test(kind+' read control can become ready after the deadline', async () => {
    const f=fixture(); f.click(); await wait(80); let extra;
    if (kind==='hidden') f.action.hidden=true;
    if (kind==='disabled') f.action.disabled=true;
    if (kind==='missing') f.action.remove();
    if (kind==='ambiguous') { extra=f.action.cloneNode(true); f.action.after(extra); }
    await wait(310); assert(!f.reads.length,'no unavailable or guessed control');
    if (kind==='hidden') f.action.hidden=false;
    if (kind==='disabled') f.action.disabled=false;
    if (kind==='missing') f.main.querySelector('[gh="mtb"]').prepend(f.action);
    extra?.remove();
    await wait(250); assert(f.reads.length===1,'late control is used without another opening click');
  });
  await test('delayed native read acknowledgement stops retries', async () => {
    const f=fixture({confirmDelay:120}); f.click(); await wait(390);
    assert(f.attempts.length===1 && f.rows[0].classList.contains('zE'),'waiting on native confirmation');
    await wait(330); assert(f.attempts.length===1 && !f.rows[0].classList.contains('zE'),'confirmed before another gesture');
  });
  await test('switching messages cancels a retry without reading the old target', async () => {
    const f=fixture({ignoreReads:1}); f.click(); await wait(390); const start=performance.now(); f.click(1);
    await wait(200); assert(!f.reads.length,'retry deadline cannot read the new target early');
    await wait(190); assert(f.reads.length===1 && f.reads[0].id==='two' && f.reads[0].time-start>=300,'fresh dwell on new target');
    assert(f.rows[0].classList.contains('zE'),'previous target remains unread');
  });
  for (const [name, change] of [
    ['closing the conversation', f => { f.rows[0].classList.remove('aps'); f.pane.replaceChildren(); }],
    ['switching away and back before the deadline', f => { f.rows[0].classList.remove('aps'); }],
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
    ['keyboard navigation', f => f.rows[0].dispatchEvent(new KeyboardEvent('keydown',{key:'j',bubbles:true}))],
    ['turning the mode off', () => app.readingPane.update({appleMailModeEnabled:false})],
    ['page cleanup', () => app.readingPane.stop()]
  ]) await test(name+' cancels a pending read', async () => {
    const f=fixture(); f.click(); await wait(130); change(f); await settle();
    if (name==='switching away and back before the deadline') f.rows[0].classList.add('aps');
    if (name==='bulk selection') f.rows[1].querySelector('[role="checkbox"]').setAttribute('aria-checked','false');
    await wait(240); assert(!f.reads.length,'no stale native action');
  });
  for (const [name, change] of [
    ['missing action', f=>f.action.remove()], ['disabled action', f=>f.action.disabled=true],
    ['hidden action', f=>f.action.hidden=true], ['ambiguous action', f=>f.action.after(f.action.cloneNode(true))],
    ['ambiguous toolbar', f=>f.main.querySelector('[gh="tm"]').append(f.main.querySelector('[gh="mtb"]').cloneNode(true))]
  ]) await test(name+' fails safely', async () => {
    const f=fixture(); f.click(); await wait(140); change(f); await wait(240); assert(!f.reads.length,'no guessed action');
  });
  await test('toolbar replacement resolves the current native action at activation', async () => {
    const f=fixture(); f.click(); await wait(140); let count=0;
    const replacement=f.action.cloneNode(true); replacement.addEventListener('click',()=>count++); f.action.replaceWith(replacement);
    await wait(240); assert(count===1 && !f.reads.length,'fresh control only');
  });
  await test('native toolbar requires a complete press/release gesture', async () => {
    const f=fixture(); f.open(f.rows[0]); await settle(); f.action.click();
    assert(!f.reads.length,'bare click is ignored, like Gmail');
    f.click(); await wait(380); assert(f.reads.length===1,'timer supplies one complete gesture');
  });
  await test('already-read messages and mode OFF remain untouched', async () => {
    const f=fixture({enabled:false}); f.click(); await wait(360); assert(!f.reads.length,'mode OFF');
    app.readingPane.start({appleMailModeEnabled:true}); f.rows[0].classList.replace('zE','yO'); f.click(); await wait(360); assert(!f.reads.length,'already read');
  });
  await test('checkboxes and modified selection clicks never start a read', async () => {
    const f=fixture(); f.open(f.rows[0]); await settle();
    f.rows[0].querySelector('[role="checkbox"]').click();
    for (const modifier of ['shiftKey','metaKey','ctrlKey','altKey']) f.click(0,{[modifier]:true});
    await wait(360); assert(!f.reads.length,'selection is not reading');
  });
  await test('manual unread after auto-read stays unread until another opening click', async () => {
    const f=fixture(); f.click(); await wait(380); assert(f.reads.length===1,'initial read');
    f.rows[0].classList.replace('yO','zE'); await wait(360); assert(f.reads.length===1,'manual unread respected');
    f.click(); await wait(380); assert(f.reads.length===2,'explicit reopening can read again');
  });
  for (const unreadCloseDelay of [0,120]) await test('manual unread keeps the same conversation open after '+unreadCloseDelay+'ms native deselection', async () => {
    const f=fixture({unreadCloseDelay}); f.click(); await wait(380); f.unreadAction.click(); await wait(520);
    assert(f.rows[0].classList.contains('aps') && f.rows[0].classList.contains('zE'),'same selected row is unread');
    assert(f.pane.querySelector('h2')?.getAttribute('data-thread-perm-id')==='thread-one','message remains readable');
    assert(f.reads.length===1,'restoration does not start an auto-read timer');
    f.click(1); await wait(380); const start=performance.now(); f.click(0); await wait(180);
    assert(f.rows[0].classList.contains('zE'),'return waits for a fresh dwell');
    await wait(200); assert(f.reads.length===3 && f.reads[2].time-start>=300,'return marks read after 300ms');
  });
  await test('manual unread cancels an in-flight retry and suppresses restoration reads', async () => {
    const f=fixture({ignoreReads:1}); f.click(); await wait(380); f.unreadAction.hidden=false; f.unreadAction.click(); await wait(600);
    assert(f.attempts.length===1 && f.rows[0].matches('.aps.zE'),'no retry or restoration auto-read overrides manual unread');
  });
  await test('Command Shift U toggles read/unread without losing selection or restarting auto-read', async () => {
    const f=fixture();app.keyboardShortcuts.start(app.settings.defaults);f.click();await wait(380);
    const press=()=>{for(const type of ['keydown','keypress','keyup'])document.body.dispatchEvent(new KeyboardEvent(type,{key:'U',code:'KeyU',metaKey:true,shiftKey:true,bubbles:true,cancelable:true}));};
    press();await wait(420);assert(f.rows[0].matches('.aps.zE')&&f.pane.querySelector('h2'),'shortcut unread stays open');
    assert(f.reads.length===1,'unread stays in effect beyond auto-read delay');
    press();await settle();assert(f.rows[0].matches('.aps.yO')&&f.reads.length===2,'next press marks read');
    press();await wait(420);assert(f.rows[0].matches('.aps.zE')&&f.reads.length===2,'repeated toggle stays unread');
  });
  await test('a user click cancels pending unread restoration', async () => {
    const f=fixture({unreadCloseDelay:120}); f.click(); await wait(380); f.unreadAction.click(); f.click(1); await wait(180);
    assert(!f.rows[0].classList.contains('aps') && f.rows[0].classList.contains('zE'),'old message never reopened over the new selection');
  });
  await test('manual unread with bulk selection keeps Gmail native behavior', async () => {
    const f=fixture(); f.click(); await wait(380); f.rows[1].querySelector('[role="checkbox"]').setAttribute('aria-checked','true');
    f.unreadAction.click(); await wait(380); assert(!f.rows[0].classList.contains('aps') && !f.pane.children.length,'no forced opening for bulk actions');
  });
  await test('turning mode off cancels a pending unread restoration', async () => {
    const f=fixture({unreadCloseDelay:120}); f.click(); await wait(380); f.unreadAction.click(); app.readingPane.stop(); await wait(280);
    assert(!f.rows[0].classList.contains('aps') && !f.pane.children.length,'native deselection remains after cleanup');
  });
  await test('ignored read actions expire without leaving a retry loop', async () => {
    const f=fixture({ignoreReads:Infinity}); f.click(); await wait(10400); const attempts=f.attempts.length;
    assert(attempts>1 && !f.reads.length,'bounded retries ran without faking read state');
    await wait(380); assert(f.attempts.length===attempts,'retry loop stops at its deadline');
  });
  await test('native read during the delay does not trigger another action', async () => {
    const f=fixture(); f.click(); await wait(140); f.rows[0].classList.replace('zE','yO'); await wait(240);
    assert(!f.reads.length,'Gmail already handled read state');
  });
  await test('startup with an open unread conversation does not mark it', async () => {
    const f=fixture(); f.open(f.rows[0]); await wait(380); assert(!f.reads.length,'requires opening click');
  });
  await test('repeated start and unrelated settings do not duplicate or reset the delay', async () => {
    const f=fixture(); f.click(); await wait(150); app.readingPane.start({appleMailModeEnabled:true}); app.readingPane.update({accentColor:'red'});
    await wait(230); assert(f.reads.length===1,'one read at original deadline');
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
    const f=fixture(), n=notice(); f.click(); await wait(100); f.pane.querySelector('.a3s').append(n.root);
    await wait(290); n.show(); await settle(); assert(n.closed()===0,'received HTML untouched');
  });
  result.textContent += `\n\n${reports.filter(line=>line.startsWith('PASS')).length}/${reports.length} checks passed`;
})();
