(async () => {
  "use strict";
  const app = GmailPro, workspace = document.getElementById("workspace"), results = document.getElementById("results");
  const reports = [], defaults = app.settings.defaults;
  let shell, heading, nativeClicks, popClicks;
  const tick = async () => { await Promise.resolve(); await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); };
  const assert = (ok, reason) => { if (!ok) throw Error(reason); };
  app.reverseThreads = { currentConversation: () => ({ heading }), subscribeConversation: () => () => {} };
  function setup() {
    app.floatingCompose.stop(); workspace.replaceChildren();
    shell = document.createElement("div"); shell.className = "iY";
    heading = document.createElement("h2"); heading.dataset.threadPermId = "thread"; heading.dataset.legacyThreadId = "legacy";
    shell.append(heading); workspace.append(shell); nativeClicks = 0; popClicks = 0;
    app.floatingCompose.start(defaults);
  }
  function draft({ missing = false, noOp = false, delayed = false } = {}) {
    const region = document.createElement("div"); region.setAttribute("role", "region"); region.dataset.composeId = String(Math.random());
    region.innerHTML = '<form><input type="hidden" name="composeid"></form><div contenteditable="true" role="textbox" aria-label="Message Body">Signature and quoted text</div>';
    const pop = document.createElement("span"); pop.setAttribute("role", "button"); pop.setAttribute("aria-label", "Pop out reply"); pop.textContent = "Pop";
    pop.addEventListener("click", () => {
      popClicks++;
      if (noOp) return;
      const floating = document.createElement("div"); floating.setAttribute("role", "dialog");
      workspace.append(floating); floating.append(region); pop.remove(); region.querySelector('[contenteditable]').focus();
    });
    const template = pop.cloneNode(true); template.hidden = true; region.append(template);
    if (!missing && !delayed) region.append(pop);
    shell.append(region);
    region.querySelector("[contenteditable]").focus();
    return { region, pop };
  }
  function action(kind, options, { menu = false, header = false } = {}) {
    const control = document.createElement("span");
    control.setAttribute("role", menu ? "menuitem" : header ? "button" : "link");
    control.textContent = { reply: "Reply", replyAll: "Reply all", forward: "Forward" }[kind];
    if (!menu && !header) control.className = 'ams ' + { reply: 'bkH', replyAll: 'bkI', forward: 'bkG' }[kind];
    (menu ? workspace : shell).append(control);
    let made;
    control.addEventListener("click", () => { nativeClicks++; made = draft(options); });
    return { control, get made() { return made; } };
  }
  async function test(name, run) {
    setup();
    try { await run(); reports.push('PASS ' + name); } catch (error) { reports.push('FAIL ' + name + ': ' + error.message); }
    app.floatingCompose.stop(); results.textContent = reports.join('\n');
  }
  for (const kind of ['reply', 'replyAll', 'forward']) await test(kind + ' native action and focus', async () => {
    const a = action(kind); a.control.click(); await tick();
    assert(nativeClicks === 1 && popClicks === 1, 'one native action and one pop');
    assert(a.made.region.closest('[role="dialog"]'), 'floating at first rendering opportunity');
    assert(document.activeElement === a.made.region.querySelector('[contenteditable]'), 'native focus retained');
    assert(a.made.region.querySelector('[contenteditable]').textContent === 'Signature and quoted text', 'native content unchanged');
  });
  for (const kind of ['reply', 'replyAll', 'forward']) await test(kind + ' independent setting off', async () => {
    app.floatingCompose.update({ [{reply:'floatingReplyEnabled',replyAll:'floatingReplyAllEnabled',forward:'floatingForwardEnabled'}[kind]]: false });
    const a = action(kind); a.control.click(); await tick(); assert(popClicks === 0 && a.made.region.checkVisibility(), 'usable inline');
  });
  for (const menu of [false, true]) await test(menu ? 'native menu action' : 'native message header action', async () => {
    action('replyAll', {}, {menu, header:!menu}).control.click(); await tick(); assert(popClicks === 1, 'native action bridged');
  });
  await test('persistent toolbar delegates to native handler', async () => {
    const a = action('forward'), top = document.createElement('button'); top.dataset.gpMessageAction = 'forward'; top.textContent = 'Forward';
    workspace.append(top); top.addEventListener('click', () => a.control.click()); top.click(); await tick();
    assert(nativeClicks === 1 && popClicks === 1, 'no duplicate toolbar action');
  });
  for (const key of ['r','a','f']) await test('Gmail keyboard shortcut ' + key, async () => {
    shell.dispatchEvent(new KeyboardEvent('keydown', {key, bubbles:true})); const d = draft(); await tick();
    assert(popClicks === 1 && d.region.closest('[role="dialog"]'), 'native shortcut result floated');
  });
  await test('typing reply shortcut inside editor is inert', async () => {
    const d = draft(); d.region.querySelector('[contenteditable]').dispatchEvent(new KeyboardEvent('keydown',{key:'r',bubbles:true}));
    draft(); await tick(); assert(popClicks === 0, 'typing does not arm');
  });
  await test('missing control and no-op both leave usable inline drafts', async () => {
    const missing = action('reply',{missing:true}); missing.control.click(); await tick();
    assert(missing.made.region.checkVisibility(), 'missing control visible');
    const failed = action('forward',{noOp:true}); failed.control.click(); await tick();
    failed.made.region.append(document.createElement('span')); await tick();
    assert(popClicks === 1 && failed.made.region.checkVisibility() && !failed.made.region.hasAttribute('data-gp-floating-pending'), 'no-op visible, never retried');
  });
  await test('incremental control arrival', async () => {
    const a = action('reply',{delayed:true}); a.control.click(); await tick(); a.made.region.append(a.made.pop); await tick(); assert(popClicks === 1, 'late control discovered');
  });
  await test('three distinct drafts; minimized drafts stay minimized', async () => {
    const drafts = [];
    for (const kind of ['reply','replyAll','forward']) { const a=action(kind); a.control.click(); await tick(); drafts.push(a.made.region); }
    drafts[0].hidden = true; drafts[1].append(document.createElement('span')); await tick();
    assert(popClicks === 3 && workspace.querySelectorAll('[role="dialog"]').length === 3 && drafts[0].hidden, 'independent composers, no reopen');
  });
  await test('existing inline draft never targeted', async () => {
    const existing = draft(); action('forward').control.click(); await tick();
    assert(popClicks === 1 && shell.contains(existing.region), 'only new editor targeted');
  });
  await test('received content cannot trigger native pop-out', async () => {
    const a = action('reply'); const body = document.createElement('div'); body.className = 'ii'; shell.append(body); body.append(a.control);
    a.control.click(); await tick(); assert(popClicks === 0, 'received content excluded');
  });
  await test('navigation cancels pending transition', async () => {
    const a = action('reply',{delayed:true}); a.control.click(); window.dispatchEvent(new HashChangeEvent('hashchange'));
    a.made.region.append(a.made.pop); await tick(); assert(popClicks === 0 && a.made.region.checkVisibility(), 'cancelled on navigation');
  });
  await test('stop and restart do not accumulate observers', async () => {
    app.floatingCompose.start(defaults); app.floatingCompose.start(defaults); action('reply').control.click(); await tick();
    app.floatingCompose.stop(); app.floatingCompose.stop(); action('reply').control.click(); await tick(); assert(popClicks === 1, 'one activation, then inactive');
  });
  await test('Gmail construction controls settle before activation', async () => {
    const a = action('reply', {delayed:true}); a.control.click();
    const old = a.made.region.querySelector('[aria-label="Pop out reply"]');
    old.hidden = false;
    let stale = 0; old.addEventListener('click', () => stale++);
    await tick(); assert(popClicks === 0 && stale === 0, 'construction control untouched');
    old.hidden = true; a.made.region.append(a.made.pop); await tick();
    assert(popClicks === 1 && stale === 0, 'only final visible control used');
  });
  await test('native mouseup handler activates once with button coordinates', async () => {
    const a = action('reply', {noOp:true}); a.control.click();
    let mouseup = 0;
    a.made.pop.addEventListener('mouseup', event => {
      assert(event.detail === 1 && event.clientX > 0, 'complete native mouse activation');
      mouseup++;
      const dialog = document.createElement('div'); dialog.setAttribute('role','dialog');
      workspace.append(dialog); dialog.append(a.made.region);
    });
    await tick(); assert(mouseup === 1 && popClicks === 0, 'stop dispatch when Gmail has transitioned');
  });
  await test('missing native focus reveals inline editor by the next paint', async () => {
    const a = action('reply'); a.control.click(); a.made.region.querySelector('[contenteditable]').blur();
    await tick(); assert(popClicks === 0 && !a.made.region.hasAttribute('data-gp-floating-pending'), 'no stuck opacity');
    a.made.region.querySelector('[contenteditable]').focus(); await tick(); assert(popClicks === 1, 'native focus resumes transition');
  });
  await test('cancel pending pre-paint activation on navigation', async () => {
    action('reply').control.click(); await Promise.resolve();
    window.dispatchEvent(new PopStateEvent('popstate')); await tick();
    assert(popClicks === 0 && !workspace.querySelector('[data-gp-floating-pending]'), 'frame and hiding cancelled');
  });
  await test('unrelated settings do not cancel an armed action', async () => {
    const a = action('reply',{delayed:true}); a.control.click(); app.floatingCompose.update({accentColor:'red'});
    a.made.region.append(a.made.pop); await tick(); assert(popClicks === 1, 'unrelated preference leaves action intact');
  });
  await test('new compose remains native', async () => {
    const button = document.createElement('button'); button.textContent='Compose'; shell.append(button); button.click(); draft(); await tick(); assert(popClicks===0,'not armed');
  });
  results.dataset.failures = String(reports.filter(x=>x.startsWith('FAIL')).length); results.dataset.complete='true';
  results.textContent += `\n\n${reports.length - Number(results.dataset.failures)}/${reports.length} checks passed.`;
})();
