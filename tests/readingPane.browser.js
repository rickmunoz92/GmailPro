(async () => {
  "use strict";
  const app = GmailPro, workspace = document.getElementById("workspace"), result = document.getElementById("results"), reports = [];
  const assert = (value, message) => { if (!value) throw new Error(message); };
  const settle = () => new Promise(resolve => setTimeout(resolve, 80));
  const css = node => getComputedStyle(node);
  const button = key => workspace.querySelector(`[data-gp-message-action="${key}"]`);
  const settings = {appleMailModeEnabled:true,appearanceTheme:"dark",accentColor:"blue"};
  const start = () => { app.appearance.start(settings); app.readingPane.start(settings); };
  const clicks = [];
  const bodyHTML = '<p>Simple message text <a href="#link">link</a></p><table style="width:1400px;background:#122333;color:white"><tbody><tr><td>Wide table</td></tr></tbody></table><img width="50" height="30" alt="Image" src="../icons/icon32.png"><blockquote>Quoted history</blockquote><p style="font:16px Georgia;color:#573595">Signature</p>';
  function fixture(id = "one", {hook=true, all=true, reaction=true, body=bodyHTML} = {}) {
    const main = document.createElement("div"); main.setAttribute("role", "main");
    main.innerHTML = `<div gh="tm"><div gh="mtb"><div class="G-tF"><div><button aria-label="Archive">Archive</button></div><div class="labels"><button aria-label="Labels">Labels</button>${hook ? '<button data-tooltip="Phish Alert">Hook</button>' : ''}</div><div class="more"><div role="button" aria-label="More email options" tabindex="0">More</div></div></div></div></div><div class="iY"><div class="V8djrc"><div class="ha"><h2 data-thread-perm-id="${id}" data-legacy-thread-id="legacy-${id}">Synthetic subject</h2><span role="status">External sender warning</span></div></div><div class="aHU"><div><div data-container-id="0:msg:kopisummary" role="button">Summarize this email</div></div><div role="list"><div role="listitem" aria-expanded="true" tabindex="-1" jsaction="message:.CLIENT"><div><div data-message-id="message-${id}" data-legacy-message-id="legacy-message-${id}" class="adn"><div class="aju"><div class="aCi"><span><img class="ajn ajo" width="40" height="40" alt="Avatar" src="../icons/icon32.png"></span></div></div><div class="gs"><div class="gE"><h3 class="gD">Synthetic sender</h3><span class="g3">10:00 AM</span><div class="ajw">To: Synthetic recipient <button aria-label="Show details">Details</button></div></div><div><div class="ii"><div class="a3s">${body}</div></div></div><div role="region" aria-label="Attachments">Attachment download</div></div></div></div></div></div></div><div class="btDi4d"><div class="amr"><div class="nr"><div class="amn">${all ? '<span class="ams bkI" role="link" tabindex="0">Reply all</span>' : ''}<span class="ams bkH" role="link" tabindex="0">Reply</span><span class="ams bkG" role="link" tabindex="0">Forward</span><button ${reaction ? 'aria-label="Add reaction"' : 'aria-label="Reactions unavailable" disabled'}>Emoji</button></div></div></div></div><div class="aE0"></div></div>`;
    workspace.append(main);
    const shell = main.querySelector('.iY'), footer = main.querySelector('.amn');
    for (const [key, selector] of [['replyAll','.bkI'],['reply','.bkH'],['forward','.bkG'],['reaction','button']]) footer.querySelector(selector)?.addEventListener('click', event => clicks.push({id,key,shift:event.shiftKey}));
    return {main,shell,footer,body:main.querySelector('.a3s'),toolbar:main.querySelector('[gh=mtb]')};
  }
  async function test(name, run) {
    try { await run(); reports.push(`PASS ${name}`); }
    catch(error) { reports.push(`FAIL ${name}: ${error.message}`); }
    app.readingPane.stop(); app.appearance.stop(); app.messageZoom.stop(); app.reverseThreads.stop(); app.autoBcc.stop();
    workspace.replaceChildren(); clicks.length = 0; await settle();
    result.textContent = reports.join('\n');
  }
  if (new URLSearchParams(location.search).has('preview')) {
    const f=fixture('preview');
    f.footer.addEventListener('click',()=>{ result.textContent='Native action invoked: '+clicks.at(-1)?.key; });
    start(); result.textContent='Synthetic visual preview — no Gmail connection.'; return;
  }
  await test('mode OFF leaves native controls and markup untouched', async () => {
    const f=fixture(), before=f.main.innerHTML; app.readingPane.start({appleMailModeEnabled:false}); await settle();
    assert(f.main.innerHTML===before && !button('reply'), 'OFF inert');
  });
  await test('idempotent group follows hook, precedes More, delegates all native actions', async () => {
    const f=fixture(); start(); start(); await settle();
    const group=workspace.querySelector('.gmail-pro-message-actions');
    assert(workspace.querySelectorAll('.gmail-pro-message-actions').length===1, 'one group');
    assert(group.previousElementSibling.classList.contains('labels') && group.nextElementSibling.classList.contains('more'), 'correct position');
    for(const key of ['replyAll','reply','forward','reaction']) button(key).click();
    assert(clicks.map(x=>x.key).join(',')==='replyAll,reply,forward,reaction', 'all actions delegated exactly once');
    assert(f.footer.hasAttribute('data-gp-native-actions') && css(f.footer.closest('.btDi4d')).display==='none','replacement hides bottom');
  });
  await test('no phishing hook required; native controls remain in original DOM', async () => {
    const f=fixture('one',{hook:false}), parent=f.footer.parentElement; start(); await settle();
    assert(button('reply') && f.footer.parentElement===parent, 'fallback insertion without moving native controls');
  });
  await test('contextual availability follows native controls, including disabled reaction', async () => {
    const f=fixture('one',{all:false,reaction:false}); start(); await settle();
    assert(button('replyAll').hidden && button('reaction').hidden && !button('forward').hidden,'unavailable controls hidden');
    const native=f.footer.querySelector('.bkG'); native.setAttribute('aria-disabled','true'); await settle();
    assert(button('forward').hidden,'dynamic disabled state');
  });
  await test('new native action causes graceful visible-footer fallback', async () => {
    const f=fixture(); start(); await settle(); const extra=document.createElement('button'); extra.textContent='Unknown new action'; f.footer.append(extra); await settle();
    assert(css(f.footer.closest('.btDi4d')).display!=='none', 'unknown action remains accessible');
  });
  await test('no selected thread means no group or divider', async () => {
    const f=fixture(); start(); await settle(); f.shell.hidden=true; await settle();
    assert(!workspace.querySelector('.gmail-pro-message-actions') && !f.footer.hasAttribute('data-gp-native-actions'),'empty pane cleanup');
    f.shell.hidden=false; await settle(); assert(button('reply'),'visible thread returns');
  });
  await test('activation re-resolves native target even before mutation delivery', async () => {
    const f=fixture(); start(); await settle(); const native=f.footer.querySelector('.bkH'), replacement=native.cloneNode(true);
    replacement.addEventListener('click',()=>clicks.push({id:'replacement',key:'reply'})); native.replaceWith(replacement);
    button('reply').click(); assert(clicks.length===1 && clicks[0].id==='replacement','no stale captured native button');
  });
  await test('SPA thread replacement targets new message without duplicate group', async () => {
    const f=fixture(); start(); await settle(); f.main.remove(); fixture('two'); await settle();
    button('forward').click(); assert(clicks[0]?.id==='two' && workspace.querySelectorAll('.gmail-pro-message-actions').length===1,'new thread target');
  });
  await test('toolbar replacement restores native footer, then reinjects safely', async () => {
    const f=fixture(); start(); await settle(); const toolbar=f.toolbar.cloneNode(true); toolbar.querySelector('.gmail-pro-message-actions').remove(); f.toolbar.remove(); await settle();
    assert(css(f.footer.closest('.btDi4d')).display!=='none','fallback when no toolbar');
    f.main.querySelector('[gh=tm]').append(toolbar); await settle();
    assert(workspace.querySelectorAll('.gmail-pro-message-actions').length===1,'reattached group');
  });
  await test('missing or ambiguous native footer never hides native actions', async () => {
    const f=fixture(); f.footer.querySelectorAll('.ams').forEach(e=>e.className='unknown'); start(); await settle();
    assert(!button('reply') && css(f.footer.closest('.btDi4d')).display!=='none','unrecognized native controls retained');
  });
  await test('newest-first and expanded older messages keep native footer targeting', async () => {
    const f=fixture(); const list=f.main.querySelector('[role=list]'), older=list.firstElementChild.cloneNode(true);
    older.querySelector('[data-message-id]').dataset.messageId='older'; list.prepend(older);
    app.reverseThreads.start({newestEmailFirstEnabled:true}); start(); await settle();
    assert(list.getAttribute('data-gmail-pro-thread-order')==='reverse','existing reversal active');
    button('replyAll').click(); assert(clicks[0]?.id==='one','same native footer target regardless visual order');
    older.setAttribute('aria-expanded','false'); await settle(); assert(button('reply'),'collapse does not break target');
  });
  await test('subject, sender, recipients, timestamp, warnings, details and attachments remain', async () => {
    const f=fixture(); start(); await settle();
    for(const selector of ['h2','.gD','.g3','.ajw','[role=status]','[aria-label="Show details"]','[aria-label=Attachments]']) assert(f.main.querySelector(selector).checkVisibility(),'metadata preserved '+selector);
    assert(!f.main.querySelector('[data-container-id]').checkVisibility(),'summary hidden');
  });
  await test('sender photo aligns within compact header without body overlap', async () => {
    const f=fixture(); start(); await settle();
    const avatar=f.main.querySelector('.aju img').getBoundingClientRect();
    const header=f.main.querySelector('.gE').getBoundingClientRect();
    const body=f.body.parentElement.getBoundingClientRect();
    assert(avatar.height===28 && avatar.width===28, 'compact photo dimensions');
    assert(Math.abs((avatar.top+avatar.bottom-header.top-header.bottom)/2)<=2, 'photo centered on sender and recipient header');
    assert(avatar.top>=header.top && avatar.bottom<=body.top, 'entire photo above message body');
    app.appearance.stop();
    assert(css(f.main.querySelector('.aju')).height==='80px', 'native avatar layout restored when mode is off');
  });
  await test('body formatting, table, image, signature and quoted history are unchanged', async () => {
    const f=fixture(), before=f.body.innerHTML;
    const snapshot=()=>[...f.body.querySelectorAll('*')].map(e=>[css(e).font,css(e).color,css(e).backgroundColor]).flat().join('|');
    const styles=snapshot(); start(); await settle(); assert(f.body.innerHTML===before && snapshot()===styles,'authored HTML and styles preserved');
    assert(css(f.body.parentElement).overflowX==='auto','wide content remains scrollable');
    assert(parseFloat(css(f.main.querySelector('.gs')).paddingLeft)===16,'wider pane replaces 72px gutter');
  });
  for (const background of ['white','#171b21']) await test('explicit '+background+' HTML canvas and simple content stay authored', async () => {
    const f=fixture('one',{body:`<article style="background:${background};color:#a09887;padding:20px"><p>Newsletter</p><table><tr><td>Content</td></tr></table></article>`});
    const before=f.body.innerHTML; start(); await settle(); assert(f.body.innerHTML===before,'no content rewrite');
    assert(css(f.body.querySelector('article')).backgroundColor!=='transparent','authored canvas kept');
  });
  await test('zoom applies only to body; header and action sizes stay fixed', async () => {
    const f=fixture(); start(); app.messageZoom.start({messageZoomEnabled:true}); await settle();
    const before=button('reply').getBoundingClientRect().width;
    f.body.dispatchEvent(new KeyboardEvent('keydown',{key:'+',code:'Equal',metaKey:true,bubbles:true,cancelable:true})); await settle();
    assert(css(f.body).zoom==='1.1','existing message zoom engaged');
    assert(button('reply').getBoundingClientRect().width===before,'toolbar unzoomed');
    assert(css(f.main.querySelector('.gE')).zoom==='1','header unzoomed');
  });
  await test('theme/accent changes update UI without changing message HTML', async () => {
    const f=fixture(), before=f.body.innerHTML; start(); await settle();
    for (const theme of ['light','dark']) for(const accent of app.settings.choices.accentColor) app.appearance.update({appearanceTheme:theme,accentColor:accent});
    assert(f.body.innerHTML===before && button('reply').title==='Reply','content stable and accessible names retained');
  });
  await test('Shift activation preserves native pop-out modifier', async () => {
    fixture(); start(); await settle(); button('reply').dispatchEvent(new MouseEvent('click',{shiftKey:true,bubbles:true}));
    assert(clicks[0]?.shift===true,'modifier delegated to Gmail');
  });
  for (const key of ['reply','replyAll','forward']) await test(key+' delegates native draft creation with Auto BCC and unchanged editor', async () => {
    const f=fixture(); start(); app.autoBcc.start({autoBccEnabled:true,bccAddress:'archive@example.com'}); await settle();
    const selector={reply:'.bkH',replyAll:'.bkI',forward:'.bkG'}[key];
    let editor, list;
    f.footer.querySelector(selector).addEventListener('click',()=>{
      const region=document.createElement('section'); region.setAttribute('role','region');
      region.innerHTML='<form><input name="composeid" type="hidden"><div role="listbox"><input role="combobox" aria-label="To recipients"></div><div role="listbox"><input role="combobox" aria-label="BCC recipients"></div></form><div contenteditable="true" role="textbox" style="font:17px Georgia;color:#543210"><b>Native draft formatting</b></div>';
      editor=region.querySelector('[contenteditable]'); list=region.querySelector('[aria-label="BCC recipients"]').parentElement;
      list.querySelector('input').addEventListener('keydown',event=>{
        if(event.key!=='Enter') return; event.preventDefault();
        const chip=document.createElement('span');chip.setAttribute('role','option');chip.dataset.hovercardId=event.target.value;list.prepend(chip);event.target.value='';
      });
      f.shell.append(region); editor.focus();
    });
    button(key).click(); await new Promise(resolve=>setTimeout(resolve,400));
    assert(list.querySelectorAll('[role=option][data-hovercard-id="archive@example.com"]').length===1,'exactly one native BCC chip');
    assert(editor.innerHTML==='<b>Native draft formatting</b>' && css(editor).fontSize==='17px','outgoing editor unchanged');
  });
  await test('narrow toolbar keeps native actions available when top group cannot fit', async () => {
    const f=fixture(); f.toolbar.style.width='90px'; start(); await settle();
    assert(css(f.footer.closest('.btDi4d')).display!=='none','no inaccessible replacement');
  });
  await test('message body mutations do not trigger chrome rescans', async () => {
    const f=fixture(); start(); await settle(); const group=workspace.querySelector('.gmail-pro-message-actions');
    let changes=0; const observer=new MutationObserver(records=>changes+=records.length);
    observer.observe(f.footer,{attributes:true}); observer.observe(group,{attributes:true,subtree:true});
    for(let i=0;i<100;i++) f.body.append(document.createElement('span'));
    await settle(); observer.disconnect(); assert(changes===0,'body edits did not cause refresh/marker churn');
  });
  await test('Search, Labels, Sent, Drafts and Back/Forward route changes resolve fresh contexts', async () => {
    fixture(); start(); await settle();
    for(const route of ['search/synthetic','label/synthetic','sent','drafts','inbox']) {
      workspace.replaceChildren(); const f=fixture(route);
      window.dispatchEvent(new PopStateEvent('popstate')); await settle();
      button('forward').click(); assert(clicks.at(-1)?.id===route,'route target '+route);
      f.shell.hidden=true; await settle(); assert(!button('reply'),'no selected message on '+route);
    }
  });
  await test('a missing More anchor falls back and returns after native reconstruction', async () => {
    const f=fixture(); start(); await settle(); const more=f.toolbar.querySelector('.more'); more.remove(); await settle();
    assert(!button('reply') && css(f.footer.closest('.btDi4d')).display!=='none','native fallback');
    f.toolbar.querySelector('.G-tF').append(more); await settle(); assert(button('reply'),'anchor reconstruction');
  });
  await test('resizing reevaluates whether native bottom controls are needed', async () => {
    const f=fixture(); start(); await settle(); f.toolbar.style.width='90px'; window.dispatchEvent(new Event('resize')); await settle();
    assert(css(f.footer.closest('.btDi4d')).display!=='none','narrow fallback');
    f.toolbar.style.width=''; window.dispatchEvent(new Event('resize')); await settle();
    assert(css(f.footer.closest('.btDi4d')).display==='none','wide replacement restored');
  });
  await test('mode OFF restores footer/reading geometry and releases lifecycle', async () => {
    const f=fixture(), before=f.main.innerHTML; start(); await settle(); app.readingPane.stop(); app.appearance.stop(); await settle();
    assert(f.main.innerHTML===before && !button('reply'),'all injected UI and markers removed');
    assert(css(f.footer.closest('.btDi4d')).display!=='none' && css(f.main.querySelector('.gs')).paddingLeft==='0px','native layout restored');
  });
  const failures=reports.filter(line=>line.startsWith('FAIL')).length;
  result.textContent=reports.join('\n')+`\n\n${reports.length-failures}/${reports.length} checks passed.`;
  result.dataset.failures=String(failures);
})();
