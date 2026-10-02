(async () => {
  "use strict";
  const app = GmailPro, workspace = document.getElementById("workspace"), results = document.getElementById("results"), reports = [];
  const assert = (condition, message) => { if (!condition) throw Error(message); };
  const nativeTimeout = window.setTimeout;
  const wait = ms => new Promise(resolve => nativeTimeout(resolve, ms));
  let expiry = 10000, cleanup = () => {};
  let runtimeErrors = [];
  // Abort a runaway microtask chain in the fixture so a regression cannot
  // freeze Chrome itself. A healthy refresh settles before the next task.
  const nativeMicrotask = window.queueMicrotask;
  let refreshes = 0, refreshReset;
  window.queueMicrotask = callback => {
    if (!refreshReset) refreshReset = nativeTimeout(() => { refreshes = 0; refreshReset = undefined; }, 0);
    const runaway = ++refreshes > 200;
    nativeMicrotask(() => {
      if (runaway) { runtimeErrors.push('Reading-pane refresh starved the browser event loop'); app.readingPane.stop(); }
      callback();
    });
  };
  window.addEventListener('error', event => runtimeErrors.push(event.message));
  window.addEventListener('unhandledrejection', event => runtimeErrors.push(String(event.reason)));
  // Contract expiry only in failure fixtures; the production controller still
  // requests its real ten-second deadline. Other suites verify the shared timer.
  window.setTimeout = (fn, ms, ...args) => nativeTimeout(fn,
    ms === 10000 && /content\/readingPane\.js/.test(new Error().stack) ? expiry : ms, ...args);

  function fixture({ unread = true, labels = ["Projects/Example"], ignoreReads = 0, confirmDelay = 0,
      ignoreArchive = false, archiveDelay = 0, replaceRow = false, route = "#inbox", enabled = true,
      sidebar = true, timeout = 10000, withActions = false, archiveNoticeDelay = 0, omitArchiveNotice = false, theme = "light", withDraft = false, omitUndoLink = false } = {}) {
    expiry = timeout;
    history.replaceState(null, "", route);
    workspace.replaceChildren();
    const navigation = document.createElement("div"); navigation.setAttribute("role", "navigation");
    navigation.innerHTML = '<div gh="cl"><div class="TK"></div></div>'; workspace.append(navigation);
    function addLabel(name) {
      const owner = document.createElement("div"); owner.className = "aim";
      const line = document.createElement("div"); line.className = "TN"; line.style.marginLeft = "0px";
      const link = document.createElement("a"); link.href = "#label/" + encodeURIComponent(name); link.textContent = name;
      const menu = document.createElement("span"); menu.setAttribute("data-label-name", name); menu.setAttribute("aria-haspopup", "true");
      line.append(link, menu); owner.append(line); navigation.querySelector('.TK').append(owner); return { owner, link, menu };
    }
    const labelOwners = sidebar ? labels.map(addLabel) : [];
    const main = document.createElement("div"); main.setAttribute("role", "main");
    main.innerHTML = '<div gh="tm"><div gh="mtb"><button aria-label="Archive">Archive</button><button aria-label="Mark as read">Read</button><button aria-label="Mark as unread">Unread</button><div role="button" aria-label="More email options">More</div></div></div><div class="Nu tf"></div><div class="Nu S3"></div>';
    workspace.append(main);
    const draft = withDraft ? document.createElement('div') : null;
    if (draft) {
      draft.setAttribute('role', 'dialog'); draft.setAttribute('aria-label', 'Synthetic draft');
      draft.innerHTML = '<form><input name="composeid" type="hidden" value="synthetic-draft"><input name="subjectbox" aria-label="Draft subject" value="Unsent synthetic subject"><div contenteditable="true" role="textbox" aria-label="Draft body">Unsent synthetic body</div></form>';
      workspace.append(draft);
    }
    const first = GmailProTestRow({ unread, label: labels[0], threadId: "#thread-one", legacyThreadId: "legacy-one" });
    const grid = first.closest('table'); main.querySelector('.Nu.tf').append(grid);
    const second = GmailProTestRow({ unread:true, label:labels[0], threadId:"#thread-two", legacyThreadId:"legacy-two" });
    const secondTable = second.closest('table'); grid.tBodies[0].append(second); secondTable.remove();
    for (const name of labels.slice(1)) {
      const badge = first.querySelector('.at').cloneNode(true); badge.title = name; badge.querySelector('.av').textContent = name; first.querySelector('.yi > .ar').append(badge);
    }
    const read = main.querySelector('[aria-label="Mark as read"]'), unreadControl = main.querySelector('[aria-label="Mark as unread"]'), archive = main.querySelector('[aria-label="Archive"]');
    const pane = main.querySelector('.S3'), actions = [], timers = [];
    let openCount = 0, fallbackCount = 0, readAttempts = 0, archiveAttempts = 0, closed = 0, archiveClosed = 0, latestUndo;
    const box = row => row.querySelector('[role="checkbox"]');
    const rows = () => [...grid.querySelectorAll('tr')];
    const id = row => row?.querySelector('[data-thread-id]')?.getAttribute('data-thread-id');
    const current = () => rows().find(row => box(row).getAttribute('aria-checked') === 'true') || rows().find(row => row.classList.contains('aps'));
    const toast = document.createElement('div'); toast.className = 'b8'; toast.setAttribute('role','alert'); toast.innerHTML = '<div class="J-J5-Ji"><div class="vh"></div></div>'; workspace.append(toast);
    const later = (fn, ms) => { timers.push(nativeTimeout(fn, ms)); };
    function toolbar() { const row = current(); read.hidden = !row?.classList.contains('zE'); unreadControl.hidden = !row || row.classList.contains('zE'); archive.hidden = !row; }
    function gesture(control, action) {
      let pressed = false, released = false;
      control.addEventListener('mousedown', event => { pressed = event.button === 0 && event.buttons === 1; released = false; });
      control.addEventListener('mouseup', event => { released = pressed && event.buttons === 0; pressed = false; });
      control.addEventListener('click', () => { if (released) { released = false; action(); } });
    }
    function notice(message, undo) {
      toast.firstElementChild.innerHTML = '<div class="vh"><span class="aT"><span class="bAq"></span><span class="bAo"><span id="link_undo" role="link" aria-label="Undo link" tabindex="0">Undo</span></span></span><div class="bBe" role="button" aria-label="Close">Close</div></div>';
      toast.querySelector('.bAq').textContent = message;
      latestUndo = undo;
      const control=toast.querySelector('[id="link_undo"]');
      if (omitUndoLink) control.remove(); else control.addEventListener('click', () => undo?.());
      gesture(toast.querySelector('.bBe'), () => { closed++; if(message==='Conversation archived.') archiveClosed++; toast.firstElementChild.innerHTML = '<div class="vh"></div>'; });
    }
    function open(row) {
      rows().forEach(node => node.classList.toggle('aps', node === row)); openCount++;
      const suffix = id(row).slice(1);
      pane.innerHTML = `<div class="iY"><h2 data-thread-perm-id="${suffix}" data-legacy-thread-id="${row.querySelector('[data-legacy-thread-id]').getAttribute('data-legacy-thread-id')}">Synthetic conversation</h2><div role="list"><div role="listitem" tabindex="-1" jsaction="message:.CLIENT" aria-expanded="true"><div><div data-message-id="synthetic-message" data-legacy-message-id="synthetic-legacy"><div class="ii"><div class="a3s">Synthetic body</div></div></div></div></div></div></div>`;
      if (withActions) {
        const footer = document.createElement('div'); footer.className = 'btDi4d';
        footer.innerHTML = '<div class="amr"><div class="nr"><div class="amn"><span class="ams bkI" role="link">Reply all</span><span class="ams bkH" role="link">Reply</span><span class="ams bkG" role="link">Forward</span><button aria-label="Add reaction">Reaction</button></div></div></div>';
        pane.querySelector('.iY').append(footer);
      }
      toolbar();
    }
    grid.addEventListener('click', event => {
      const row = event.target.closest('tr'); if (!row) return;
      if (event.target.closest('[role="checkbox"]')) { box(row).setAttribute('aria-checked', box(row).getAttribute('aria-checked') === 'true' ? 'false' : 'true'); toolbar(); }
      else if (event.target.closest('.at')) fallbackCount++;
      else if (event.target.closest('[role="link"]')) open(row);
    });
    gesture(read, () => {
      const row = current(); readAttempts++; actions.push({ action:'read', id:id(row), time:performance.now() });
      if (readAttempts <= ignoreReads) return;
      const confirm = () => {
        if (!row?.isConnected) return;
        row.classList.replace('zE','yO');
        if (replaceRow) row.replaceWith(row.cloneNode(true));
        toolbar(); notice('Conversation marked as read.');
      };
      if (confirmDelay) later(confirm, confirmDelay); else confirm();
    });
    gesture(archive, () => {
      const row = current(); archiveAttempts++; actions.push({ action:'archive', id:id(row), read:row?.classList.contains('yO') });
      if (ignoreArchive) return;
      const complete = () => {
        row?.remove(); toolbar();
        const acknowledge = () => notice('Conversation archived.', () => { grid.tBodies[0].append(row); toolbar(); });
        if (!omitArchiveNotice) { if (archiveNoticeDelay) later(acknowledge, archiveNoticeDelay); else acknowledge(); }
      };
      if (archiveDelay) later(complete, archiveDelay); else complete();
    });
    // Model Gmail's own Undo state independently of its ephemeral toast.
    const nativeUndo = event => {
      if (event.key !== 'z' || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.target.closest(app.selectors.shortcutArchiveExcluded) || !latestUndo) return;
      const restore=latestUndo; latestUndo=undefined; restore(); toast.firstElementChild.innerHTML='<div class="vh"></div>';
    };
    document.addEventListener('keypress', nativeUndo);
    toolbar();
    app.keyboardShortcuts.start(app.settings.defaults);
    app.appearance.start({appleMailModeEnabled:enabled,appearanceTheme:theme});
    app.messageList.start({appleMailModeEnabled:enabled});
    app.readingPane.start({appleMailModeEnabled:enabled});
    const badge = (index=0) => rows()[index]?.querySelector('.at');
    function click(index=0, options={}) {
      const target = badge(index)?.querySelector('.av');
      for (const type of ['pointerdown','mousedown','mouseup','click']) target?.dispatchEvent(new MouseEvent(type,{bubbles:true,cancelable:true,button:0,detail:1,...options}));
    }
    cleanup = () => { document.removeEventListener('keypress', nativeUndo); timers.forEach(clearTimeout); app.keyboardShortcuts.stop(); app.readingPane.stop(); app.messageList.stop(); app.appearance.stop(); app.reverseThreads.stop(); workspace.replaceChildren(); };
    return { main, navigation, labelOwners, addLabel, grid, first, second, box, rows, id, badge, click, read, unreadControl, archive, pane, actions, draft,
      open, toolbar, toast, notice, later, openCount:()=>openCount, fallbackCount:()=>fallbackCount, reads:()=>readAttempts, archives:()=>archiveAttempts, closed:()=>closed, archiveClosed:()=>archiveClosed };
  }
  async function test(name, run) {
    runtimeErrors = [];
    try { await run(); assert(!runtimeErrors.length, 'no asynchronous errors: '+runtimeErrors.join('; ')); reports.push('PASS '+name); }
    catch (error) { reports.push('FAIL '+name+': '+error.message); }
    cleanup(); await wait(30); results.textContent = reports.join('\n');
  }
  const noticeText = () => document.querySelector('.gmail-pro-filing-notice')?.textContent || '';
  const successToast = () => document.querySelector('.gmail-pro-filing-notice[data-gp-filing-success]');
  function undoChord() {
    let down;
    for (const type of ['keydown','keypress','keyup']) {
      const event = new KeyboardEvent(type, { key:'z', code:'KeyZ', metaKey:false, bubbles:true, cancelable:true });
      document.activeElement.dispatchEvent(event);
      if (type === 'keydown') down = event;
    }
    return down;
  }

  for (const withDraft of [false,true]) await test('plain Z restores a label-click move'+(withDraft?' with a background draft':''), async () => {
    const f=fixture({withDraft,route:withDraft?'#inbox?compose=synthetic-draft':'#inbox'});
    const labels=f.first.querySelector('.yi > .ar').innerHTML, draftContents=f.draft?.innerHTML;
    f.click(); await wait(100);
    assert(!f.first.isConnected&&successToast(),'move confirmed before Undo');
    assert(undoChord().defaultPrevented,'mailbox shortcut handles Undo'); await wait(80);
    assert(f.first.isConnected&&f.first.classList.contains('yO'),'native Undo returns the conversation to Inbox');
    assert(f.first.querySelector('.yi > .ar').innerHTML===labels,'existing labels preserved');
    assert(!successToast(),'restored conversation has no stale move confirmation');
    assert(f.archives()===1&&!f.openCount()&&!f.fallbackCount(),'Undo never files again or opens a conversation');
    if (withDraft) assert(f.draft.isConnected&&f.draft.innerHTML===draftContents,'background draft stays untouched');
  });
  await test('plain Z restores an Inbox-to-Mgr move without any native Undo link', async () => {
    const f=fixture({unread:false,labels:['Mgr'],withDraft:true,omitUndoLink:true,route:'#inbox?compose=synthetic-draft'});
    const contents=f.draft.innerHTML;f.click();await wait(100);
    assert(!f.first.isConnected&&successToast()&&!f.toast.querySelector('[id="link_undo"]'),'confirmed move has no native Undo link');
    assert(!undoChord().defaultPrevented,'missing link uses the original native Z gesture');await wait(80);
    assert(f.first.isConnected&&f.first.querySelector('.at').title==='Mgr','Gmail native Undo restores Inbox while preserving Mgr');
    assert(!successToast()&&f.archives()===1&&f.draft.innerHTML===contents,'no stale confirmation, repeat filing, or draft mutation');
  });
  await test('plain Z belongs to the draft editor while a move is undoable', async () => {
    const f=fixture({withDraft:true,route:'#inbox?compose=synthetic-draft'}); f.click(); await wait(100);
    const editor=f.draft.querySelector('[contenteditable]'); editor.focus();
    assert(!undoChord().defaultPrevented,'Z typing remains native'); await wait(70);
    assert(!f.first.isConnected&&successToast(),'Z in a draft cannot restore mail or dismiss its confirmation');
    assert(editor.textContent==='Unsent synthetic body'&&f.archives()===1,'no draft or filing mutation');
  });
  await test('plain Z restores only the latest available move', async () => {
    const f=fixture({unread:false}); f.click(); await wait(100); f.click(); await wait(100);
    assert(!f.first.isConnected&&!f.second.isConnected,'two conversations filed');
    undoChord(); await wait(80);
    assert(!f.first.isConnected&&f.second.isConnected,'native latest action owns restoration');
    assert(!successToast()&&f.archives()===2,'latest confirmation cleared without another move');
  });

  // Interactive synthetic preview for checking the actual 1.5-second card.
  // The extension manifest never loads this fixture or changes any real mail.
  const previewOptions = new URLSearchParams(location.search), preview = previewOptions.get('preview');
  if (['light','dark'].includes(preview)) {
    const withDraft=previewOptions.has('draft');
    const f=fixture({theme:preview,unread:false,labels:['Projects/Client Launch/Design Review'],withDraft,omitUndoLink:previewOptions.has('native-undo'),
      route:withDraft?'#inbox?compose=synthetic-draft':'#inbox'});
    document.body.classList.add('filing-preview'); results.textContent='Click the label tag to preview the move confirmation.';
    const reset=document.createElement('button'); reset.textContent='Reset synthetic conversation';
    reset.addEventListener('click',()=>{if(!f.first.isConnected){f.grid.tBodies[0].prepend(f.first);f.box(f.first).setAttribute('aria-checked','false');f.toolbar();}});
    workspace.append(reset); return;
  }

  for (const route of ['#inbox?compose=synthetic-draft', '#inbox/p2?compose=synthetic-draft'])
    for (const unread of [true, false]) await test('files '+(unread?'unread':'read')+' Inbox row with a floating draft on '+route, async () => {
      const f=fixture({route,unread,withDraft:true}), draft=f.draft, contents=draft.innerHTML;
      let draftEvents=0;
      for (const event of ['input','change','submit']) draft.addEventListener(event,()=>draftEvents++);
      assert(f.badge().hasAttribute('data-gp-file-label'),'draft URL still identifies Inbox');
      f.click(); await wait(150);
      assert(f.archives()===1&&f.reads()===(unread?1:0)&&!f.fallbackCount()&&!f.openCount(),'files the exact row instead of opening it');
      assert(successToast()?.textContent==='Moved to Projects/Example','confirmed move uses the full label');
      assert(location.hash===route&&draft.isConnected&&draft.innerHTML===contents&&!draftEvents,'draft and route untouched');
      assert(f.first.querySelector('.at').title==='Projects/Example'&&f.toast.querySelector('[id="link_undo"]'),'labels and native Undo preserved');
    });
  for (const route of ['#inbox','#inbox/p2']) await test('draft URL arriving after startup keeps labels actionable on '+route, async () => {
    const f=fixture({route,unread:false,withDraft:true});
    history.replaceState(null,'',route+'?compose=synthetic-draft'); window.dispatchEvent(new HashChangeEvent('hashchange')); await wait(80);
    assert(f.badge().hasAttribute('data-gp-file-label'),'native draft suffix does not remove badge action');
    f.click(); await wait(150);
    assert(f.archives()===1&&!f.fallbackCount()&&successToast(),'new gesture files from the current draft route');
  });
  await test('a draft URL change still cancels an in-flight filing operation', async () => {
    const f=fixture({route:'#inbox?compose=synthetic-draft',withDraft:true,ignoreReads:Infinity}); f.click(); await wait(80);
    assert(f.reads()===1,'filing started before draft state changed'); const attempts=f.reads();
    history.replaceState(null,'','#inbox?compose=another-synthetic-draft'); window.dispatchEvent(new HashChangeEvent('hashchange')); await wait(400);
    assert(!f.archives()&&f.reads()===attempts&&!successToast(),'full route guard stops stale actions and success');
    assert(f.badge().hasAttribute('data-gp-file-label'),'current Inbox badges remain available for a new gesture');
  });

  await test('successful filing confirms the full folder for exactly 1.5 seconds', async () => {
    const f=fixture(); f.click(); await wait(80); const toast=successToast();
    assert(toast?.textContent==='Moved to Projects/Example','destination confirmation');
    assert(toast.querySelector('[role="status"][aria-live="polite"][aria-atomic="true"]'),'accessible announcement');
    assert(!toast.querySelector('button')&&getComputedStyle(toast).pointerEvents==='none','no focusable controls or blocked clicks');
    await wait(1200); assert(successToast()===toast,'visible before 1.5 seconds');
    await wait(350); assert(!successToast(),'removed after 1.5 seconds');
    assert(f.toast.querySelector('[id="link_undo"]')&&!f.archiveClosed(),'native Archive Undo remains');
  });
  await test('the next successful move replaces the card and restarts its timer', async () => {
    const destination='Partners/Équipe + East/Shared', f=fixture({labels:['Projects/Example',destination]});
    f.second.querySelector('.at').title=destination; f.second.querySelector('.av').textContent='Partners/…/Shared';
    f.click(); await wait(100); const first=successToast(); assert(first,'first confirmation');
    await wait(850); f.click(); await wait(100); const second=successToast();
    assert(second&&second!==first&&second.textContent==='Moved to '+destination,'one replacement with exact nested destination');
    assert(document.querySelectorAll('.gmail-pro-filing-notice').length===1,'single notice owner');
    await wait(650); assert(successToast()===second,'previous timer cannot remove newer card');
    await wait(900); assert(!successToast(),'new timer expires');
  });
  await test('removed rows wait for a fresh native Archive acknowledgement', async () => {
    const f=fixture({archiveNoticeDelay:400}); f.click(); await wait(100);
    assert(!f.first.isConnected&&!successToast(),'row disappearance alone is insufficient');
    await wait(420); assert(successToast()?.textContent==='Moved to Projects/Example','delayed acknowledgement confirms destination');
  });
  await test('an acknowledgement alone cannot confirm a conversation still in Inbox', async () => {
    const f=fixture({ignoreArchive:true}); f.click(); await wait(70); f.notice('Conversation archived.'); await wait(70);
    assert(f.first.isConnected&&!successToast(),'waits for exact target removal');
    f.first.remove(); await wait(70); assert(successToast(),'both acknowledgement and removal required');
  });
  await test('stale acknowledgements and unrelated Undo edits cannot report success', async () => {
    const f=fixture({unread:false,omitArchiveNotice:true,timeout:600}); f.notice('Conversation archived.'); f.click(); await wait(80);
    f.toast.querySelector('.bAo').append(document.createTextNode(' unrelated change')); await wait(80);
    assert(!successToast(),'old message is not a fresh acknowledgement');
    await wait(550); assert(!successToast()&&noticeText().includes('hasn’t confirmed'),'honest uncertain result after expiry');
  });
  await test('fresh errors never become move confirmations', async () => {
    const f=fixture({omitArchiveNotice:true,timeout:500}); f.click(); await wait(80); f.notice('Something went wrong. Please try again.'); await wait(550);
    assert(!successToast()&&f.toast.textContent.includes('Something went wrong'),'native failure retained');
  });
  await test('temporary row replacement without acknowledgement never reports success', async () => {
    const f=fixture({ignoreArchive:true,timeout:650}); f.click(); await wait(70); const replacement=f.first.cloneNode(true); f.first.remove();
    await wait(70); assert(!successToast(),'replacement gap is not success');
    f.grid.tBodies[0].prepend(replacement); await wait(650);
    assert(!successToast()&&f.archives()===1&&replacement.isConnected,'replacement stays in Inbox without repeated Archive');
  });
  await test('recycled live identities cannot turn an unrelated acknowledgement into success', async () => {
    const f=fixture({ignoreArchive:true}); f.click(); await wait(70);
    f.first.querySelector('[data-thread-id]').setAttribute('data-thread-id','#recycled'); f.notice('Conversation archived.'); await wait(100);
    assert(!successToast()&&f.first.isConnected&&f.archives()===1,'live recycled row is rejected');
  });
  await test('an incomplete Archive mouse gesture cannot report success', async () => {
    const f=fixture({unread:false});
    f.archive.addEventListener('mousedown',()=>{f.archive.disabled=true;f.first.remove();f.notice('Conversation archived.');});
    f.click(); await wait(100); assert(!f.archives()&&!successToast(),'no click submission, no success');
  });
  await test('mode OFF during Archive dispatch stops the gesture and leaves no observers or controls', async () => {
    const f=fixture({unread:false,withActions:true}); f.open(f.second); await wait(70);
    f.archive.addEventListener('mousedown',()=>app.readingPane.stop()); f.click(); await wait(100);
    assert(!f.archives()&&!successToast()&&!f.main.querySelector('.gmail-pro-message-actions'),'no stale action or controls after synchronous stop');
  });
  for (const change of ['navigation','account','disable','cleanup']) await test(change+' discards a late native confirmation', async () => {
    const f=fixture({archiveDelay:300}), original=location.pathname; f.click(); await wait(70);
    if(change==='navigation'){history.replaceState(null,'','#label/Elsewhere');window.dispatchEvent(new HashChangeEvent('hashchange'));}
    else if(change==='account') history.replaceState(null,'','/tests/other-account#inbox');
    else if(change==='disable') app.readingPane.update({appleMailModeEnabled:false});
    else app.readingPane.stop();
    await wait(450); assert(!successToast(),'late acknowledgement cannot display in changed context');
    history.replaceState(null,'',original+'#inbox');
  });
  for (const change of ['navigation','account','disable','cleanup','hidden list']) await test(change+' removes an existing success card', async () => {
    const f=fixture(), original=location.pathname; f.click(); await wait(70); assert(successToast(),'card present');
    if(change==='navigation'){history.replaceState(null,'','#label/Elsewhere');window.dispatchEvent(new HashChangeEvent('hashchange'));}
    else if(change==='account'){history.replaceState(null,'','/tests/other-account#inbox');window.dispatchEvent(new PopStateEvent('popstate'));}
    else if(change==='disable') app.readingPane.update({appleMailModeEnabled:false});
    else if(change==='cleanup') app.readingPane.stop();
    else {f.main.querySelector('.Nu.tf').hidden=true;window.dispatchEvent(new Event('resize'));}
    await wait(70); assert(!successToast(),'card and position work released');
    history.replaceState(null,'',original+'#inbox');
  });
  for (const theme of ['light','dark']) await test(theme+' success card fits a narrow list, wraps safely, and follows its geometry', async () => {
    const destination='Clients/Équipe + East/'+('LongDestination').repeat(12), f=fixture({labels:[destination],theme,archiveNoticeDelay:200});
    const list=f.main.querySelector('.Nu.tf'); list.style.width='260px'; f.click(); await wait(70);
    const rowTop=f.second.getBoundingClientRect().top, focus=document.activeElement;
    await wait(300); const toast=successToast(), bounds=toast?.getBoundingClientRect(), listBounds=list.getBoundingClientRect();
    assert(toast?.textContent==='Moved to '+destination,'full destination, no truncation');
    assert(Math.abs(bounds.top-listBounds.top-12)<1&&Math.abs(bounds.left+bounds.width/2-listBounds.left-listBounds.width/2)<1,'top inset and centering');
    assert(bounds.width<=listBounds.width-23&&bounds.height>44&&toast.scrollWidth<=toast.clientWidth,'long name wraps within narrow width');
    assert(f.second.getBoundingClientRect().top===rowTop&&document.activeElement===focus,'no layout or focus change from card');
    const style=getComputedStyle(toast);
    assert(style.backgroundColor===(theme==='light'?'rgb(255, 255, 255)':'rgb(35, 41, 43)'),'theme background');
    assert(style.color===(theme==='light'?'rgb(32, 33, 36)':'rgb(222, 224, 226)'),'theme text');
    list.style.width='220px'; list.style.marginTop='20px'; window.dispatchEvent(new Event('resize')); await wait(70);
    const resized=toast.getBoundingClientRect(), next=list.getBoundingClientRect();
    assert(Math.abs(resized.top-next.top-12)<1&&resized.width<=next.width-23,'repositions and resizes with list');
    const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    assert(getComputedStyle(toast).animationName===(reduced?'none':'gmail-pro-filing-appear'),'animation follows current motion preference');
    const rules=[...document.styleSheets].flatMap(sheet=>[...sheet.cssRules]);
    assert(rules.some(rule=>rule.conditionText==='(prefers-reduced-motion: reduce)'&&[...rule.cssRules].some(inner=>toast.matches(inner.selectorText||':not(*)')&&inner.style.animationName==='none')),'browser parses reduced-motion override for this card');
  });
  await test('folder names are displayed as text rather than interpreted as HTML', async () => {
    const name='Clients/<img src=x onerror=alert(1)>', f=fixture({labels:[name]}); f.click(); await wait(100);
    assert(successToast()?.textContent==='Moved to '+name&&!successToast().querySelector('img'),'untrusted name stays text');
  });
  await test('error feedback remains dismissible for six seconds', async () => {
    const f=fixture(); f.box(f.second).click(); f.click(); await wait(70);
    assert(!successToast()&&noticeText().includes('Clear your selection'),'error is separate from success');
    await wait(5200); assert(document.querySelector('.gmail-pro-filing-notice'),'error stays readable until six seconds');
    await wait(900); assert(!document.querySelector('.gmail-pro-filing-notice'),'error expires after six seconds');
    f.click(); await wait(70); document.querySelector('.gmail-pro-filing-notice button').click();
    assert(!document.querySelector('.gmail-pro-filing-notice'),'manual dismissal');
  });


  await test('files the clicked unopened conversation, not the open reading pane', async () => {
    const f=fixture({labels:['Projects/Example','Keep also']}); f.open(f.second); f.click(); await wait(150);
    assert(f.reads()===1 && f.archives()===1,'one read then one archive');
    assert(f.actions.every(action=>action.id==='#thread-one'),'only clicked thread affected');
    assert(f.actions[1].read && !f.first.isConnected && f.second.classList.contains('zE'),'read confirmed before archive; other thread unread');
    assert(f.first.querySelectorAll('.at').length===2 && f.openCount()===1 && !f.fallbackCount(),'labels preserved; no row opening or native label navigation');
    assert(location.hash==='#inbox' && f.toast.textContent.includes('Conversation archived.'),'stays in Inbox with native notification');
  });
  await test('native label-group wrapper and direct badges retain exact row ownership', async () => {
    const f=fixture(); assert(f.badge().matches('.yi > .ar > .at[data-gp-file-label]'),'native grouped badge annotated');
    const badge=f.badge(), group=badge.parentElement; group.replaceWith(badge); await wait(80);
    assert(badge.matches('.yi > .at[data-gp-file-label]'),'supported direct badge retained');
    f.click(); await wait(150); assert(f.archives()===1&&f.actions.every(a=>a.id==='#thread-one'),'native owner filed once');
  });
  await test('filing another conversation preserves newest-first order with native tooltips', async () => {
    const f=fixture(); f.open(f.second); const shell=f.pane.querySelector('.iY'), list=shell.querySelector('[role="list"]');
    for(let i=1;i<3;i++) {
      const slot=list.firstElementChild.cloneNode(true), message=slot.querySelector('[data-message-id]');
      message.setAttribute('data-message-id','synthetic-message-'+i); message.setAttribute('data-legacy-message-id','synthetic-legacy-'+i); list.append(slot);
    }
    const latest=list.lastElementChild, tooltip=document.createElement('div'); tooltip.setAttribute('role','tooltip');
    tooltip.innerHTML='<h2>Native importance explanation</h2>'; tooltip.hidden=true; shell.append(tooltip);
    app.reverseThreads.update({newestEmailFirstEnabled:true}); await wait(100);
    const firstVisual=()=>[...list.children].sort((a,b)=>a.getBoundingClientRect().top-b.getBoundingClientRect().top)[0];
    assert(firstVisual()===latest&&list.getAttribute('data-gmail-pro-thread-order')==='reverse','latest first before filing');
    assert(f.actions.length===1&&f.actions[0].id==='#thread-two'&&f.actions[0].action==='read','displayed conversation reads immediately');
    const beforeFiling=f.actions.length; f.click(); await wait(200);
    assert(f.archives()===1&&f.actions.slice(beforeFiling).every(a=>a.id==='#thread-one'),'only clicked conversation filed');
    assert(firstVisual()===latest&&app.reverseThreads.currentConversation()?.list===list,'open conversation stays newest first and retains its identity');
  });
  for (const layout of ['list only','full reading-pane actions','unavailable reaction']) await test('delayed filing yields to timers and frames with '+layout, async () => {
    const f=fixture({archiveDelay:450,withActions:true});
    if (layout!=='list only') {
      f.open(f.second); await wait(60);
      assert(f.main.querySelectorAll('.gmail-pro-message-actions button:not([hidden])').length===4,'full action toolbar present');
      if (layout==='unavailable reaction') {
        f.pane.querySelector('[aria-label="Add reaction"]').disabled=true; await wait(60);
        assert(f.main.querySelector('[data-gp-message-action="reaction"]').hidden,'unavailable native action hidden');
      }
    }
    let timerRan=false, frameRan=false;
    f.click(); nativeTimeout(()=>{timerRan=true;},50); requestAnimationFrame(()=>{frameRan=true;});
    await wait(200);
    assert(timerRan&&frameRan,'browser stays responsive while Archive is pending');
    assert(f.archives()===1&&f.first.isConnected,'one delayed Archive attempt');
    await wait(400); assert(!f.first.isConnected&&f.archives()===1,'native completion arrives without retry');
  });
  await test('already-read conversations archive without toggling unread', async () => {
    const f=fixture({unread:false}); f.click(); await wait(100); assert(!f.reads() && f.archives()===1 && f.actions[0].read,'read state preserved');
  });
  await test('duplicate clicks never repeat Archive', async () => {
    const f=fixture({confirmDelay:350}); f.click(); f.click(); await wait(650); assert(f.archives()===1 && f.actions.filter(a=>a.action==='archive').length===1,'archive exactly once');
  });
  await test('full nested metadata resolves truncated names, Unicode, spaces, and plus signs', async () => {
    const name='Partners/Équipe + East/Shared', f=fixture({labels:[name,'Elsewhere/Shared'],route:'#inbox/p2'});
    f.badge().querySelector('.av').textContent='Partners/.../Shared'; f.click(); await wait(150);
    assert(f.archives()===1 && f.first.querySelector('.at').title===name && location.hash==='#inbox/p2','uses complete tooltip and stays on Inbox page');
  });
  for (const target of ['other','same']) await test('existing '+target+' selection blocks filing and is preserved', async () => {
    const f=fixture(); f.box(target==='other'?f.second:f.first).click(); f.click(); await wait(100);
    assert(!f.reads() && !f.archives() && noticeText().includes('Clear your selection'),'clear guidance without mail changes');
    assert(f.box(target==='other'?f.second:f.first).getAttribute('aria-checked')==='true','original selection retained');
  });
  await test('ignored read gestures retry at bounded intervals before filing', async () => {
    const f=fixture({ignoreReads:2}); f.click(); await wait(750);
    assert(f.reads()===3 && f.archives()===1,'third native read confirms then archives');
    const reads=f.actions.filter(a=>a.action==='read'); assert(reads[1].time-reads[0].time>=245 && reads[2].time-reads[1].time>=245,'no rapid retry loop');
  });
  await test('waits for delayed native read confirmation', async () => {
    const f=fixture({confirmDelay:450}); f.click(); await wait(200); assert(!f.archives() && f.first.classList.contains('zE'),'no archive before native confirmation');
    await wait(500); assert(f.archives()===1 && f.actions.at(-1).read,'archive after read');
  });
  for (const unavailable of ['hidden','disabled','ambiguous']) await test('waits for '+unavailable+' read controls to become usable', async () => {
    const f=fixture(); let extra;
    if(unavailable==='hidden') f.read.hidden=true; else if(unavailable==='disabled') f.read.disabled=true;
    else { extra=f.read.cloneNode(true); extra.hidden=false; f.read.after(extra); }
    // Selection refresh would reveal a hidden read control; maintain that state
    // through the native checkbox handler for this readiness fixture.
    if(unavailable==='hidden') f.grid.addEventListener('click',()=>{f.read.hidden=true;});
    f.click(); await wait(300); assert(!f.reads() && !f.archives(),'unusable/ambiguous controls untouched');
    f.read.hidden=false; f.read.disabled=false; extra?.remove(); await wait(350); assert(f.archives()===1,'files when one usable control exists');
  });
  await test('read failure expires without archiving and releases owned selection', async () => {
    const f=fixture({ignoreReads:Infinity,timeout:850}); f.click(); await wait(1050);
    assert(!f.archives() && f.first.classList.contains('zE') && f.box(f.first).getAttribute('aria-checked')==='false','unread remains in Inbox, checkbox released');
    assert(noticeText().includes('wasn’t filed'),'honest failure feedback'); const attempts=f.reads(); await wait(300); assert(f.reads()===attempts,'retry stopped');
  });
  await test('archive failure reports partial success and never retries Archive', async () => {
    const f=fixture({ignoreArchive:true,timeout:850}); f.click(); await wait(1100);
    assert(f.reads()===1 && f.archives()===1 && f.first.isConnected && f.first.classList.contains('yO'),'read kept, archive attempted only once');
    assert(noticeText().includes('Marked read, but couldn’t file') && f.box(f.first).getAttribute('aria-checked')==='false','partial status and owned selection cleanup');
  });
  await test('native row replacement preserves exact thread targeting', async () => {
    const f=fixture({replaceRow:true}); f.click(); await wait(150); assert(f.archives()===1 && f.actions.at(-1).id==='#thread-one' && f.rows().length===1&&successToast(),'replacement row archived and confirmed by both IDs');
  });
  await test('recycled row identities cannot receive stale read or archive actions', async () => {
    const f=fixture({ignoreReads:Infinity,timeout:750}); f.click(); await wait(100);
    f.first.querySelector('[data-thread-id]').setAttribute('data-thread-id','#recycled'); await wait(850);
    assert(!f.archives() && f.actions.every(action=>action.id==='#thread-one'),'no action on recycled identity');
  });
  await test('navigation cancels the operation', async () => {
    const f=fixture({ignoreReads:Infinity}); f.click(); await wait(90);
    history.replaceState(null,'','#label/Elsewhere'); window.dispatchEvent(new HashChangeEvent('hashchange')); const reads=f.reads(); await wait(400);
    assert(!f.archives() && f.reads()===reads,'no actions after route change');
  });
  await test('outside pointer input cancels and releases only owned selection', async () => {
    const f=fixture({ignoreReads:Infinity}); f.click(); await wait(100); f.pane.dispatchEvent(new MouseEvent('pointerdown',{bubbles:true,button:0})); const reads=f.reads(); await wait(400);
    assert(!f.archives() && f.reads()===reads && f.box(f.first).getAttribute('aria-checked')==='false','cancelled cleanly');
  });
  await test('user bulk selection changes cancel without rewriting that selection', async () => {
    const f=fixture({ignoreReads:Infinity}); f.click(); await wait(100); f.box(f.second).click(); await wait(400);
    assert(!f.archives() && f.rows().every(row=>f.box(row).getAttribute('aria-checked')==='true'),'new user selection left intact');
  });
  await test('window departure cancels pending filing', async () => {
    const f=fixture({ignoreReads:Infinity}); f.click(); await wait(100); window.dispatchEvent(new Event('blur')); const reads=f.reads(); await wait(350);
    assert(!f.archives() && f.reads()===reads,'no actions after blur');
  });
  await test('disable cancels filing and restores attributes while standalone list remains enabled', async () => {
    const f=fixture({ignoreReads:Infinity}); const badge=f.badge(); assert(badge.getAttribute('role')==='button' && badge.getAttribute('tabindex')==='0','accessible badge');
    f.click(); await wait(80); app.messageList.update({appleMailModeEnabled:false,appleMailMessageListEnabled:true}); app.readingPane.update({appleMailModeEnabled:false}); await wait(350);
    assert(!f.archives() && !badge.hasAttribute('data-gp-file-label') && !badge.hasAttribute('role') && !badge.hasAttribute('tabindex') && !badge.hasAttribute('aria-label'),'restored native attributes');
  });
  for (const key of ['Enter',' ']) await test('keyboard '+(key===' '?'Space':key)+' files once and suppresses companion key events', async () => {
    const f=fixture({archiveDelay:150}), badge=f.badge(); badge.focus();
    for (const type of ['keydown','keypress','keydown','keyup']) badge.dispatchEvent(new KeyboardEvent(type,{key,bubbles:true,cancelable:true,repeat:type==='keydown'&&f.reads()>0}));
    await wait(300); assert(f.archives()===1 && !f.fallbackCount(),'one filing from keyboard');
  });
  for (const options of [{ctrlKey:true},{metaKey:true},{shiftKey:true},{altKey:true}]) await test('modified badge clicks retain native behavior '+Object.keys(options)[0], async () => {
    const f=fixture(); f.click(0,options); await wait(80); assert(!f.reads()&&!f.archives()&&f.fallbackCount()===1,'modified click native');
  });
  for (const route of ['#label/Projects%2FExample','#label/Projects%2FExample?compose=synthetic-draft','#search/inbox?compose=synthetic-draft'])
    await test('non-Inbox route stays native on '+route, async () => {
      const f=fixture({route}); f.click(); await wait(80); assert(!f.reads()&&!f.archives()&&f.fallbackCount()===1&&!f.badge().hasAttribute('data-gp-file-label'),'outside Inbox untouched');
    });
  await test('unknown or truncated tooltip names stay native', async () => {
    const f=fixture(); f.badge().title='Projects/...'; await wait(60); f.click(); await wait(80);
    assert(!f.reads()&&!f.archives()&&f.fallbackCount()===1&&!f.badge().hasAttribute('data-gp-file-label'),'never guess destination');
  });
  await test('late sidebar metadata annotates existing rows through existing observation', async () => {
    const f=fixture({sidebar:false}); assert(!f.badge().hasAttribute('data-gp-file-label'),'unknown initially'); f.addLabel('Projects/Example'); await wait(100);
    assert(f.badge().hasAttribute('data-gp-file-label'),'badge becomes accessible'); f.click(); await wait(120); assert(f.archives()===1,'files after native metadata arrives');
  });
  await test('startup recovers a main revealed after temporary native gating', async () => {
    const f=fixture({enabled:false}), gate=document.createElement('div'); gate.setAttribute('contenteditable','false');
    f.main.before(gate); gate.append(f.main); app.messageList.start({appleMailModeEnabled:true});
    assert(!f.badge().hasAttribute('data-gp-file-label'),'temporarily gated main not inspected');
    gate.removeAttribute('contenteditable'); f.labelOwners[0].menu.setAttribute('data-label-name','Projects/Example'); await wait(100);
    assert(f.badge().hasAttribute('data-gp-file-label'),'existing main recovered on native metadata update');
    app.readingPane.start({appleMailModeEnabled:true}); f.click(); await wait(150); assert(f.archives()===1,'recovered row files once');
  });
  await test('sidebar rename invalidates old badge metadata', async () => {
    const f=fixture(); f.labelOwners[0].link.href='#label/Renamed'; f.labelOwners[0].menu.setAttribute('data-label-name','Renamed'); await wait(100); f.click(); await wait(80);
    assert(!f.archives() && !f.badge().hasAttribute('data-gp-file-label') && f.fallbackCount()===1,'old label no longer actionable');
  });
  await test('authored email lookalikes cannot trigger filing', async () => {
    const f=fixture(), body=document.createElement('div'); body.className='ii'; const fake=f.grid.cloneNode(true); body.append(fake); f.pane.append(body);
    const target=body.querySelector('.at .av'); target.dispatchEvent(new MouseEvent('click',{bubbles:true,button:0,detail:1})); await wait(100);
    assert(!f.reads()&&!f.archives(),'authored structure ignored');
    assert([...fake.querySelectorAll('tr')].every(row => getComputedStyle(row).display !== 'grid'), 'copied row markers cannot style authored email');
  });
  await test('native Archive Undo stays visible and restores only archiving', async () => {
    const f=fixture(); f.click(); await wait(150); assert(f.toast.textContent.includes('Conversation archived.')&&f.toast.querySelector('[id="link_undo"]'),'native Undo retained');
    f.toast.querySelector('[id="link_undo"]').click(); await wait(100);
    assert(f.first.isConnected && f.first.classList.contains('yO') && f.first.querySelector('.at').title==='Projects/Example','Undo returns read conversation with label');
    assert(!successToast(),'native Undo also clears the move confirmation');
  });
  await test('a new unread state before Archive prevents filing', async () => {
    const f=fixture(); f.archive.disabled=true; f.click(); await wait(100); assert(f.first.classList.contains('yO'),'read confirmed');
    f.first.classList.replace('yO','zE'); f.archive.disabled=false; await wait(350); assert(!f.archives()&&f.first.classList.contains('zE'),'new unread state not archived');
  });
  await test('native and third-party attribute changes survive cleanup', async () => {
    const f=fixture(); const badge=f.badge(); badge.setAttribute('aria-label','Native replacement label'); app.messageList.stop();
    assert(badge.getAttribute('aria-label')==='Native replacement label'&&!badge.hasAttribute('data-gp-file-label'),'unowned changes preserved');
  });
  await test('navigation during a native mouse phase cannot commit a stale Archive', async () => {
    const f=fixture({unread:false});
    f.archive.addEventListener('mousedown',()=>{history.replaceState(null,'','#label/Elsewhere');window.dispatchEvent(new HashChangeEvent('hashchange'));});
    f.click(); await wait(300); assert(!f.archives()&&f.first.isConnected,'guard checked between native mouse phases');
  });
  await test('read confirmation followed by lost label metadata reports partial completion', async () => {
    const f=fixture(); f.archive.disabled=true; f.click(); await wait(100); f.labelOwners[0].owner.remove(); await wait(350);
    assert(!f.archives()&&noticeText().includes('Marked read, but couldn’t file'),'partial failure visible');
  });
  await test('missing Archive never substitutes another toolbar action', async () => {
    const f=fixture({timeout:700}); f.archive.remove(); f.click(); await wait(900);
    assert(f.reads()===1&&!f.archives()&&noticeText().includes('Marked read, but couldn’t file'),'keeps read conversation in Inbox');
  });
  await test('a merely absent unread class cannot count as confirmed read', async () => {
    const f=fixture({ignoreReads:Infinity,timeout:700}); f.click(); await wait(100); f.first.classList.remove('zE'); await wait(800);
    assert(!f.archives(),'unknown read state never archived');
  });
  await test('hidden sidebar labels remain eligible when full native metadata exists', async () => {
    const f=fixture(); f.labelOwners[0].owner.hidden=true; f.click(); await wait(120); assert(f.archives()===1,'hidden label metadata still authoritative');
  });
  await test('cleanup restores pre-existing native role and accessible name', async () => {
    const f=fixture(); app.messageList.stop(); const badge=f.badge();
    badge.setAttribute('role','link'); badge.setAttribute('tabindex','-1'); badge.setAttribute('aria-label','Original label');
    app.messageList.start({appleMailModeEnabled:true}); app.messageList.stop();
    assert(badge.getAttribute('role')==='link'&&badge.getAttribute('tabindex')==='-1'&&badge.getAttribute('aria-label')==='Original label','native attributes restored');
  });
  await test('an outstanding automatic read cannot target another open conversation during filing', async () => {
    const f=fixture({ignoreReads:1}); f.second.querySelector('[role="link"]').dispatchEvent(new MouseEvent('click',{bubbles:true,button:0}));
    await wait(70); const beforeFiling=f.actions.length;
    assert(beforeFiling===1&&f.actions[0].id==='#thread-two'&&f.second.classList.contains('zE'),'initial automatic read ignored and retry pending');
    f.click(); await wait(500);
    assert(f.actions.slice(beforeFiling).every(action=>action.id==='#thread-one')&&f.second.classList.contains('zE'),'automatic-read retry cancelled before filing');
    assert(f.archives()===1,'only the filed target archived');
  });
  await test('a shortcut registered before Apple Mail Mode safely cancels filing', async () => {
    const f=fixture({ignoreReads:Infinity}); f.click(); await wait(100); const attempts=f.reads();
    f.main.dispatchEvent(new KeyboardEvent('keydown',{key:'R',code:'KeyR',metaKey:true,shiftKey:true,bubbles:true,cancelable:true}));
    await wait(400); assert(!f.archives()&&f.reads()===attempts,'no queued filing after explicit shortcut');
    assert(f.box(f.first).getAttribute('aria-checked')==='true','shortcut keeps the user command target');
  });
  await test('only Gmail’s validated native badge wrapper becomes actionable', async () => {
    const f=fixture(); const badge=f.badge(), text=badge.querySelector('.av'); badge.replaceChildren(text); await wait(80); f.click(); await wait(80);
    assert(!f.reads()&&!f.archives()&&!badge.hasAttribute('data-gp-file-label'),'unsupported wrapper remains native');
  });
  await test('account-path changes cancel even when the Inbox hash is unchanged', async () => {
    const f=fixture({ignoreReads:Infinity}); const original=location.pathname; f.click(); await wait(100); const attempts=f.reads();
    history.replaceState(null,'','/tests/other-account#inbox'); await wait(400);
    assert(!f.archives()&&f.reads()===attempts,'no actions across account paths'); history.replaceState(null,'',original+'#inbox');
  });
  await test('tab visibility changes cancel filing', async () => {
    const f=fixture({ignoreReads:Infinity}); f.click(); await wait(100); document.dispatchEvent(new Event('visibilitychange')); const attempts=f.reads(); await wait(350);
    assert(!f.archives()&&f.reads()===attempts,'visibility cancellation stops timers');
  });
  await test('Apple Mail Mode off leaves ordinary badge clicks native', async () => {
    const f=fixture({enabled:false}); f.click(); await wait(80); assert(!f.reads()&&!f.archives()&&f.fallbackCount()===1,'feature off');
  });
  const passed=reports.filter(line=>line.startsWith('PASS')).length;
  results.textContent = `${passed}/${reports.length} passed\n`+reports.join('\n');
  results.dataset.complete='true'; results.dataset.failed=String(reports.length-passed);
})();
