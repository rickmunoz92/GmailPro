(async () => {
  "use strict";
  // Match content.js: both setting consumers participate in the lifecycle.
  const feature = {
    start(patch) { GmailPro.messageList.start(patch); GmailPro.appearance.start(patch); },
    update(patch) { GmailPro.messageList.update(patch); GmailPro.appearance.update(patch); },
    stop() { GmailPro.messageList.update({appleMailModeEnabled:false,appleMailMessageListEnabled:false}); GmailPro.appearance.stop(); }
  }, row = GmailProTestRow, result = document.getElementById("results");
  const root = document.documentElement, workspace = document.getElementById("workspace"), reports = [];
  const css = node => getComputedStyle(node), rect = node => node.getBoundingClientRect();
  const assert = (value, message) => { if (!value) throw new Error(message); };
  const enable = (patch = {}) => feature.start({ appleMailModeEnabled: true, appearanceTheme: "dark", accentColor: "blue", ...patch });
  const color = value => { const e = document.createElement("i"); e.style.color = value; root.append(e); const c = css(e).color; e.remove(); return c; };
  const token = name => color(css(root).getPropertyValue(name).trim());
  const dot = node => getComputedStyle(node.querySelector(".yX"), "::before");
  const gesture = (node, modifiers = {}) => {
    for (const type of ["pointerdown", "mousedown", "click"]) node.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, ...modifiers }));
  };
  function selectableRows() {
    const nodes = Array.from({length:5}, (_, index) => {
      const node = row({unread:true});
      node.querySelector("[data-thread-id]").dataset.threadId = `thread-${index}`;
      const box = node.querySelector('[role="checkbox"]');
      box.addEventListener("click", event => {
        event.stopPropagation(); // Simulate Gmail owning its checkbox state.
        box.setAttribute("aria-checked", String(box.getAttribute("aria-checked") !== "true"));
      });
      return node;
    });
    for (const node of nodes.slice(1)) { const table = node.closest("table"); nodes[0].parentElement.append(node); table.remove(); }
    return nodes;
  }
  const selectedIndices = nodes => nodes.flatMap((node, index) => node.querySelector('[role="checkbox"]').getAttribute("aria-checked") === "true" ? [index] : []).join(",");
  const assertSelectionDots = nodes => nodes.forEach(node => {
    const checked = node.querySelector('[role="checkbox"]').getAttribute("aria-checked") === "true";
    assert(dot(node).visibility === "visible" && dot(node).backgroundColor === (checked ? "rgb(255, 255, 255)" : token("--gp-accent")), "checked unread dots stay white; unchecked dots use accent");
    assert(node.classList.contains("zE"), "selection preserves native unread state");
  });
  const luminance = c => {
    // Resolve modern color-mix through a canvas for stable sRGB channel values.
    const canvas = document.createElement("canvas"), ctx = canvas.getContext("2d");
    ctx.fillStyle = c; ctx.fillRect(0, 0, 1, 1);
    const channels = [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3).map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
    return channels.reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
  };
  const contrast = (a, b) => { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
  async function test(name, run) {
    try { await run(); reports.push(`PASS ${name}`); }
    catch (error) { reports.push(`FAIL ${name}: ${error.message}`); }
    feature.stop(); GmailPro.messageList.stop(); workspace.replaceChildren(); workspace.style.width = "";
    result.textContent = reports.join("\n");
  }
  function searchBar() {
    const bar = document.createElement('div'); bar.className = 'biW';
    bar.innerHTML = '<div class="Th"><div id="etsc" class="T-I qO" role="button" tabindex="0"><div aria-label="Email search results"><div class="Bn">Mail</div></div></div><div id="ctsc" class="T-I" role="button" tabindex="0"><div aria-label="Results in direct messages and spaces"><div class="Bn">Conversations</div></div></div><div id="stsc" class="T-I" role="button" tabindex="0"><div aria-label="Spaces matched by name"><div class="Bn">Spaces</div></div></div></div><div class="G6" role="toolbar" aria-label="search refinement"><div class="HW" role="button" tabindex="0" aria-pressed="false" aria-expanded="false"><div class="HY"><span class="H5">From</span><svg viewBox="0 0 24 24"><path d="M7 10l5 5 5-5z"></path></svg><div role="menu" style="color:#202124;background:white;font:14px Arial" hidden><span class="H5">Native menu item</span></div></div></div><div class="HW" role="button" tabindex="0" aria-pressed="true"><div class="HY"><span class="H5">Has attachment</span></div></div><div class="N5" role="button" tabindex="0" aria-haspopup="true"><span class="N7"><span class="Og">Advanced search</span></span></div></div>';
    return bar;
  }
  await test('personal search tabs, filters and Advanced search stay readable in both themes and all accents', () => {
    const bar = searchBar(); workspace.before(bar); // Deliberately outside main.
    const tabs = [...bar.querySelector('.Th').children], chips = [...bar.querySelectorAll('.HW')], advanced = bar.querySelector('.Og');
    const labels = [...bar.querySelectorAll('.Bn, .HW > .HY > .H5, .Og')];
    const correction = document.createElement('div');
    correction.innerHTML = '<div style="color:#202124">Did you mean: <span class="Wy" role="link" tabindex="0" qsugg="example" style="color:#1a73e8">example</span></div>';
    workspace.append(correction);
    const suggestion = correction.querySelector('[qsugg]');
    const snapshot = () => JSON.stringify([...bar.querySelectorAll('*')].map(n => [css(n).color, css(n).backgroundColor, getComputedStyle(n, '::before').backgroundColor]));
    const native = snapshot(), menu = bar.querySelector('[role="menu"]'), menuColor = css(menu).color;
    let clicks = 0; bar.addEventListener('click', () => clicks++);
    try {
      for (const appearanceTheme of ['dark', 'light']) for (const accentColor of GmailPro.settings.choices.accentColor) {
        enable({appearanceTheme, accentColor});
        assert(css(bar).backgroundColor === token('--gp-bg-primary'), 'search host uses the page surface above main');
        for (let selected = 0; selected < tabs.length; selected++) {
          tabs.forEach((tab, i) => tab.classList.toggle('qO', i === selected));
          for (const tab of tabs) {
            assert(contrast(css(tab.querySelector('.Bn')).color, css(tab).backgroundColor) >= 4.5, 'every selected/unselected segment is readable');
            assert(getComputedStyle(tab, '::before').backgroundColor === 'rgba(0, 0, 0, 0)', 'native selection overlay cannot hide themed text');
          }
          assert(css(tabs[selected]).backgroundColor !== css(tabs[(selected + 1) % tabs.length]).backgroundColor, 'active segment remains distinct');
        }
        for (const expanded of ['false', 'true']) {
          chips[0].setAttribute('aria-expanded', expanded);
          for (const chip of chips) assert(contrast(css(chip.querySelector('.H5')).color, css(chip).backgroundColor) >= 4.5, 'plain, selected and expanded chip labels are readable');
          assert(css(chips[0].querySelector('svg')).fill === css(chips[0]).color, 'dropdown icon uses the same readable foreground');
        }
        assert(contrast(css(advanced).color, css(bar).backgroundColor) >= 4.5 && contrast(css(advanced).color, token('--gp-hover')) >= 4.5, 'Advanced search is readable at rest and on hover');
        assert(contrast(css(suggestion).color, token('--gp-bg-primary')) >= 4.5 && contrast(css(suggestion.parentElement).color, token('--gp-bg-primary')) >= 4.5, 'query-correction label and link are readable');
        assert(css(menu).color === menuColor && css(menu).backgroundColor === 'rgb(255, 255, 255)', 'native nested menu retains its own text/background pair');
      }
      chips[0].click(); tabs[0].click(); advanced.parentElement.parentElement.click();
      assert(clicks === 3 && labels.every(n => n.textContent), 'native controls and labels remain usable');
      tabs.forEach((tab, i) => tab.classList.toggle('qO', i === 0)); chips[0].setAttribute('aria-expanded', 'false');
      feature.stop(); assert(snapshot() === native, 'mode OFF restores all native search colors and overlays');
      assert(css(suggestion).color === 'rgb(26, 115, 232)' && css(suggestion.parentElement).color === 'rgb(32, 33, 36)', 'mode OFF restores native query-correction colors');
    } finally { bar.remove(); }
  });
  await test('search-match text contrasts in read, unread, open and checked conversations without changing authored content', () => {
    const node = row({unread:true}), sender = node.querySelector('.sender'), subject = node.querySelector('[data-thread-id]'), snippet = node.querySelector('.y2');
    for (const target of [sender, subject, snippet]) target.innerHTML = 'Synthetic <span class="il">match</span>';
    const matches = [...node.querySelectorAll('.il')], native = matches.map(n => [css(n).color, css(n).backgroundColor]);
    const protectedContent = document.createElement('div'); protectedContent.className = 'a3s';
    protectedContent.innerHTML = '<div class="bog"><span class="il" style="color:#123456;background:#efe0c0">Authored match</span></div>';
    const fakeBar = searchBar(); protectedContent.append(fakeBar); workspace.append(protectedContent);
    const authored = protectedContent.querySelector('.il'), before = [css(authored).color, css(authored).backgroundColor, css(fakeBar.querySelector('.H5')).color];
    try {
      const palettes = { dark: new Set(), light: new Set() };
      for (const appearanceTheme of ['dark', 'light']) for (const accentColor of GmailPro.settings.choices.accentColor) {
        enable({appearanceTheme, accentColor});
        const background = css(matches[0]).backgroundColor;
        palettes[appearanceTheme].add(background);
        assert(background === token('--gp-search-match-bg'), 'matches use the theme highlight token');
        for (const state of ['read', 'unread', 'open', 'checked']) {
          node.classList.toggle('zE', state !== 'read'); node.classList.toggle('aps', state === 'open');
          node.querySelector('[role="checkbox"]').setAttribute('aria-checked', String(state === 'checked'));
          for (const match of matches) assert(contrast(css(match).color, css(match).backgroundColor) >= 4.5, 'all match foreground/background pairs remain readable');
        }
        assert(JSON.stringify([css(authored).color, css(authored).backgroundColor, css(fakeBar.querySelector('.H5')).color]) === JSON.stringify(before), 'authored matches and search-control lookalikes stay unchanged');
      }
      assert(Object.values(palettes).every(palette => palette.size === GmailPro.settings.choices.accentColor.length), 'every accent has its own search highlight in both appearances');
      assert([...palettes.dark].every(background => !palettes.light.has(background)), 'Light and Dark use distinct highlight shades');
      feature.stop(); assert(matches.every((n, i) => JSON.stringify([css(n).color, css(n).backgroundColor]) === JSON.stringify(native[i])), 'mode OFF restores native match paint');
    } finally { protectedContent.remove(); }
  });
  await test('Happening soon follows each theme without changing native data or controls', () => {
    workspace.innerHTML = '<div class="Nu tf"><div class="ae4"><div><div class="dgq5vc"><div class="E22Lmb"><div class="wNSjCf" style="background:#f0f4f9"><h2 class="iqFh3e" style="color:#202124">Happening soon</h2><button aria-label="Dismiss all">×</button></div><div><div class="vvhV3c"><div class="mNKakd gfbKJd" style="background:#f0f4f9"><span class="a8DSAf" style="color:black">Fictional delivery</span><div class="rjuWBc"><span>Arrives tomorrow</span></div><div class="FOBRw-I" style="background:#c2e7ff"><span>View order</span><a aria-label="View order" href="#fictional-order"></a></div><button aria-label="Toggle more actions menu">More actions</button></div></div><div class="L0lHNd vvhV3c"><button aria-label="Show more">Show more</button><span class="AV6tSd">+ 1 more</span></div></div></div></div></div></div></div>';
    const card = workspace.querySelector('.E22Lmb'), header = card.firstElementChild, native = card.innerHTML;
    let dismisses=0, expands=0, actions=0;
    card.querySelector('[aria-label="Dismiss all"]').addEventListener('click', () => dismisses++);
    card.querySelector('[aria-label="Show more"]').addEventListener('click', () => expands++);
    card.querySelector('[aria-label="Toggle more actions menu"]').addEventListener('click', () => actions++);
    for (const theme of ['dark','light','dark']) {
      enable({appearanceTheme:theme});
      assert(css(card).backgroundColor === token('--gp-bg-primary'), 'summary uses the selected page canvas');
      assert(css(header).backgroundColor === token('--gp-bg-tertiary'), 'heading uses the selected secondary surface');
      assert(css(card.querySelector('.gfbKJd')).backgroundColor === token('--gp-bg-primary'), 'cards never retain the native white surface in dark mode');
      assert(contrast(css(card.querySelector('.a8DSAf')).color,css(card).backgroundColor) >= 4.5, 'summary text is readable');
      assert(contrast(css(card.querySelector('.rjuWBc span')).color,css(card).backgroundColor) >= 4.5, 'status is readable');
      assert(css(card.querySelector('.FOBRw-I')).borderRadius === '6px', 'native action uses the shared control shape');
    }
    for (const label of ['Dismiss all','Show more','Toggle more actions menu']) card.querySelector(`[aria-label="${label}"]`).click();
    assert(dismisses===1 && expands===1 && actions===1, 'Gmail keeps all native action handlers');
    feature.stop(); assert(card.innerHTML===native && css(header).backgroundColor===color('#f0f4f9'), 'OFF restores the original banner exactly');
    const clone=card.cloneNode(true), authored=document.createElement('div'); authored.className='ii';
    authored.innerHTML='<div class="Nu tf"><div class="ae4"><div><div class="dgq5vc"></div></div></div></div>';
    authored.querySelector('.dgq5vc').append(clone); workspace.querySelector('.ae4').append(authored);
    enable(); assert(css(clone).borderRadius!=='8px' && css(clone.firstElementChild).backgroundColor===color('#f0f4f9'), 'email/body lookalikes stay untouched');
  });
  await test('expanded Happening soon footer follows the theme and its Show less control remains native', () => {
    workspace.innerHTML='<div class="Nu tf"><div class="ae4"><div><div class="dgq5vc"><div class="E22Lmb"><div class="wNSjCf"><h2 class="iqFh3e">Happening soon</h2></div><div class="L0lHNd vvhV3c"><button aria-label="Show more">+ 1 more</button></div><div class="h1hEId" style="background:#f0f4f9" hidden><div><button aria-label="Show less">Show less</button></div></div></div></div></div></div></div>';
    const card=workspace.querySelector('.E22Lmb'), more=card.querySelector('[aria-label="Show more"]'), less=card.querySelector('[aria-label="Show less"]'), footer=card.querySelector('.h1hEId');
    let opens=0,closes=0;
    more.addEventListener('click',()=>{opens++;footer.hidden=false;more.parentElement.hidden=true;});
    less.addEventListener('click',()=>{closes++;footer.hidden=true;more.parentElement.hidden=false;});
    const native=card.innerHTML;
    for(const appearanceTheme of ['dark','light']) {
      enable({appearanceTheme});more.click();
      assert(css(footer).backgroundColor===token('--gp-bg-primary'),'expanded footer shares the card canvas');
      assert(contrast(css(less).color,css(footer).backgroundColor)>=4.5,'Show less text is readable');
      less.click();assert(footer.hidden&&!more.parentElement.hidden,'native collapse restores Show more');
    }
    assert(opens===2&&closes===2,'native disclosure handlers run once per action');
    feature.stop();assert(card.innerHTML===native&&css(footer).backgroundColor===color('#f0f4f9'),'OFF restores expanded native surface and markup');
  });
  await test('native delivery summaries and calendar icons stay readable without recoloring label badges or email content', () => {
    const node=row({label:'Projects/Example'}), summary=document.createElement('div');summary.className='by1 bFv bu7';
    summary.innerHTML='<div class="bFw"><svg width="16" height="16" fill="none" style="color:#1f1f1f"><path fill="#1f1f1f" d="M2 2h12v12H2z"/></svg></div><div style="color:#1f1f1f">Expected by: <span style="color:#1f1f1f">Fri, Oct 30</span></div>';
    node.querySelector('.xT').append(summary);
    const image=document.createElement('img');image.className='xL';image.width=16;image.height=16;
    image.src='data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"%3E%3Cpath fill="black" d="M2 2h12v12H2z"/%3E%3C/svg%3E';node.querySelector('td.yf').append(image);
    const badge=node.querySelector('.at'), label=node.querySelector('.av'), nativeSummary=summary.innerHTML;
    const labelColors=[css(badge).backgroundColor,css(label).color].join('|');
    const probe=document.createElement('span');workspace.append(probe);
    const authored=document.createElement('div');authored.className='ii';authored.innerHTML='<div class="xS" role="link"><div class="xT"></div></div>';
    const fake=summary.cloneNode(true);authored.querySelector('.xT').append(fake);node.querySelector('td.a4W').append(authored);
    for(const appearanceTheme of ['dark','light']) for(const accentColor of appAccents()) {
      enable({appearanceTheme,accentColor});
      for(const state of ['normal','open','checked']) {
        node.classList.toggle('aps',state==='open');node.querySelector('[role="checkbox"]').setAttribute('aria-checked',String(state==='checked'));
        const selected=state!=='normal', foreground=selected?'--gp-accent-contrast':'--gp-text-secondary';
        const filter=selected?'--gp-selected-icon-filter':'--gp-icon-filter';probe.style.filter=`var(${filter})`;
        assert(css(summary.lastElementChild).color===token(foreground)&&css(summary.querySelector('span')).color===token(foreground),'summary descendants use the selected row palette');
        assert(contrast(css(summary.lastElementChild).color,css(node).backgroundColor)>=(selected&&accentColor==='blue'?4:4.5),'summary text contrast');
        assert(css(summary.querySelector('svg')).filter===css(probe).filter&&css(image).filter===css(probe).filter,'delivery and calendar icon paint follows the row palette');
        assert(css(summary.querySelector('svg')).fill==='none','outlined SVG geometry is preserved');
        assert([css(badge).backgroundColor,css(label).color].join('|')===labelColors,'native colored label badge remains intact');
        assert(css(fake.lastElementChild).color===color('#1f1f1f'),'authored lookalike is excluded');
      }
      node.classList.remove('aps');node.querySelector('[role="checkbox"]').setAttribute('aria-checked','false');
    }
    feature.stop();assert(summary.innerHTML===nativeSummary&&css(summary.lastElementChild).color===color('#1f1f1f')&&css(image).filter==='none','OFF restores native summary text and icon styles');
  });
  function appAccents(){return GmailPro.settings.choices.accentColor;}
  await test('reading chrome icons share the palette while colored states, disabled controls and authored content retain their paint', () => {
    workspace.innerHTML = `<style>
      .native-icon-paint .bHI, .native-icon-paint .FqWqLc { color:#444746; fill:currentColor; }
      .native-icon-paint .ncplXc { opacity:.7; }
      .native-icon-paint button:disabled { opacity:.38; }
      .native-icon-paint img.gW { opacity:.54; }
      .native-icon-paint .T-KT::before { content:""; display:block; width:20px; height:20px; background:linear-gradient(black,black); opacity:.71; }
    </style><div class="iY native-icon-paint"><div class="V8djrc"><div class="bHJ"><button class="bHI" aria-label="Print all"><svg width="20" height="20"><path d="M2 2h16v16H2z"/></svg></button><button class="bHI" disabled><svg width="20" height="20"><path d="M2 2h16v16H2z"/></svg></button></div><div class="ha"><h2 data-thread-perm-id="synthetic" data-legacy-thread-id="synthetic">Synthetic subject</h2><button class="FqWqLc ncplXc"><svg width="20" height="20"><path d="M2 2h16v16H2z"/></svg></button><button class="FqWqLc bns important" style="color:#f4b400"><svg width="20" height="20"><path d="M2 2h16v16H2z"/></svg></button></div></div><div class="gE"><button><svg width="20" height="20"><path d="M2 2h16v16H2z"/></svg></button><img class="gW" alt="Attachments"><div class="zd" role="checkbox" aria-checked="false"><span class="T-KT"></span></div><div class="zd" role="checkbox" aria-checked="true"><span class="T-KT"></span></div></div><div class="ii"><div class="a3s"><div class="bHJ"><button class="bHI"><svg width="20" height="20"><path d="M2 2h16v16H2z"/></svg></button></div></div></div><div role="menu"><button class="bHI">Native menu</button></div></div>`;
    const shell=workspace.querySelector('.iY'), neutral=[shell.querySelector('.bHI svg'),shell.querySelector('.ncplXc svg'),shell.querySelector('.gE button svg')];
    const attachment=shell.querySelector('img.gW'), star=shell.querySelector('[aria-checked="false"] .T-KT'), coloredStar=shell.querySelector('[aria-checked="true"] .T-KT');
    const protectedNodes=[shell.querySelector('.important'),shell.querySelector('.important svg'),shell.querySelector('.a3s .bHI svg'),shell.querySelector('[role="menu"] button'),shell.querySelector('button:disabled')];
    const snapshot=()=>JSON.stringify(protectedNodes.map(n=>[css(n).color,css(n).fill,css(n).opacity,css(n).filter]).concat([[getComputedStyle(coloredStar,'::before').filter,getComputedStyle(coloredStar,'::before').opacity]]));
    const native=snapshot(), html=shell.innerHTML, original=neutral.map(n=>[css(n).fill,css(n).filter]);
    const probe=document.createElement('span');probe.style.filter='var(--gp-icon-filter)';workspace.append(probe);
    for (const appearanceTheme of ['dark','light','dark']) {
      enable({appearanceTheme});
      assert(neutral.every(n=>css(n).fill===token('--gp-text-secondary')&&css(n).filter==='none'), 'print, importance and header SVGs share the exact theme foreground without double filtering');
      assert(css(shell.querySelector('.ncplXc')).opacity==='1','available importance control is not dimmed');
      assert(css(attachment).filter===css(probe).filter&&css(attachment).opacity==='1','attachment bitmap follows the shared icon palette at full opacity');
      assert(getComputedStyle(star,'::before').filter===css(probe).filter&&getComputedStyle(star,'::before').opacity==='1','unselected star artwork follows the theme');
      assert(snapshot()===native,'important/starred colors, disabled opacity, authored content and menus keep native paint');
      assert(shell.innerHTML===html,'native nodes and attributes stay intact');
    }
    feature.stop();
    assert(neutral.every((n,i)=>JSON.stringify([css(n).fill,css(n).filter])===JSON.stringify(original[i]))&&css(attachment).opacity==='0.54'&&css(attachment).filter==='none','OFF restores native icon paint');
  });
  await test('system folders and custom labels share the Inbox tag silhouette without changing disclosure arrows or label text', () => {
    workspace.innerHTML='<nav role="navigation" class="aeN WR"><div class="aim" data-gp-inbox><div class="TO nZ"><div class="TN"><div class="KCRnif"><svg width="20" height="20"><path d="M1 1h18v18H1z"/></svg></div><div class="aio"><a class="n0" href="#inbox">Inbox</a></div></div></div></div><div class="aim"><div class="TO"><div class="TN"><div class="KCRnif"><svg width="20" height="20"><path d="M10 1l3 5 6 1-4 5 1 7-6-3-6 3 1-7-4-5 6-1z"/></svg></div><div class="aio"><a class="n0" href="#starred">Starred</a></div></div></div></div><div class="aim"><div class="TO"><div class="TN"><div class="TH" role="link" aria-label="Expand label: Example"><svg width="12" height="12"><path d="M3 1l5 5-5 5"/></svg></div><div class="qj aEe" style="width:20px;height:20px"></div><div class="aio"><a class="n0" href="#label/Example">Example</a></div></div></div></div></nav>';
    const nav=workspace.querySelector('nav'), svg=nav.querySelector('a[href="#starred"]').closest('.TN').querySelector('svg');
    const marker=nav.querySelector('.qj'), arrow=nav.querySelector('.TH svg'), box=rect(svg);
    // Classic Gmail's system symbols use PNG background images, unlike masked
    // custom-label icons. Clearing only the mask leaves white artwork in a tag.
    marker.style.backgroundImage='linear-gradient(white,black)';
    svg.style.color='#c4c7c5'; svg.style.opacity='.7';
    const native=nav.innerHTML, nativeImage=css(marker).backgroundImage;
    for(const appearanceTheme of ['dark','light']) {
      enable({appearanceTheme});
      const shape=getComputedStyle(nav.querySelector('[data-gp-inbox] .TN'),'::before').clipPath;
      assert(css(svg).clipPath===shape&&css(marker).clipPath===shape,'all native glyph types share the filled tag');
      assert(css(marker).backgroundImage==='none','native bitmap artwork cannot remain inside the filled tag');
      assert(css(svg.firstElementChild).visibility==='hidden'&&css(arrow.firstElementChild).visibility==='visible','replace only the decorative mailbox symbol');
      assert(rect(svg).width===box.width&&rect(svg).height===box.height,'native symbol slot and hierarchy stay stable');
      assert(css(svg).backgroundColor===token('--gp-text-secondary')&&css(svg).opacity==='1','neutral tag follows the readable theme color at full opacity');
      svg.closest('.TO').classList.add('nZ');
      assert(css(svg).backgroundColor===token('--gp-label-accent'),'selected tag follows the chosen accent');svg.closest('.TO').classList.remove('nZ');
    }
    feature.stop();assert(css(marker).backgroundImage===nativeImage,'OFF restores native bitmap artwork');
    assert(nav.innerHTML===native&&css(svg.firstElementChild).visibility==='visible'&&css(svg).clipPath==='none'&&css(svg).opacity==='0.7','OFF restores each native icon and every label');
  });
  await test('integrated app rail icons and labels remain readable in both themes without resizing or recoloring badges', () => {
    const rail = document.createElement('nav'); rail.className = 'WR'; rail.setAttribute('role','navigation');
    rail.style.cssText = 'width:68px;min-width:68px';
    rail.innerHTML = '<div class="Xa"><div class="V6 CL W9" role="link" aria-label="Mail" style="color:white"><span class="XU aH7" style="color:white;background:#b3261e">99+</span></div><div class="apW" role="heading" style="color:white">Mail</div></div>';
    workspace.append(rail); const original = rail.innerHTML;
    const probe = document.createElement('span'); probe.style.filter = 'var(--gp-icon-filter)'; workspace.append(probe);
    for (const appearanceTheme of ['light','dark','light']) {
      enable({appearanceTheme});
      const link=rail.querySelector('.V6'), label=rail.querySelector('.apW'), badge=rail.querySelector('.XU');
      assert(contrast(css(label).color, token('--gp-sidebar-bg')) >= 4.5, 'rail labels override the native white palette');
      assert(getComputedStyle(link,'::before').filter === css(probe).filter, 'only the native pseudo icon receives the theme filter');
      assert(css(badge).color === color('white') && css(badge).backgroundColor === color('#b3261e'), 'badge colors remain native');
      assert(rect(rail).width === 68 && rail.innerHTML === original, 'native rail sizing, markup and link handlers remain intact');
    }
    feature.stop();
    assert(css(rail.querySelector('.apW')).color === color('white') && getComputedStyle(rail.querySelector('.V6'),'::before').filter === 'none', 'OFF restores native rail colors and icon filter');
  });
  await test('native masked label markers have readable neutral and selected fills while custom colors stay intact', () => {
    workspace.innerHTML='<style>.native-glyphs .qj { background-color:white;opacity:.71;mask-image:linear-gradient(black,black);width:14px;height:14px; }</style><nav role="navigation" class="native-glyphs"><div class="aim"><div class="TO"><div class="TN"><div class="qj aEe"></div><a href="#label/Demo">Demo</a></div></div></div><div class="aim"><div class="TO"><div class="TN"><div class="qj aEe" style="background-color:#ff9900"></div><a href="#label/Colored">Colored</a></div></div></div></nav>';
    const marker=workspace.querySelector('.qj'), selected=marker.closest('.TO'), custom=workspace.querySelector('[style*="background-color"]');
    for (const appearanceTheme of ['light','dark']) {
      enable({appearanceTheme});
      assert(css(marker).backgroundColor===token('--gp-text-secondary')&&css(marker).opacity==='1','neutral masked glyph uses a full-opacity theme fill');
      assert(contrast(css(marker).backgroundColor,token('--gp-sidebar-bg'))>=3,'neutral marker has graphical contrast');
      selected.classList.add('nZ');
      assert(css(marker).backgroundColor===token('--gp-label-accent')&&contrast(css(marker).backgroundColor,css(selected).backgroundColor)>=3,'selected marker remains visible');
      assert(css(custom).backgroundColor===color('#ff9900'),'explicit Gmail label color preserved');
      selected.classList.remove('nZ');
    }
    feature.stop();assert(css(marker).backgroundColor===color('white')&&css(marker).opacity==='0.71','OFF restores native glyph fill and opacity');
  });
  await test("off has no styles or DOM changes; on includes existing two-line list", () => {
    const node = row(), html = workspace.innerHTML, baseline = css(node).backgroundColor;
    feature.start({...GmailPro.settings.defaults,appleMailModeEnabled:false,appleMailMessageListEnabled:false});
    assert(css(node).display === "flex" && css(node).backgroundColor === baseline, "native layout");
    enable(); assert(css(node).display === "grid", "existing grid reused");
    feature.stop(); assert(css(node).display === "flex" && css(node).backgroundColor === baseline && workspace.innerHTML === html, "exact restoration");
    assert(!root.hasAttribute("data-gp-theme") && !root.hasAttribute("data-gp-accent"), "root cleaned");
  });
  await test("chrome stays readable when Gmail's native palette differs from the selected theme", () => {
    workspace.innerHTML = `<div gh="tm"><div role="button" class="amH"><span class="Dj"><span class="ts">1–9 of 9</span></span></div><div role="button"><svg class="T-I-J3"><path d="M0 0h10v10H0z"/></svg><span class="T-Jo" role="checkbox"></span></div></div>
      <form role="search"><button type="button"><svg><path d="M0 0h10v10H0z"/></svg></button></form>
      <nav role="navigation"><span class="aAv">Mailboxes</span><div class="aAu" role="button" aria-label="Create new label"></div><div class="TN"><div class="TH aih" role="link"></div><div class="aio"><span class="nU">Native label</span></div><div class="nL"><div class="pM"></div></div></div></nav>
      <div class="apa"><div class="apb">No conversations selected</div></div>
      <div class="iY"><h2 data-thread-perm-id="fixture" data-legacy-thread-id="fixture">Subject</h2><div class="gE"><span class="hb">To: Fixture <span class="g2">Metadata</span></span></div></div>`;
    const text = [...workspace.querySelectorAll('.Dj, .ts, .aAv, .aio, .nU, .apb, .hb')];
    const glyphs = [...workspace.querySelectorAll('[gh="tm"] svg, [gh="tm"] .T-Jo, [role="search"] svg, .aAu, .TH, .pM')];
    const probe = document.createElement('span'); probe.style.filter = 'var(--gp-icon-filter)'; workspace.append(probe);
    for (const nativeColor of ['white', 'black']) {
      for (const node of [...text, ...glyphs]) node.style.color = nativeColor;
      for (const glyph of glyphs) glyph.style.fill = nativeColor;
      for (const theme of ['light', 'dark']) {
        enable({appearanceTheme:theme});
        for (const node of text) assert(contrast(css(node).color, token('--gp-bg-secondary')) >= 4.5, `${theme} chrome text overrides native ${nativeColor}`);
        for (const glyph of glyphs) assert(css(glyph).filter === css(probe).filter, `${theme} native glyph uses the selected theme filter`);
        assert(contrast(css(workspace.querySelector('.hb .g2')).color, token('--gp-bg-primary')) >= 4.5, `${theme} recipient metadata remains readable`);
      }
    }
    feature.stop();
    assert(css(workspace.querySelector('.aAv')).color === color('black') && css(workspace.querySelector('.TH')).filter === 'none', 'mode OFF restores native text and icons');
  });
  await test("split-pane divider follows the theme while preserving the native drag handle", () => {
    workspace.innerHTML = '<div gh="tl" class="Nm"><div class="Nt" style="width:8px;height:200px;border:2px solid red;background:yellow"></div></div>';
    const handle = workspace.querySelector('.Nt'), baseline = {width:rect(handle).width, height:rect(handle).height, background:css(handle).backgroundImage};
    for (const theme of ['light', 'dark', 'light']) {
      enable({appearanceTheme:theme});
      const shade = theme === 'light' ? 'rgb(227, 229, 231)' : 'rgb(17, 21, 23)';
      assert(css(handle).backgroundImage === `linear-gradient(${shade}, ${shade})`, `${theme} divider shade`);
      assert(css(handle).backgroundSize === '1px 100%', 'only one hairline is painted');
      assert(rect(handle).width === baseline.width && rect(handle).height === baseline.height, 'native drag dimensions stay intact');
    }
    feature.stop(); assert(css(handle).backgroundImage === baseline.background && css(handle).borderLeftColor === 'rgb(255, 0, 0)', 'OFF restores native divider');
  });
  await test("empty split-pane footer keeps activity 16px from bottom and restores when OFF", () => {
    const main = document.createElement('main'); main.setAttribute('role', 'main');
    main.innerHTML = '<div class="apa" style="position:relative;height:300px"><div class="apb">No conversations selected</div><div class="apO" style="position:absolute;bottom:0;margin-bottom:32px;padding-bottom:10px"><div class="uXhw3b"><div><div class="l6"><div>Last account activity: 1 minute ago</div><span class="l8" role="link" tabindex="0">Details</span></div></div></div><div class="bp"><a>Program Policies</a><div>Powered by Google</div></div></div></div>';
    workspace.append(main);
    const pane = main.querySelector('.apa'), footer = main.querySelector('.apO');
    const activity = main.querySelector('.l6 > div'), details = main.querySelector('.l8'), policies = main.querySelector('.bp');
    const html = main.innerHTML, baseline = rect(footer).bottom;
    for (const appearanceTheme of ['dark', 'light']) {
      enable({appearanceTheme});
      assert(css(details).display === 'none' && css(policies).display === 'none', 'secondary lines hidden');
      assert(rect(activity).height > 0 && Math.abs(rect(pane).bottom - rect(activity).bottom - 16) < 1, 'activity at bottom with 16px breathing room');
    }
    feature.stop();
    assert(css(details).display !== 'none' && css(policies).display !== 'none', 'native links restored');
    assert(rect(footer).bottom === baseline && main.innerHTML === html, 'native geometry and markup restored');
  });
  await test("scroll indicators follow actual movement per pane and axis, then hide", async () => {
    const pane=document.createElement('div'); pane.className='Nu';
    pane.style.cssText='width:160px;height:100px;overflow:scroll';
    pane.innerHTML='<div style="width:500px;height:500px"></div>'; workspace.append(pane);
    const other=pane.cloneNode(true); workspace.append(other); enable();
    const size=[pane.clientWidth,pane.clientHeight].join(',');
    const mark=axis=>pane.hasAttribute('data-gp-scroll-'+axis);
    pane.dispatchEvent(new WheelEvent('wheel',{deltaY:50,bubbles:true}));
    assert(!mark('x')&&!mark('y'),'wheel intent alone does not show bars');
    pane.scrollTop=50; pane.dispatchEvent(new Event('scroll'));
    assert(mark('y')&&!mark('x')&&!other.hasAttribute('data-gp-scroll-y'),'vertical movement only reveals this pane');
    await new Promise(resolve=>setTimeout(resolve,750));
    assert(!mark('y'),'vertical thumb hides after idle');
    pane.dispatchEvent(new WheelEvent('wheel',{deltaX:50,bubbles:true}));
    pane.scrollLeft=50; pane.dispatchEvent(new Event('scroll'));
    assert(mark('x')&&!mark('y'),'horizontal movement reveals only horizontal thumb');
    assert([pane.clientWidth,pane.clientHeight].join(',')===size,'no layout change while showing bars');
    feature.stop(); assert(!mark('x')&&!mark('y'),'OFF clears active attributes and timers');
    pane.scrollTop=80; pane.dispatchEvent(new Event('scroll'));
    assert(!mark('y'),'OFF no longer tracks scrolling');
  });
  await test("scroll styling keeps the corner square and ignores authored bodies/editors", () => {
    const shell=document.createElement('div'); shell.className='nH'; shell.style.borderRadius='16px';
    const main=document.createElement('div'); main.setAttribute('role','main'); shell.append(main); workspace.append(shell);
    enable(); assert(css(shell).borderRadius==='0px','outer reading corner square');
    for (const container of [document.querySelector('.a3s'), document.querySelector('[contenteditable]')]) {
      const fake=document.createElement('div'); fake.className='Nu'; container.append(fake);
      fake.dispatchEvent(new Event('scroll'));
      assert(!fake.hasAttribute('data-gp-scroll-y')&&getComputedStyle(fake,'::-webkit-scrollbar').width!=='8px','authored scroller untouched'); fake.remove();
    }
    feature.stop(); assert(css(shell).borderRadius==='16px','native corner restored');
  });
  await test("unsplit inbox viewport themes its scrollbar track and corner in both themes", () => {
    const viewport=document.createElement('div');viewport.className='Tm';
    viewport.style.cssText='width:180px;height:100px;overflow:scroll;border-radius:16px;background:white';
    viewport.innerHTML='<main role="main" style="width:500px;height:500px"></main>';workspace.append(viewport);
    for(const appearanceTheme of ['dark','light']){
      enable({appearanceTheme});
      assert(css(viewport).borderRadius==='0px'&&css(viewport).backgroundColor===token('--gp-bg-primary'),'outer viewport has a square theme-colored canvas');
      assert(getComputedStyle(viewport,'::-webkit-scrollbar').width==='8px','unsplit native viewport gets the scrollbar rules');
      assert(getComputedStyle(viewport,'::-webkit-scrollbar-track').backgroundColor==='rgba(0, 0, 0, 0)','track does not paint a white strip');
      assert(getComputedStyle(viewport,'::-webkit-scrollbar-corner').backgroundColor===token('--gp-bg-primary'),'corner matches the theme');
      viewport.scrollTop+=20;viewport.dispatchEvent(new Event('scroll'));
      assert(viewport.hasAttribute('data-gp-scroll-y'),'unsplit viewport tracks real vertical movement');
    }
    feature.stop();assert(css(viewport).borderRadius==='16px'&&!viewport.hasAttribute('data-gp-scroll-y'),'OFF restores native viewport and clears activity');
  });
  await test("native unread class changes only the dot, not text or background", () => {
    const node = row(); enable(); const bg = css(node).backgroundColor;
    const textStyle = () => [".sender", ".bqe", ".xW span"].map(selector => { const style = css(node.querySelector(selector)); return [style.color, style.fontWeight]; });
    const readText = JSON.stringify(textStyle());
    assert(css(node.querySelector(".sender")).fontWeight === "700", "read sender bold");
    assert(css(node.querySelector(".bqe")).fontWeight === "400", "subject remains regular");
    assert(dot(node).content === "none", "read has no dot");
    node.classList.add("zE");
    assert(dot(node).content === '""' && dot(node).backgroundColor === token("--gp-accent"), "unread accent dot");
    assert(rect(node.querySelector(".yW")).left >= rect(node.querySelector(".yX")).left + 12, "dot never overlaps sender text");
    assert(JSON.stringify(textStyle()) === readText && css(node).backgroundColor === bg, "read/unread typography and background match");
    node.classList.remove("zE"); assert(dot(node).content === "none", "read clears dot synchronously");
  });
  for (const width of [320,380,560,1200]) await test(`regular conversation count remains visible in Apple Mail Mode at ${width}px`, () => {
    workspace.style.width = `${width}px`;
    const node = row({sender:'Long participant '.repeat(12),count:400,unread:true});
    for (const theme of ['light','dark']) {
      enable({appearanceTheme:theme});
      for (const selected of [false,true]) for (const unread of [false,true]) {
        node.classList.toggle('aps',selected); node.classList.toggle('zE',unread);
        const names=node.querySelector('.bA4'), count=node.querySelector('.bx0');
        assert(css(node.querySelector('.sender')).fontWeight==='700' && css(count).fontWeight==='400','sender stays bold; count stays regular');
        assert(rect(names).right<=rect(count).left && rect(count).right<=rect(node.querySelector('.yX')).right,'count has reserved space');
        assert(count.scrollWidth<=count.clientWidth && rect(count).width>0,'count untruncated');
        assert(css(count).color===css(node.querySelector('.sender')).color,'selected foreground retained');
      }
    }
  });
  await test("unread dot aligns with sender at different row sizes", () => {
    const node = row({unread:true}); enable();
    for (const height of [46, 80]) for (const width of [320, 700]) {
      workspace.style.width = `${width}px`; node.style.minHeight = `${height}px`;
      const style = dot(node), bounds = rect(node.querySelector(".yX"));
      const center = parseFloat(style.top) + parseFloat(style.height) / 2;
      assert(Math.abs(center - bounds.height / 2) <= 1, "dot vertically centered on sender line");
      assert(bounds.left + parseFloat(style.left) + parseFloat(style.width) < rect(node.querySelector(".yW")).left, "dot remains in text gutter");
    }
  });
  for (const theme of ["dark", "light"]) for (const accent of GmailPro.settings.choices.accentColor) await test(`${theme} / ${accent}: selected row, dot, neutral sidebar and palette contrast`, () => {
    const node = row({unread:true,label:"Projects/Example",attachment:true}); enable({appearanceTheme:theme,accentColor:accent});
    const badge = node.querySelector('.at'), labelText = badge.querySelector('.av');
    const labelBackground = css(badge).backgroundColor, labelForeground = css(labelText).color;
    node.classList.add("aps");
    // Keep cyan mailbox highlights in Dark and readable label shades in Light.
    // White selection text on vivid blue remains ~4:1.
    const selectionContrast = accent === "blue" ? 4 : 4.5;
    assert(css(node).backgroundColor === token("--gp-accent"), "native open row uses accent");
    assert(contrast(css(node).backgroundColor, css(node.querySelector(".bog")).color) >= selectionContrast, "subject contrast");
    assert(contrast(css(node).backgroundColor, css(node.querySelector(".xW")).color) >= selectionContrast, "date contrast");
    assert(css(badge).backgroundColor === labelBackground && css(labelText).color === labelForeground, "open label keeps native background and text colors");
    assert(contrast(css(badge).backgroundColor, css(labelText).color) >= 4.5, "label text contrasts with its own badge");
    assert(dot(node).visibility === "visible" && dot(node).backgroundColor === "rgb(255, 255, 255)" && node.classList.contains("zE"), "selected unread dot stays white until Gmail marks read");
    node.classList.remove("zE"); assert(dot(node).content === "none", "confirmed read removes selected dot");
    node.classList.add("zE"); assert(dot(node).backgroundColor === "rgb(255, 255, 255)", "manual unread restores white dot");
    const selected = document.querySelector(".TO.nZ"), link = selected.querySelector("a");
    assert(css(selected).backgroundColor === token("--gp-selection-sidebar-bg"), "neutral sidebar selection");
    assert(css(link).color === token("--gp-label-accent"), "accent mailbox text");
    assert(css(selected.querySelector("svg")).fill === token("--gp-label-accent"), "accent mailbox icon");
    if (accent === 'blue' && theme === 'light') assert(css(link).color === token('--gp-accent-ui'), 'light blue uses the readable blue shade');
    else assert(css(link).color !== token("--gp-accent") && css(link).color !== token("--gp-accent-ui"), "mailbox highlight has its own shade");
    if (accent === "blue" && theme === 'dark') assert(css(link).color === "rgb(0, 174, 255)", "dark blue retains its cyan highlight");
    else assert(contrast(css(link).color, css(selected).backgroundColor) >= 4.5, "sidebar text contrast");
    assert(css(selected.querySelector(".bsU")).color === token('--gp-sidebar-count'), "mailbox count uses the theme's readable neutral");
    assert(css(selected.querySelector(".bsU")).textShadow === 'none' && contrast(css(selected.querySelector(".bsU")).color,css(selected).backgroundColor) >= 4.5, "counts remain sharp with readable selected contrast");
    selected.classList.add("nY");
    assert(css(selected).backgroundColor === token("--gp-accent"), "drop target uses current accent");
    assert(contrast(css(link).color, css(selected).backgroundColor) >= selectionContrast, "drop label contrast");
    assert(css(selected.querySelector("svg")).fill === token("--gp-accent-contrast"), "drop icon matches foreground");
    selected.classList.remove("nY");
    node.classList.remove("aps"); assert(dot(node).visibility === "visible" && css(node).backgroundColor === token("--gp-bg-primary"), "deselect restores unread");
    assert(css(node.querySelector('.xW > span')).color === 'rgb(156, 158, 160)', 'exact date gray in both themes');
    assert(node.querySelector('.xW > span').hasAttribute('data-gmail-pro-date'), 'Apple Mail mode formats date');
    node.querySelector('[role="checkbox"]').setAttribute('aria-checked', 'true');
    assert(css(badge).backgroundColor === labelBackground && css(labelText).color === labelForeground, "checked label keeps native background and text colors");
    assert(css(node.querySelector('.xW > span')).color === token('--gp-accent-contrast'), 'checked date uses accent contrast');
    assert(dot(node).visibility === 'visible' && dot(node).backgroundColor === 'rgb(255, 255, 255)', 'checked unread dot stays visible and white');
    node.classList.remove('zE'); assert(dot(node).content === 'none', 'native read clears checked dot');
    node.classList.add('zE'); assert(dot(node).backgroundColor === 'rgb(255, 255, 255)', 'native unread restores checked white dot');
    node.classList.add('aps'); node.querySelector('[role="checkbox"]').setAttribute('aria-checked', 'false');
    assert(dot(node).visibility === 'visible' && dot(node).backgroundColor === 'rgb(255, 255, 255)', 'unchecking an open row retains white dot');
    node.classList.remove('aps');
    assert(dot(node).visibility === 'visible' && dot(node).backgroundColor === token('--gp-accent'), 'deselection restores accent dot');
  });
  await test("custom label colors survive open, checked, combined and deselected states", () => {
    const node = row({label:'Projects/Example'}), badge = node.querySelector('.at');
    // Filing badges are buttons; Gmail can supply colors on the badge and nested text.
    badge.setAttribute('role', 'button');
    badge.style.cssText = 'background:#fce8e6;color:#a50e0e';
    badge.querySelector('.av').style.color = 'inherit';
    const span = document.createElement('span'); span.textContent = 'Nested'; span.style.color = '#123456'; badge.querySelector('.av').append(span);
    const colors = () => [css(badge).backgroundColor, css(badge).color, css(badge.querySelector('.av')).color, css(span).color].join('|');
    const nativeColors = colors();
    for (const appearanceTheme of ['light', 'dark']) for (const accentColor of GmailPro.settings.choices.accentColor) {
      enable({appearanceTheme, accentColor});
      for (const [open, checked] of [[false,false], [true,false], [true,true], [false,true], [false,false]]) {
        node.classList.toggle('aps', open);
        node.querySelector('[role="checkbox"]').setAttribute('aria-checked', String(checked));
        assert(colors() === nativeColors, `${appearanceTheme}/${accentColor}: badge and nested foregrounds stay native`);
      }
    }
    feature.stop(); assert(colors() === nativeColors, 'OFF retains native badge colors');
  });
  await test("mailbox counts align right and remain intact beside long nested names", () => {
    const sidebar = document.getElementById("sidebar"), rows = sidebar.querySelectorAll(".TO");
    const count = rows[1].querySelector(".bsU"), name = rows[1].querySelector(".n0");
    const originalName = name.textContent, originalCount = count.textContent;
    try {
      enable(); name.textContent = "A very long nested mailbox name that must truncate";
      for (const width of [160, 216, 280]) for (const value of ["1", "42", "1,234", "99+"]) {
        sidebar.style.width = `${width}px`; count.textContent = value;
        assert(Math.abs(rect(count).right - rect(rows[0].querySelector(".bsU")).right) < 1, "top-level and nested counts share right edge");
        assert(rect(rows[1].querySelector(".nU")).right <= rect(count).left, "long name stays clear of count");
        assert(count.scrollWidth <= count.clientWidth && css(count).textAlign === "right", "count is untruncated and right justified");
        assert(css(count).color === token('--gp-sidebar-count'), "unselected count uses the readable theme neutral");
      }
      sidebar.classList.add("collapsed");
      assert(count.getClientRects().length === 0, "native collapsed sidebar still hides counts");
    } finally {
      sidebar.classList.remove("collapsed"); sidebar.style.width = "";
      name.textContent = originalName; count.textContent = originalCount;
    }
  });
  await test('native unread-count shadows are removed in both themes and restored on mode OFF', () => {
    const count=document.querySelector('#sidebar .bsU'), selected=count.closest('.TO');
    const originalText=count.textContent, nativeShadow=css(count).textShadow;
    assert(nativeShadow!=='none','fixture includes the native dark-theme count shadow');
    for(const appearanceTheme of ['light','dark','light']) {
      enable({appearanceTheme});
      for(const current of [false,true]) {
        selected.classList.toggle('nZ',current);
        assert(css(count).textShadow==='none','count has no native blurred shadow');
        assert(contrast(css(count).color,token(current?'--gp-selection-sidebar-bg':'--gp-sidebar-bg'))>=4.5,'count contrasts with the visible sidebar surface');
        assert(css(count).fontVariantNumeric==='tabular-nums'&&count.textContent===originalText,'native value and aligned digits retained');
      }
    }
    feature.stop();selected.classList.add('nZ');
    assert(css(count).textShadow===nativeShadow&&count.textContent===originalText,'OFF restores the native paint without altering its count');
  });
  await test("native unread updates show no number at zero and mode OFF restores count styling", () => {
    const aio = document.querySelector("#sidebar .aio"), count = aio.querySelector(".bsU");
    const original = aio.innerHTML, baseline = css(count).color;
    try {
      enable(); count.textContent = "1";
      assert(count.textContent === "1" && rect(count).width > 0, "positive unread count visible");
      count.remove(); // Gmail's native zero-unread transition.
      assert(!aio.querySelector(".bsU") && aio.textContent === "Inbox", "zero unread has no number or generated badge");
      aio.append(count); count.textContent = "";
      assert(css(count).display === "none" && rect(count).width === 0, "empty native count reserves no gap");
      count.textContent = "2";
      assert(css(count).display !== "none" && rect(count).width > 0, "new unread mail restores native count immediately");
      feature.stop();
      assert(css(count).color === baseline && count.textContent === "2", "OFF restores native style without touching Gmail's count");
    } finally { aio.innerHTML = original; }
  });
  await test("expanded sidebar fits Gmail's fixed-width label sections and restores collapsed widths", () => {
    const sidebar = document.getElementById("sidebar"), banner = document.createElement("div");
    banner.setAttribute("role", "banner");
    banner.innerHTML = '<button aria-label="Main menu" aria-expanded="true"></button>';
    const viewport = document.createElement("div"), section = document.createElement("div");
    viewport.style.cssText = "width:100%;overflow:hidden";
    section.className = "wT"; section.style.cssText = "width:240px;min-width:240px;max-width:240px";
    const fixedRow = sidebar.querySelector(".aim").cloneNode(true);
    fixedRow.querySelector(".TO").style.width = "240px";
    section.append(fixedRow); viewport.append(section); sidebar.append(viewport); document.body.append(banner);
    try {
      enable();
      if (matchMedia("(min-width:1000px)").matches) {
        assert(rect(fixedRow.querySelector(".bsU")).right <= rect(viewport).right - 10, "unread count stays inside sidebar with trailing inset");
        assert(rect(section).width <= sidebar.clientWidth, "native 240px section fits the 216px sidebar");
      }
      banner.querySelector("button").setAttribute("aria-expanded", "false");
      assert(rect(section).width === 240 && rect(fixedRow.querySelector(".TO")).width === 240, "collapsed flyout retains native widths");
      banner.querySelector("button").setAttribute("aria-expanded", "true"); feature.stop();
      assert(rect(section).width === 240 && rect(fixedRow.querySelector(".TO")).width === 240, "OFF restores original dimensions");
    } finally { banner.remove(); viewport.remove(); }
  });
  await test("list stars and importance markers hide without reserving space and restore on OFF", () => {
    const node = row(), star = node.querySelector(".apU"), importance = node.querySelector(".WA");
    const html = node.innerHTML; enable();
    assert(css(star).display === "none" && css(importance).display === "none", "both cells hidden");
    assert(rect(node.querySelector(".yX")).left <= rect(node).left + 4, "no empty control columns");
    feature.stop();
    assert(css(star).display !== "none" && css(importance).display !== "none" && node.innerHTML === html, "native controls restored unchanged");
  });
  await test("native mouse hover/focus classes do not highlight rows; selected rows stay accented", () => {
    const node = row(); enable(); const bg = css(node).backgroundColor;
    node.classList.add("aqw", "btb");
    assert(css(node).backgroundColor === bg && css(node).boxShadow === "none" && css(node).outlineStyle === "none", "no hover or pointer-following outline");
    node.classList.add("aps");
    assert(css(node).backgroundColor === token("--gp-accent"), "actual selection stays accented while hovered");
  });
  await test("native label hover chrome is suppressed without clearing mailbox selection", () => {
    enable(); const rows = document.querySelectorAll("#sidebar .TO");
    const backgrounds = [...rows].map(e => css(e).backgroundColor);
    rows.forEach(e => e.classList.add("NQ"));
    assert([...rows].every((e, i) => css(e).backgroundColor === backgrounds[i] && css(e).boxShadow === "none"), "hover retains unselected/selected backgrounds without shadows");
    rows.forEach(e => e.classList.remove("NQ"));
  });
  await test("dark main and sidebar surfaces use the requested exact background", () => {
    enable();
    assert(css(workspace).backgroundColor === "rgb(35, 41, 43)", "main is #23292B");
    assert(css(document.getElementById("sidebar")).backgroundColor === "rgb(28, 32, 33)", "sidebar is #1c2021");
  });
  await test("native label drop wrappers restore on drag exit and mode OFF", () => {
    const to = document.querySelector("#sidebar .TO"), aim = to.parentElement, tn = to.querySelector(".TN");
    for (const target of [aim, to, tn]) {
      enable(); const before = css(target).backgroundColor;
      target.classList.add("nY");
      assert(css(target).backgroundColor === token("--gp-accent"), "native target accented");
      target.classList.remove("nY");
      assert(css(target).backgroundColor === before, "drag exit restores selection");
      target.classList.add("nY"); feature.stop();
      assert(css(target).backgroundColor === "rgb(255, 255, 204)", "mode OFF restores Gmail yellow");
      target.classList.remove("nY");
    }
  });
  await test("mailbox hover hides the repeated tooltip only while targeted and mode ON", () => {
    const to = document.querySelector("#sidebar .TO"), tooltip = document.createElement("div");
    tooltip.className = "T-ays"; tooltip.textContent = "Inbox"; document.body.append(tooltip);
    to.setAttribute("data-tooltip", "Inbox");
    try {
      enable(); assert(css(tooltip).display !== "none", "other native tooltips remain available");
      to.classList.add("NQ");
      assert(css(tooltip).display === "none" && to.getAttribute("data-tooltip") === "Inbox", "hover hidden without mutating label name");
      to.classList.remove("NQ"); to.classList.add("nY");
      assert(css(tooltip).display === "none", "hidden during drag targeting");
      feature.stop(); assert(css(tooltip).display !== "none", "OFF restores tooltip");
      enable(); to.classList.remove("nY");
      assert(css(tooltip).display !== "none", "leaving label restores toolbar tooltips");
    } finally { to.classList.remove("NQ", "nY"); to.removeAttribute("data-tooltip"); tooltip.remove(); }
  });
  await test("reading selection follows Gmail instantly; keyboard focus is not selection", () => {
    const a = row({unread:true}), b = row(); enable();
    a.classList.add("aps"); a.classList.remove("aps"); b.classList.add("aps"); a.classList.add("btb");
    assert(css(b).backgroundColor === token("--gp-accent") && css(a).backgroundColor !== css(b).backgroundColor, "only current Gmail row selected");
    const gutter = a.querySelector(".PF");
    gutter.classList.add("PE");
    assert(getComputedStyle(gutter, "::before").display === "none", "native left-edge focus bar hidden");
    a.focus();
    assert(css(a).outlineStyle === "none" && css(a).boxShadow === "none", "previous focused row has no lingering border");
    b.classList.remove("aps");
    b.focus();
    assert(css(b).outlineStyle === "none" && css(b).boxShadow === "none", "deselected focused row has no border");
    assert(dot(a).visibility === "visible", "prior unread dot restored");
    a.classList.add("aps");
    assert(getComputedStyle(gutter, "::before").display === "none", "selected row also has no focus bar");
    feature.stop();
    assert(getComputedStyle(gutter, "::before").display === "block", "native gutter marker restores outside Apple Mail Mode");
  });
  await test("checkbox multiselect and native handlers remain functional", () => {
    const node = row(); const box = node.querySelector('[role="checkbox"]'); let clicks = 0;
    box.addEventListener("click", () => { clicks++; box.setAttribute("aria-checked", box.getAttribute("aria-checked") === "true" ? "false" : "true"); });
    enable(); box.click(); assert(clicks === 1 && css(node).backgroundColor === token("--gp-accent"), "checkbox selection visible");
    box.click(); assert(clicks === 2 && css(node).backgroundColor === token("--gp-bg-primary"), "uncheck restores");
  });
  await test("mailbox selection follows Gmail and nesting/counts survive", () => {
    enable(); const rows = document.querySelectorAll("#sidebar .TO");
    rows[0].classList.remove("nZ"); rows[1].classList.add("nZ");
    assert(css(rows[1]).backgroundColor === token("--gp-selection-sidebar-bg") && css(rows[0]).backgroundColor !== css(rows[1]).backgroundColor, "new mailbox selected");
    assert(css(rows[1].querySelector(".TN")).paddingLeft === "32px" && rows[1].querySelector(".bsU").textContent === "2", "nesting and count intact");
    rows[1].classList.remove("nZ"); rows[0].classList.add("nZ");
  });
  for (const width of [320, 380, 680, 1200]) await test(`compact geometry, ellipsis, stable hover metadata at ${width}px`, () => {
    workspace.style.width = `${width}px`; const node = row({sender:"A very long sender ".repeat(12),subject:"A long subject ".repeat(20),label:"Project",attachment:true}); enable();
    const h = rect(node).height; assert(h >= 44 && h <= 48, `compact row (${h})`);
    const gap = rect(node.querySelector(".a4W")).top - rect(node.querySelector(".yX")).bottom;
    assert(gap >= 0 && gap <= 2, `tight non-overlapping text lines (${gap})`);
    assert(rect(node.querySelector(".yX")).right <= rect(node.querySelector(".xW")).left, "sender date don't overlap");
    assert(node.querySelector(".bog").scrollWidth > node.querySelector(".bog").clientWidth, "subject ellipsized");
    node.classList.add("aqw");
    assert(rect(node).height === h && rect(node.querySelector('[role="toolbar"]')).width === 0, "hover toolbar hidden without height jump");
    assert(css(node.querySelector(".xW")).display !== "none" && css(node.querySelector(".yf")).display !== "none", "date and attachment stay visible");
    assert(rect(node.querySelector(".yX")).right <= rect(node.querySelector(".xW")).left, "date doesn't overlap sender on hover");
  });
  await test("checkbox column is hidden without removing native selection; OFF restores it", () => {
    const node = row(), box = node.querySelector('[role="checkbox"]'); enable();
    node.classList.add("aqw", "btb");
    assert(rect(box).width === 0 && css(box.parentElement).display === "none", "checkbox and hover effects fully hidden");
    box.setAttribute("aria-checked", "true"); assert(css(node).backgroundColor === token("--gp-accent"), "native checked state styles row");
    node.focus(); assert(node.matches(":focus-visible") && css(node).outlineStyle === "none", "row keeps keyboard focus without a border");
    node.blur(); feature.stop();
    assert(rect(box).width > 0 && rect(node.querySelector('[role="toolbar"]')).width > 0, "native controls restore on OFF");
  });
  await test("ordinary message presses reach Gmail without selection scans or scroll layout reads", () => {
    const node = row(), pane = document.createElement('div'); pane.className = 'Nu tf';
    workspace.append(pane); pane.append(node.closest('table')); enable();
    const closest = Element.prototype.closest, matches = Element.prototype.matches;
    let rowChecks = 0, scrollChecks = 0, scrollReads = 0, received = 0, pressWork;
    for (const type of ['pointerdown', 'mousedown']) node.addEventListener(type, () => received++);
    for (const property of ['scrollLeft', 'scrollTop']) {
      const descriptor = Object.getOwnPropertyDescriptor(Element.prototype, property);
      Object.defineProperty(pane, property, {configurable:true, get() { scrollReads++; return descriptor.get.call(this); }});
    }
    Element.prototype.closest = function(selector) {
      if (selector.includes('table[role="grid"]')) rowChecks++;
      return closest.call(this, selector);
    };
    Element.prototype.matches = function(selector) {
      if (selector.includes('.Tm:has(')) scrollChecks++;
      return matches.call(this, selector);
    };
    try {
      for (const target of [node.querySelector('.sender'), node.querySelector('.bog span'), node.querySelector('.PF')]) {
        for (const type of ['pointerdown', 'mousedown']) {
          const event = new MouseEvent(type, {bubbles:true,cancelable:true,button:0});
          target.dispatchEvent(event); assert(!event.defaultPrevented, 'native press remains uncanceled');
        }
      }
      pressWork = {rowChecks,scrollChecks,scrollReads}; scrollReads = 0;
      pane.dispatchEvent(new MouseEvent('pointerdown', {bubbles:true,cancelable:true,button:0}));
      assert(scrollReads === 2, 'direct scrollbar press still captures both axes');
    } finally {
      Element.prototype.closest = closest; Element.prototype.matches = matches;
      for (const property of ['scrollLeft', 'scrollTop']) delete pane[property];
    }
    result.dataset.messagePressWork = JSON.stringify(pressWork);
    assert(received === 6, 'all native press phases delivered');
    assert(Object.values(pressWork).every(count => count === 0), 'no row validation or scroll geometry on drag pickup');
  });
  await test("Ctrl/Command-click toggles native selection without opening or marking read", () => {
    const nodes = selectableRows(); let opened = 0;
    nodes.forEach(node => node.addEventListener("click", () => opened++)); enable(); enable();
    gesture(nodes[1].querySelector(".sender"), {ctrlKey:true});
    gesture(nodes[3].querySelector(".bog"), {metaKey:true});
    assert(selectedIndices(nodes) === "1,3" && opened === 0, "disjoint native selection, no open");
    assertSelectionDots(nodes);
    gesture(nodes[1], {ctrlKey:true});
    assert(selectedIndices(nodes) === "3" && nodes.every(node => node.classList.contains("zE")), "toggle off and unread preserved");
    assertSelectionDots(nodes);
    const menu = new MouseEvent("contextmenu", {bubbles:true,cancelable:true,button:2,ctrlKey:true});
    nodes[1].dispatchEvent(menu);
    assert(menu.defaultPrevented && selectedIndices(nodes) === "3", "Mac Control-click menu suppressed without double toggle");
    const rightClick = new MouseEvent("contextmenu", {bubbles:true,cancelable:true,button:2});
    nodes[1].dispatchEvent(rightClick); assert(!rightClick.defaultPrevented, "ordinary right-click preserved");
    nodes[1].dispatchEvent(new MouseEvent("pointerdown", {bubbles:true,cancelable:true,button:0,ctrlKey:true}));
    nodes[1].dispatchEvent(new MouseEvent("contextmenu", {bubbles:true,cancelable:true,button:2,ctrlKey:true}));
    assert(selectedIndices(nodes) === "1,3", "Mac sequence without a click still toggles exactly once");
    gesture(nodes[2]); assert(opened === 1, "plain click still reaches Gmail");
  });
  await test("Shift-click selects and contracts ranges; Ctrl/Command-Shift adds ranges", () => {
    const nodes = selectableRows(); enable();
    gesture(nodes[1]); gesture(nodes[4], {shiftKey:true});
    assert(selectedIndices(nodes) === "1,2,3,4", "range includes ordinary-click anchor");
    assertSelectionDots(nodes);
    gesture(nodes[2], {shiftKey:true}); assert(selectedIndices(nodes) === "1,2", "range contracts from original anchor");
    assertSelectionDots(nodes);
    gesture(nodes[0], {shiftKey:true}); assert(selectedIndices(nodes) === "0,1", "reverse range");
    gesture(nodes[4], {metaKey:true}); gesture(nodes[3], {metaKey:true,shiftKey:true});
    assert(selectedIndices(nodes) === "0,1,3,4", "additive range preserves disjoint selection");
    assertSelectionDots(nodes);
  });
  await test("Shift-click recovers safely from missing, recycled and replaced anchors", () => {
    const nodes = selectableRows(); enable();
    nodes[2].classList.add("aps"); gesture(nodes[4], {shiftKey:true});
    assert(selectedIndices(nodes) === "2,3,4", "uses open conversation without an anchor");
    gesture(nodes[0]); nodes[0].querySelector("[data-thread-id]").dataset.threadId = "recycled";
    gesture(nodes[3], {shiftKey:true}); assert(selectedIndices(nodes) === "2,3", "recycled row cannot serve as old anchor");
    workspace.replaceChildren(); const replacements = selectableRows();
    gesture(replacements[3], {shiftKey:true}); assert(selectedIndices(replacements) === "3", "replacement with no current row starts locally");
  });
  await test("modifier gestures leave controls, message bodies, unknown rows and mode OFF native", () => {
    const nodes = selectableRows(); enable();
    const button = document.createElement("button"); nodes[1].querySelector(".a4W").append(button);
    let clicks = 0; button.addEventListener("click", () => clicks++);
    gesture(button, {ctrlKey:true}); assert(clicks === 1 && selectedIndices(nodes) === "", "nested control untouched");
    nodes[2].querySelector("[data-thread-id]").removeAttribute("data-thread-id");
    gesture(nodes[2], {ctrlKey:true}); assert(selectedIndices(nodes) === "", "unknown row untouched");
    const body = document.querySelector(".a3s"); let bodyClicks = 0; const onBody = () => bodyClicks++;
    body.addEventListener("click", onBody); gesture(body, {shiftKey:true}); body.removeEventListener("click", onBody);
    assert(bodyClicks === 1, "email content untouched");
    feature.stop(); gesture(nodes[0], {ctrlKey:true}); assert(selectedIndices(nodes) === "", "disabled mode has no gesture handlers");
  });
  await test("blank list space clears native bulk selection, preview and range anchor", () => {
    const nodes = selectableRows(), pane = document.createElement("div");
    pane.className = "Nu tf"; pane.style.height = "650px";
    nodes[0].closest("table").before(pane); pane.append(nodes[0].closest("table"));
    let closed = 0;
    pane.addEventListener("keydown", event => {
      if (event.key === "u" && event.keyCode === 85) {
        closed++; nodes.forEach(node => node.classList.remove("aps"));
      }
    });
    enable(); nodes[1].classList.add("aps");
    gesture(nodes[1]); gesture(nodes[3], {metaKey:true});
    const blank = () => gesture(pane, {clientX:rect(pane).left + 10,clientY:rect(nodes[4]).bottom + 20});
    blank();
    assert(selectedIndices(nodes) === "" && closed === 1 && !nodes[1].classList.contains("aps"), "native deselection and back-to-list command");
    gesture(nodes[4], {shiftKey:true});
    assert(selectedIndices(nodes) === "4", "old range anchor cleared");
    blank(); blank(); assert(closed === 1 && selectedIndices(nodes) === "", "empty selection is idempotent");
  });
  await test("blank deselection ignores row-height gaps, controls, footer, reading pane and OFF", () => {
    const nodes = selectableRows(), pane = document.createElement("div");
    pane.className = "Nu tf"; pane.style.height = "650px";
    nodes[0].closest("table").before(pane); pane.append(nodes[0].closest("table"));
    enable(); gesture(nodes[0], {metaKey:true});
    const position = {clientX:rect(pane).left + 10,clientY:rect(nodes[4]).bottom + 20};
    gesture(pane, {...position,clientY:rect(nodes[0]).top});
    for (const html of ['<button>Control</button>', '<div role="contentinfo">Footer</div>', '<div class="Nu S3">Reading pane</div>']) {
      const holder = document.createElement("div"); holder.innerHTML = html;
      const child = holder.firstElementChild;
      (child.classList.contains("S3") ? workspace : pane).append(child);
      gesture(child, position); child.remove();
    }
    gesture(pane, {...position,shiftKey:true});
    assert(selectedIndices(nodes) === "0", "only ordinary blank-list clicks clear");
    feature.stop(); gesture(pane, position);
    assert(selectedIndices(nodes) === "0", "OFF restores native behavior");
  });
  await test("only Gmail's dedicated loading popup hides; alert and undo notifications remain", () => {
    const holder = document.createElement("div");
    holder.innerHTML = '<div class="vY"><div class="vX"><div class="vh"><div class="vZ L4XNt"><span class="v1">Loading...</span></div></div></div></div><div class="b8" role="alert"><div class="vh">Connection error <a>Retry</a></div></div><div class="bAp b8"><div class="vh">Archived <a>Undo</a></div></div>';
    document.body.append(holder);
    try {
      enable(); assert(css(holder.querySelector(".vX")).display === "none", "loading hidden");
      assert([...holder.querySelectorAll(".b8")].every(node => css(node).display !== "none"), "alerts and undo intact");
      feature.stop(); assert(css(holder.querySelector(".vX")).display !== "none", "loading restored OFF");
    } finally { holder.remove(); }
  });
  await test("SPA replacement receives styles before paint without per-row listeners", async () => {
    enable(); row().closest("table").remove(); const next = row({unread:true}); next.classList.add("aps");
    await new Promise(resolve => requestAnimationFrame(resolve));
    assert(css(next).display === "grid" && css(next).backgroundColor === token("--gp-accent"), "replacement styled before paint");
  });
  await test('navigation lookalikes inside protected documents retain native styles', () => {
    const inners=[];
    for (const [name,value] of [['class','ii'],['class','a3s'],['contenteditable','true'],['role','region'],['role','dialog'],['role','menu'],['role','listbox']]) {
      const wrapper=document.createElement('div'); wrapper.setAttribute(name,value);
      wrapper.innerHTML='<div role="navigation"><div class="TN">Synthetic navigation</div></div>'; workspace.append(wrapper);
      const node=wrapper.querySelector('.TN'); inners.push([node, css(node).fontSize, css(node).color]);
    }
    enable(); assert(inners.every(([node,size,color]) => css(node).fontSize===size && css(node).color===color), 'nested navigation is excluded');
  });
  for (const appearanceTheme of ['dark', 'light']) await test(`${appearanceTheme}: newly sent messages get a light canvas before identity metadata arrives`, () => {
    enable({appearanceTheme});
    const envelope = document.createElement('div');
    envelope.innerHTML = '<div class="gs"><div><div class="ii gt"><div class="a3s"><p>Newly sent BCC copy</p><table style="background:#122333;color:white"><tbody><tr><td>Authored table</td></tr></tbody></table></div></div></div></div>';
    workspace.append(envelope);
    const wrapper = envelope.querySelector('.ii'), body = wrapper.firstElementChild, table = body.querySelector('table');
    const html = body.innerHTML;
    const assertCanvas = () => {
      assert(css(wrapper).backgroundColor === 'rgb(255, 255, 255)', 'white canvas without refresh');
      assert(css(body.querySelector('p')).color === token('--gp-document-text'), 'transparent text stays readable');
      assert(css(table).backgroundColor === 'rgb(18, 35, 51)' && css(table).color === 'rgb(255, 255, 255)', 'authored colors retained');
      assert(body.innerHTML === html, 'outgoing message HTML untouched');
    };
    assertCanvas(); // No list role, message IDs or expanded-state metadata yet.
    envelope.setAttribute('data-message-id', 'synthetic-sent'); assertCanvas();
    envelope.setAttribute('data-legacy-message-id', 'synthetic-legacy'); assertCanvas();
    const list = document.createElement('div'); list.setAttribute('role', 'list');
    workspace.append(list); list.append(envelope); assertCanvas();
    envelope.remove(); list.append(envelope); assertCanvas(); // Native SPA reinsertion.
    feature.stop(); assert(css(wrapper).backgroundColor === 'rgba(0, 0, 0, 0)', 'mode OFF restores native canvas');
    enable({appearanceTheme}); assertCanvas();
    root.setAttribute('data-darkreader-mode', 'dynamic');
    try { assert(css(wrapper).backgroundColor === 'rgba(0, 0, 0, 0)', 'Dark Reader retains canvas ownership'); }
    finally { root.removeAttribute('data-darkreader-mode'); }
    assertCanvas();
  });
  await test('document canvas excludes authored lookalikes, composers and native popups', () => {
    const wrappers = [];
    for (const boundary of ['class="ii"', 'class="a3s"', 'contenteditable="true"', 'contenteditable="plaintext-only"', 'role="region"', 'role="dialog"', 'role="menu"', 'role="listbox"']) {
      const holder = document.createElement('div'); holder.innerHTML = `<div ${boundary}><div class="ii"><div class="a3s" style="color:#123456">Protected content</div></div></div>`;
      workspace.append(holder); wrappers.push(holder.querySelector('.ii:has(> .a3s)'));
    }
    const form = document.createElement('form'); form.innerHTML = '<div class="ii"><div class="a3s">Compose form</div></div>';
    workspace.append(form); wrappers.push(form.firstElementChild);
    const editor = document.createElement('div'); editor.className = 'ii'; editor.contentEditable = 'true'; editor.innerHTML = '<div class="a3s">Editable wrapper</div>';
    workspace.append(editor); wrappers.push(editor);
    const before = wrappers.map(node => [css(node).backgroundColor, css(node).color, node.innerHTML]);
    enable();
    assert(wrappers.every((node, index) => JSON.stringify([css(node).backgroundColor, css(node).color, node.innerHTML]) === JSON.stringify(before[index])), 'protected wrappers stay native');
  });
  await test("message HTML and editor formatting stay byte-for-byte and visually unchanged", () => {
    const nodes = [...document.querySelectorAll(".ii > .a3s, .a3s *, [contenteditable], [contenteditable] *")];
    const snapshot = () => nodes.map(e => ({html:e.innerHTML,font:css(e).font,color:css(e).color,bg:css(e).backgroundColor,filter:css(e).filter}));
    const before = JSON.stringify(snapshot()); enable();
    assert(JSON.stringify(snapshot()) === before, "read documents and editor formatting unchanged");
    assert(css(document.querySelector(".ii")).backgroundColor === token("--gp-document-bg"), "transparent email gets light canvas");
    feature.update({accentColor:"yellow",appearanceTheme:"light"});
    assert(JSON.stringify(snapshot()) === before, "theme changes don't change formatting");
  });
  await test("external Dark Reader retains ownership of its document canvas", () => {
    const wrapper = document.querySelector(".ii"), before = css(wrapper).backgroundColor;
    root.setAttribute("data-darkreader-mode", "dynamic"); enable();
    assert(css(wrapper).backgroundColor === before, "external canvas left alone");
    root.removeAttribute("data-darkreader-mode");
  });
  await test("legacy list preference remains independent of master mode", () => {
    const node = row(); GmailPro.messageList.start({appleMailMessageListEnabled:true}); enable();
    feature.update({appleMailModeEnabled:false,appleMailMessageListEnabled:true}); GmailPro.appearance.stop();
    assert(css(node).display === "grid", "standalone list preference retained");
    GmailPro.messageList.stop(); assert(css(node).display === "flex", "all visual overrides removed");
  });
  await test("follow-system resolves live OS preference", () => {
    enable({appearanceTheme:"system"});
    assert(root.dataset.gpTheme === (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"), "system theme resolved");
  });
  const flush = () => new Promise(resolve => requestAnimationFrame(resolve));
  const appearanceSnapshot = node => JSON.stringify([node, ...node.querySelectorAll('*')].map(element => {
    const style = css(element);
    return [style.color,style.backgroundColor,style.font,style.border,style.padding,style.margin,style.boxShadow,style.borderRadius,style.filter];
  }));
  for (const kind of ['inline','floating','minimized','fullscreen']) await test(kind + ' composer chrome remains exactly native across themes', () => {
    const composer = document.createElement('div'); composer.setAttribute('role', kind === 'inline' ? 'region' : 'dialog');
    composer.innerHTML = '<div class="aYF aZ aoI">Native title</div><form><input type="hidden" name="composeid"><div class="gE ao9 aia">From / To / Cc / Bcc <input role="combobox"></div><input name="subjectbox"></form><div contenteditable="true">Body and signature</div><div class="Nu"><button>Formatting</button><button>Send</button><button>Attachments</button></div>';
    workspace.append(composer);
    const before = appearanceSnapshot(composer);
    for (const appearanceTheme of ['dark','light','system']) {
      enable({appearanceTheme});
      assert(appearanceSnapshot(composer) === before, 'entire composer surface unchanged in ' + appearanceTheme);
    }
  });
  for (const role of ['menu','listbox','dialog']) await test(role + ' stays native detached, nested, and reused across themes', async () => {
    const popup = document.createElement('div'); popup.setAttribute('role',role);
    popup.innerHTML = '<div role="menuitem" class="gE">Native item <button>More</button></div>';
    document.body.append(popup); const before = appearanceSnapshot(popup);
    try {
      for (const appearanceTheme of ['dark','light','system']) {
        enable({appearanceTheme}); await flush();
        assert(appearanceSnapshot(popup) === before, 'detached popup unchanged');
        workspace.append(popup); await flush();
        assert(appearanceSnapshot(popup) === before, 'nested popup unchanged');
        popup.hidden = true; popup.hidden = false; popup.firstElementChild.click();
        assert(!popup.hasAttribute('data-gp-chrome-popup') && !popup.hasAttribute('data-gp-native-popup'), 'no ownership bookkeeping');
        document.body.append(popup);
      }
    } finally { popup.remove(); }
  });
  const failures = reports.filter(line => line.startsWith("FAIL")).length;
  result.textContent = `${reports.join("\n")}\n\n${reports.length - failures}/${reports.length} checks passed.`;
  result.dataset.failures = String(failures);
})();
