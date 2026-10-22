(async () => {
  'use strict';
  const app = GmailPro, workspace = document.getElementById('workspace'), results = document.getElementById('results');
  const assert = (value, message) => { if (!value) throw Error(message); };
  const rect = node => node.getBoundingClientRect();
  const frames = async (count = 6) => { for (let i = 0; i < count; i++) await new Promise(requestAnimationFrame); };
  const filter = new URLSearchParams(location.search).get('case');
  let passes = 0, failures = 0, settingsWrites = 0;
  app.settings = { ...app.settings, save: async () => { settingsWrites++; } };

  function stop() {
    app.readingPane.stop(); app.headerLayout.stop(); app.appearance.stop(); app.messageList.stop(); app.reverseThreads.stop();
  }
  async function fixture({ width = 940, collapsed = true, theme = 'dark', footer = false } = {}) {
    stop(); settingsWrites = 0;
    document.documentElement.className = '';
    history.replaceState(null, '', '#inbox');
    workspace.style.width = width + 'px';
    workspace.innerHTML = `<div class="w-asV"><header role="banner"><button>Menu</button><div class="search-owner"><form role="search"><div gh="sb"><input name="q" aria-label="Search mail"></div><button aria-label="Advanced search options">Filters</button></form></div></header></div><div class="stage"><nav role="navigation"><div class="aic"><div class="z0"><div gh="cm" role="button" tabindex="0">Compose</div></div></div><div class="mailboxes">Synthetic mailboxes</div></nav><main role="main"><div gh="tm"><div gh="mtb"><div class="G-tF"><div class="G-Ni"><div class="G-as3" role="button"><span role="checkbox" aria-checked="false">Select</span></div></div><div class="native-actions"><button aria-label="Archive">A</button><button aria-label="Mark as read">Read</button></div><div class="native-more" role="button" tabindex="0" aria-label="More email options">More</div></div></div><div class="Di"><div role="button" aria-label="Show more messages">1–3 of 3</div><button aria-label="Older">Next</button></div></div><div class="panes"><div class="Nu tf"><div class="ae4"><table role="grid"><tbody></tbody></table></div></div><div class="Nu S3"></div></div></main></div>`;
    const list = workspace.querySelector('.Nu.tf'), body = list.querySelector('tbody'), pane = workspace.querySelector('.Nu.S3');
    const rows = [0, 1, 2].map(i => {
      const row = GmailProTestRow({ threadId: 'thread-' + i, legacyThreadId: 'legacy-' + i, unread: i === 2, subject: 'Synthetic conversation ' + (i + 1) });
      row.closest('table').remove(); body.append(row); return row;
    });
    const f = { rows, list, pane, shell: workspace.querySelector('.w-asV'), toolbar: workspace.querySelector('[gh=tm]'),
      actions: workspace.querySelector('[gh=mtb]'), form: workspace.querySelector('form'), calls: [], collapsed, index: 0 };
    f.footer = (reaction = true) => {
      const owner = document.createElement('div'); owner.className = 'btDi4d';
      owner.innerHTML = '<div class="amn"><span class="ams bkI" role="link" tabindex="0">Reply all</span><span class="ams bkH" role="link" tabindex="0">Reply</span><span class="ams bkG" role="link" tabindex="0">Forward</span><button aria-label="Add reaction">Reaction</button></div>';
      owner.querySelector('button').disabled = !reaction;
      for (const node of owner.querySelectorAll('.ams, button')) node.addEventListener('click', () => f.calls.push(node.textContent));
      pane.querySelector('.iY').append(owner); return owner;
    };
    f.select = (i, { footer = true, reaction = true } = {}) => {
      f.index = i;
      rows.forEach((row, index) => row.classList.toggle('aps', i === index));
      pane.innerHTML = `<div class="iY"><div class="ha"><h2 data-thread-perm-id="thread-${i}" data-legacy-thread-id="legacy-${i}">Synthetic conversation ${i + 1}</h2></div><div role="list"><div role="listitem" aria-expanded="true" tabindex="-1" jsaction="message:.CLIENT"><div><div class="adn" data-message-id="message-${i}" data-legacy-message-id="legacy-message-${i}"><div class="gE"><span class="hb">to <span class="g2">Synthetic recipient</span></span></div><div class="ii"><div class="a3s">Synthetic received message ${i + 1}</div></div></div></div></div></div></div>`;
      if (footer) f.footer(reaction);
    };
    rows.forEach((row, i) => row.addEventListener('click', () => f.select(i)));
    list.addEventListener('keydown', event => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault(); f.select(Math.max(0, Math.min(2, f.index + (event.key === 'ArrowDown' ? 1 : -1))));
      }
    });
    workspace.querySelector('[aria-label="Mark as read"]').addEventListener('click', () => rows[f.index].classList.remove('zE'));
    f.select(0, { footer });
    const settings = { ...app.settings.defaults, appleMailModeEnabled: true, appearanceTheme: theme, accentColor: 'blue', headerCollapsed: collapsed };
    app.appearance.start(settings); app.messageList.start(settings); app.headerLayout.start(settings); app.readingPane.start(settings);
    await frames(); list.scrollTop = 30; return f;
  }
  function stableSelection(f) {
    const top = rect(f.list).top, height = rect(f.shell).height, scroll = f.list.scrollTop;
    const brand = workspace.querySelector('.gmail-pro-sidebar-brand');
    let resizes = 0;
    const resized = () => resizes++;
    window.addEventListener('resize', resized);
    return {
      check() {
        assert(rect(f.shell).height === height && f.shell.hasAttribute('data-gp-header-collapsed') === f.collapsed, 'selection preserves header height/preference');
        assert(rect(f.list).top === top && f.list.scrollTop === scroll, 'selection preserves list position/scroll');
        assert(workspace.querySelector('.gmail-pro-sidebar-brand') === brand, 'selection preserves sidebar owner');
        assert(resizes === 0, 'selection emits no synthetic resize');
      },
      stop() { window.removeEventListener('resize', resized); }
    };
  }
  function available(f) {
    const group = workspace.querySelector('.gmail-pro-message-actions');
    assert(f.form.hasAttribute('data-gp-toolbar-search'), 'native search stays available');
    const footer = f.pane.querySelector('.btDi4d');
    if (!group?.checkVisibility({ visibilityProperty: true })) {
      assert(footer?.checkVisibility({ visibilityProperty: true }), 'native footer available while toolbar shortcuts overflow');
      const reply = footer.querySelector('.bkH'), r = rect(reply);
      assert(r.width > 0 && r.height > 0, 'native Reply has a hit target');
      reply.click(); assert(f.calls.at(-1) === 'Reply', 'native Reply still delegates');
    } else {
      const search = document.querySelector('[data-gp-header-action="search"]');
      const edge = search && !search.hidden ? rect(search).left : rect(f.form).left;
      assert(rect(group).right <= edge, 'toolbar message shortcuts clear search');
    }
  }
  async function idle(f, count = 120) {
    let writes = 0, resizes = 0;
    // Appearance intentionally fades its scroll indicator after the scroll
    // preservation check. Count every other mutation, including footer state.
    const observer = new MutationObserver(records => {
      writes += records.filter(record => !/^data-gp-scroll-[xy]$/.test(record.attributeName || '')).length;
    });
    observer.observe(workspace, { childList: true, subtree: true, attributes: true });
    const resized = () => resizes++; window.addEventListener('resize', resized);
    try { await frames(count); }
    finally { observer.disconnect(); window.removeEventListener('resize', resized); }
    assert(writes === 0 && resizes === 0, `idle has no writes/resizes (${writes}/${resizes})`);
  }
  async function test(name, run) {
    if (filter && !name.includes(filter)) return;
    try { await run(); passes++; results.textContent += 'PASS ' + name + '\n'; }
    catch (error) { failures++; results.textContent += 'FAIL ' + name + ': ' + error.message + '\n'; }
    finally { stop(); }
  }
  if (new URLSearchParams(location.search).has('preview')) {
    const f = await fixture({ width: Number(new URLSearchParams(location.search).get('width')) || 1000 });
    f.select(1); await frames(); results.hidden = true; return;
  }
  results.textContent = '';
  await test('lower-row message actions never expand the header or reset the sidebar', async () => {
    for (const width of [940, 1000]) {
      const f = await fixture({ width }), watch = stableSelection(f);
      try {
        f.rows[1].click();
        for (let i = 0; i < 10; i++) { await frames(1); watch.check(); }
        available(f); await idle(f);
      } finally { watch.stop(); }
    }
  });
  await test('rows 1 2 3 1 retain layout across delayed footers, reactions, themes and saved preferences', async () => {
    for (const theme of ['dark', 'light']) for (const collapsed of [true, false]) {
      const f = await fixture({ theme, collapsed }), watch = stableSelection(f);
      try {
        for (const i of [0, 1, 2, 0]) {
          f.select(i, { footer: false });
          for (let j = 0; j < 6; j++) { await frames(1); watch.check(); }
          f.footer(i !== 0);
          for (let j = 0; j < 6; j++) { await frames(1); watch.check(); }
          available(f);
        }
        assert(settingsWrites === 0, 'selection never saves header preferences');
        await idle(f);
      } finally { watch.stop(); }
    }
  });
  await test('keyboard switches and native read transitions keep the header steady', async () => {
    const f = await fixture(), watch = stableSelection(f);
    try {
      for (const key of ['ArrowDown', 'ArrowDown', 'ArrowUp', 'ArrowUp']) {
        f.list.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
        await frames(); watch.check(); available(f);
      }
      f.select(2); await frames();
      workspace.querySelector('[aria-label="Mark as read"]').click(); await frames(); watch.check();
      assert(!f.rows[2].classList.contains('zE'), 'native read transition completes without a header change');
      f.rows[1].click(); f.rows[2].click(); f.rows[0].click(); await frames(); watch.check();
      assert(f.index === 0 && f.rows[0].classList.contains('aps'), 'latest native selection wins');
      await idle(f);
    } finally { watch.stop(); }
  });
  await test('hidden action availability can recover without a resize and focus stays usable', async () => {
    const f = await fixture({ width: 1000 }); f.select(1); await frames();
    const group = workspace.querySelector('.gmail-pro-message-actions');
    assert(group && !group.checkVisibility(), 'four-action group overflows');
    const reaction = f.pane.querySelector('[aria-label="Add reaction"]');
    reaction.disabled = true; await frames();
    assert(group.checkVisibility(), 'three-action group returns after availability change');
    f.pane.querySelector('.ii').style.height = '2000px';
    group.querySelector('button').focus(); reaction.disabled = false; await frames();
    assert(!group.checkVisibility(), 'new action footprint is measured before readmission');
    assert(document.activeElement !== document.body && document.activeElement.checkVisibility(), 'focus moves to a visible control');
    const active = rect(document.activeElement);
    assert(active.top >= 0 && active.bottom <= innerHeight && document.activeElement.getAttribute('aria-label') === 'More email options', 'long message transfers focus to the visible native toolbar without scrolling');
    available(f); await idle(f);
  });
  await test('width changes recover shortcuts and genuine native fallback remains stable', async () => {
    const f = await fixture(); f.select(1); await frames();
    const stateAt = async width => {
      workspace.style.width = width + 'px'; await frames();
      return [f.form.hasAttribute('data-gp-toolbar-search'), !!workspace.querySelector('.gmail-pro-message-actions')?.checkVisibility(),
        !!workspace.querySelector('.gmail-pro-toolbar-compose'), document.querySelector('[data-gp-header-action="toggle"]')?.hidden].join('/');
    };
    const transitions = [], boundaries = new Set(); let last;
    for (const widths of [Array.from({ length: 17 }, (_, i) => 320 + i * 100), Array.from({ length: 17 }, (_, i) => 1920 - i * 100)]) {
      for (const width of widths) {
        const state = await stateAt(width);
        if (last && last.state !== state) transitions.push([last.width, width]);
        last = { state, width };
        if (f.form.hasAttribute('data-gp-toolbar-search')) available(f);
      }
    }
    // Locate actual pixel boundaries, rather than checking around coarse sweep
    // samples that can miss the fit/reject threshold entirely.
    for (const interval of transitions) {
      let low = Math.min(...interval), high = Math.max(...interval);
      const lowState = await stateAt(low);
      while (high - low > 1) {
        const middle = Math.floor((high + low) / 2);
        if (await stateAt(middle) === lowState) low = middle; else high = middle;
      }
      boundaries.add(high);
    }
    for (const center of boundaries) for (let width = center - 2; width <= center + 2; width++) {
      workspace.style.width = width + 'px'; await frames(); await idle(f, 120);
    }
    workspace.style.width = '1400px'; await frames();
    assert(workspace.querySelector('.gmail-pro-message-actions').checkVisibility(), 'widening returns message shortcuts');
    available(f); await idle(f);
    workspace.style.width = '940px'; await frames();
    assert(f.toolbar.hasAttribute('data-gp-message-actions-overflow'), 'cleanup starts with active overflow');
    app.headerLayout.stop(); await frames();
    assert(!f.toolbar.hasAttribute('data-gp-message-actions-overflow'), 'header cleanup releases overflow marker');
    app.readingPane.stop(); app.appearance.stop();
    assert(f.pane.querySelector('.btDi4d').checkVisibility(), 'mode OFF restores native footer');
  });
  results.textContent += `\n${passes} passed; ${failures} failed.\n`;
  results.dataset.done = 'true'; results.dataset.failures = String(failures);
})();
