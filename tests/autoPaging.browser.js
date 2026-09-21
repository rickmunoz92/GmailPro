(async () => {
  "use strict";
  const feature = GmailPro.autoPaging, output = document.getElementById("results"), reports = [];
  const assert = (value, message) => { if (!value) throw new Error(message); };
  const settle = async () => { for (let i = 0; i < 6; i++) await new Promise(requestAnimationFrame); };
  const make = (tag, attrs = {}) => {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
    return node;
  };
  function fixture({ size = 7, first = 1, search = true } = {}) {
    document.activeElement?.blur();
    const workspace = document.getElementById("workspace"); workspace.replaceChildren();
    document.documentElement.classList.add("gmail-pro-apple-mail-mode");
    history.replaceState(null, "", search ? "#search/in%3Atrash" : "#inbox");
    const pager = make("div", { class: "Di" });
    const counter = make("div", { role: "button", "aria-label": "Show more messages" });
    const numbers = [make("span", { class: "ts" }), make("span", { class: "ts" })];
    counter.append(numbers[0], "–", numbers[1], " of many");
    const newer = make("div", { role: "button", "aria-label": search ? "Previous results" : "Newer" });
    const older = make("div", { role: "button", "aria-label": search ? "Next results" : "Older" });
    newer.textContent = "Previous"; older.textContent = "Next"; pager.append(counter, newer, older);
    const panes = make("div", { class: "panes" }), list = make("div", { class: "Nu tf", tabindex: "0" }), reading = make("div", { class: "Nu S3" });
    const table = make("table", { role: "grid" }), body = make("tbody"); table.append(body); list.append(table); panes.append(list, reading); workspace.append(pager, panes);
    function render(start = first, count = size) {
      body.replaceChildren();
      for (let i = start; i < start + count; i++) {
        const row = GmailProTestRow({ sender: "Synthetic sender", subject: "Synthetic subject" }), temporary = row.closest("table");
        row.querySelector("[data-thread-id]").setAttribute("data-thread-id", `synthetic-${i}`);
        row.querySelector("[data-thread-id]").setAttribute("data-legacy-thread-id", `legacy-${i}`);
        body.append(row); temporary.remove();
      }
      numbers[0].textContent = String(start); numbers[1].textContent = String(start + count - 1);
      newer.setAttribute("aria-disabled", String(start === 1));
    }
    render();
    let clicks = 0, previousClicks = 0, onPage = () => { render(Number(numbers[1].textContent) + 1); };
    let onPrevious = () => { render(Math.max(1, Number(numbers[0].textContent) - size)); };
    const phases = [];
    for (const phase of ["mousedown", "mouseup", "click"]) older.addEventListener(phase, () => phases.push(phase));
    older.addEventListener("click", () => { clicks++; onPage(); });
    newer.addEventListener("click", () => { previousClicks++; onPrevious(); });
    return { workspace, pager, counter, newer, older, list, reading, table, body, numbers, render, phases,
      clicks: () => clicks, previousClicks: () => previousClicks, onPage: fn => { onPage = fn; }, onPrevious: fn => { onPrevious = fn; } };
  }
  let time = 1000;
  const realNow = performance.now.bind(performance);
  Object.defineProperty(performance, "now", { configurable: true, value: () => time });
  const tick = (ms = 110) => { time += ms; };
  const begin = () => feature.start({ autoPagingEnabled: true, appleMailModeEnabled: true });
  const wheel = (target, deltaY = 40, deltaMode = 0) => target.dispatchEvent(new WheelEvent("wheel", { bubbles: true, deltaY, deltaMode }));
  const bottom = async f => { f.list.scrollTop = f.list.scrollHeight; await settle(); };
  const arrive = async (f, direction = 1) => {
    f.list.scrollTop = direction > 0 ? f.list.scrollHeight : 0; await settle(); wheel(f.list, direction * 40); await settle();
  };
  const hold = async (f, direction = 1) => {
    for (let i = 0; i < 10; i++) { tick(); wheel(f.list, direction * 40); }
    await settle();
  };
  const advance = async (f, direction = 1) => {
    await arrive(f, direction); document.querySelector('.gmail-pro-page-edge button')?.click(); await settle();
  };
  const notice = () => document.querySelector('[data-gmail-pro-auto-paging]');
  const hint = () => document.querySelector('.gmail-pro-page-edge');
  async function test(name, run) {
    try { await run(); reports.push(`PASS ${name}`); }
    catch (error) { reports.push(`FAIL ${name}: ${error.message}`); }
    feature.stop(); output.textContent = reports.join("\n");
  }
  await test("disabled settings perform no paging work", async () => {
    const f = fixture(); feature.start(); await arrive(f); await hold(f); assert(!hint() && f.clicks() === 0, "off");
    feature.update({ autoPagingEnabled: true, appleMailModeEnabled: false }); await arrive(f); await hold(f); assert(!hint() && f.clicks() === 0, "appearance mode required");
  });
  await test("startup, programmatic scrolling and resize cannot page", async () => {
    const f = fixture(); begin(); await bottom(f); window.dispatchEvent(new Event("resize")); await settle(); assert(!hint() && f.clicks() === 0, "no input");
  });
  await test("arriving at the edge gives a choice without loading", async () => {
    const f = fixture(); begin(); await arrive(f); tick(2000); await settle();
    assert(f.clicks() === 0 && hint()?.textContent.includes("Keep scrolling"), "no dwell-triggered load");
    assert(hint().querySelector('button').textContent.includes("Next page"), "explicit alternative");
  });
  await test("one huge flick cannot skip a page", async () => {
    const f = fixture(); begin(); await arrive(f); tick(800); wheel(f.list, 10000); await settle(); assert(f.clicks() === 0, "one event is insufficient");
  });
  await test("sustained overscroll fills the indicator and loads once", async () => {
    const f = fixture(); begin(); await arrive(f); tick(); wheel(f.list); tick(300); wheel(f.list);
    const transform = hint().querySelector('.gmail-pro-page-progress > div').style.transform;
    assert(transform !== "scaleX(0)" && f.clicks() === 0, "partial progress");
    await hold(f); assert(f.clicks() === 1 && f.numbers[0].textContent === "8" && f.list.scrollTop === 0 && !notice(), "one settled page");
  });
  await test("releasing the gesture cancels progress without loading", async () => {
    const f = fixture(); begin(); await arrive(f); tick(); wheel(f.list); tick(300); wheel(f.list);
    await new Promise(resolve => setTimeout(resolve, 270)); tick(1500); wheel(f.list); await settle();
    assert(f.clicks() === 0 && hint().querySelector('.gmail-pro-page-progress > div').style.transform === "scaleX(0)", "fresh hold required after release");
  });
  await test("tiny decaying momentum cannot complete a hold", async () => {
    const f = fixture(); begin(); await arrive(f);
    for (let i = 0; i < 30; i++) { tick(100); wheel(f.list, 1); }
    await settle(); assert(f.clicks() === 0, "tiny tail ignored");
  });
  await test("leaving the edge or reversing direction clears progress", async () => {
    const f = fixture(); begin(); await arrive(f); tick(); wheel(f.list); f.list.scrollTop = 10; f.list.dispatchEvent(new Event("scroll")); await settle();
    assert(!hint() && f.clicks() === 0, "left edge"); await arrive(f); wheel(f.list, -40); await settle(); assert(!hint() && f.clicks() === 0, "reversed");
  });
  await test("the explicit edge button loads once and retains no old rows", async () => {
    const f = fixture(); const originals = [...f.body.children]; begin(); await advance(f);
    assert(f.clicks() === 1 && f.phases.join() === "mousedown,mouseup,click" && f.list.scrollTop === 0, "native gesture");
    assert(originals.every(row => !row.isConnected) && f.workspace.querySelectorAll('table[role="grid"]').length === 1, "native replacement only");
  });
  await test("a native state change during mousedown cannot truncate mouseup/click", async () => {
    const f = fixture(); f.older.addEventListener('mousedown', () => { f.older.setAttribute('aria-disabled', 'true'); window.dispatchEvent(new PopStateEvent('popstate')); });
    begin(); await advance(f); assert(f.phases.join() === "mousedown,mouseup,click" && f.clicks() === 1 && !notice(), "balanced native gesture");
  });
  await test("native list and ancestor replacement finish correctly", async () => {
    const f = fixture(); f.onPage(() => setTimeout(() => {
      const host = f.workspace.parentElement, next = host.cloneNode(true);
      const spans = next.querySelectorAll('.Di .ts'); spans[0].textContent = '8'; spans[1].textContent = '14';
      next.querySelectorAll('[data-thread-id]').forEach((node, i) => node.setAttribute('data-thread-id', `synthetic-${i + 8}`)); host.replaceWith(next);
    }, 20)); begin(); await advance(f); await new Promise(resolve => setTimeout(resolve, 40)); await settle();
    assert(!notice() && document.querySelector('.Nu.tf').scrollTop === 0, "new root");
  });
  await test("ordinary Older labels and non-50 page sizes work", async () => {
    const f = fixture({ size: 9, first: 19, search: false }); begin(); await advance(f); assert(f.numbers[0].textContent === "28", "native range");
  });
  await test("scrolling a reading pane cannot load a list page", async () => {
    const f = fixture(); begin(); await arrive(f); tick(); wheel(f.list);
    wheel(f.reading); assert(!hint(), "changing panes cancels edge progress");
    await hold({list:f.reading}); assert(f.clicks() === 0 && !hint(), "different pane");
  });
  await test("selection and a mixed select-all state pause both directions", async () => {
    const f = fixture({first:8}); const box=f.body.querySelector('[role="checkbox"]'); box.setAttribute('aria-checked','true'); begin(); await arrive(f); await hold(f); await arrive(f,-1); await hold(f,-1);
    assert(f.clicks() === 0 && f.previousClicks() === 0 && !hint(), "selection"); box.setAttribute('aria-checked','false');
    const toolbar=make('div',{gh:'tm'}); toolbar.append(make('div',{role:'checkbox','aria-checked':'mixed'})); f.workspace.append(toolbar); await advance(f); assert(f.clicks() === 0, "mixed");
  });
  await test("drafts, text focus and dialogs pause the edge control", async () => {
    const f=fixture(); begin(); const draft=make('form'); draft.append(make('input',{name:'composeid'})); f.workspace.append(draft); await advance(f); assert(f.clicks()===0&&!hint(),'draft'); draft.remove();
    const dialog=make('div',{role:'dialog'}); dialog.textContent='Dialog'; f.workspace.append(dialog); await advance(f); assert(f.clicks()===0&&!hint(),'dialog'); dialog.remove();
    const input=make('input'); f.workspace.append(input); input.focus(); await advance(f); assert(f.clicks()===0&&!hint(),'input'); input.remove();
  });
  await test("disabled page arrows and unknown layouts remain native", async () => {
    const f=fixture(); f.older.setAttribute('aria-disabled','true'); begin(); await arrive(f); await hold(f); assert(f.clicks()===0&&!hint(),'end');
    f.older.removeAttribute('aria-disabled'); f.list.append(f.table.cloneNode(true)); await advance(f); assert(f.clicks()===0,'multiple grids'); f.list.lastElementChild.remove();
    f.reading.style.display='none'; await advance(f); assert(f.clicks()===0,'unsupported layout');
  });
  await test("partial rendering and stale rows do not complete pending navigation", async () => {
    const f=fixture(); f.onPage(()=>{ f.render(8,1); f.numbers[1].textContent='14'; }); begin(); await advance(f); assert(!!notice(),'partial');
    await hold(f); assert(f.clicks()===1,'one request'); f.render(1); f.numbers[0].textContent='8'; f.numbers[1].textContent='14'; await settle(); assert(!!notice(),'stale rows');
    f.render(8); await settle(); assert(!notice()&&f.list.scrollTop===0,'finished');
  });
  await test("a native page with an overlapping conversation can finish", async () => {
    const f=fixture(); f.onPage(()=>{f.render(7);f.numbers[0].textContent='8';f.numbers[1].textContent='14';});begin();await advance(f);assert(!notice()&&f.list.scrollTop===0,'native source remains authoritative');
  });
  await test("three backward pages work without a pause between swipes", async () => {
    const f=fixture({first:22}); begin();
    for (const first of [15,8,1]) {
      // Continuous input while traversing each page, with no idle/release interval.
      f.list.scrollTop=20; wheel(f.list,-40); f.list.scrollTop=0; f.list.dispatchEvent(new Event('scroll')); await settle();
      await hold(f,-1); assert(f.numbers[0].textContent===String(first),`previous ${first}`);
      assert(f.list.scrollTop===f.list.scrollHeight-f.list.clientHeight&&!notice(),'landed at previous bottom');
    }
    assert(f.previousClicks()===3,'all three loads');
  });
  await test("three forward pages also rearm without a global quiet-period latch", async () => {
    const f=fixture();begin();for(const first of [8,15,22]){await arrive(f);await hold(f);assert(f.numbers[0].textContent===String(first),'next range');}assert(f.clicks()===3,'three loads');
  });
  await test("a short final page supports holding up or an explicit Previous click", async () => {
    const f=fixture({first:8,size:2});f.onPrevious(()=>f.render(1,7));begin();await arrive(f,-1);await hold(f,-1);assert(f.previousClicks()===1&&f.list.scrollTop>0,'back from short page');
  });
  await test("first page cannot navigate backward and new page cannot bounce immediately", async () => {
    const f=fixture({first:8});begin();await advance(f,-1);wheel(f.list,40);await settle();assert(f.previousClicks()===1&&f.clicks()===0,'arrival cannot bounce');f.list.scrollTop=0;await arrive(f,-1);await hold(f,-1);assert(f.previousClicks()===1,'first page boundary');
  });
  await test("expected history events tolerate old hash before the native URL changes", async () => {
    const f=fixture();f.onPage(()=>{window.dispatchEvent(new PopStateEvent('popstate'));history.replaceState(null,'','#search/in%3Atrash/p2');window.dispatchEvent(new PopStateEvent('popstate'));f.render(8);});begin();await advance(f);assert(!notice()&&f.list.scrollTop===0,'native history order');
  });
  await test("native /p1 and earlier-page hashes both complete backward navigation", async () => {
    for(const [first,hash,previous] of [[8,'/p2','/p1'],[15,'/p3','/p2']]){
      const f=fixture({first});history.replaceState(null,'','#search/in%3Atrash'+hash);f.onPrevious(()=>{history.replaceState(null,'','#search/in%3Atrash'+previous);window.dispatchEvent(new PopStateEvent('popstate'));f.render(first-7);});begin();await advance(f,-1);assert(!notice()&&f.list.scrollTop>0,'previous route');feature.stop();
    }
  });
  await test("manual arrows receive unchanged events and show pending feedback", async () => {
    const f=fixture();begin();const received=[];for(const button of [f.older,f.newer]) for(const type of ['pointerdown','mousedown','mouseup','click']) button.addEventListener(type,event=>received.push([type,event.defaultPrevented]));
    for(const button of [f.older,f.newer]){for(const type of ['pointerdown','mousedown','mouseup','click'])button.dispatchEvent(new MouseEvent(type,{bubbles:true,cancelable:true}));assert(!!notice(),'loading feedback');await settle();assert(!notice(),'finished');}
    assert(f.clicks()===1&&f.previousClicks()===1&&received.length===8&&received.every(([,prevented])=>!prevented),'native handlers unchanged');
  });
  await test("manual navigation owns the page even during continued scroll input", async () => {
    const f=fixture();f.onPage(()=>setTimeout(()=>f.render(8),80));begin();await bottom(f);f.older.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));f.older.click();await hold(f);await new Promise(resolve=>setTimeout(resolve,100));await settle();assert(f.clicks()===1&&!notice(),'no competing automatic request');
  });
  await test("manual arrows never force the new list scroll position", async () => {
    const f=fixture();f.onPage(()=>{f.render(8);f.list.scrollTop=100;});begin();f.older.click();await settle();assert(f.list.scrollTop===100&&!notice(),'Gmail owns manual position');
  });
  await test("manual navigation, hidden tabs and disabling ignore late completion", async () => {
    for(const mode of ['navigation','hidden','disable']){
      const f=fixture();f.onPage(()=>{});begin();await advance(f);
      if(mode==='navigation'){history.replaceState(null,'','#label/Elsewhere');window.dispatchEvent(new PopStateEvent('popstate'));}
      if(mode==='hidden'){Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));}
      if(mode==='disable')feature.update({autoPagingEnabled:false});
      f.render(8);f.list.scrollTop=f.list.scrollHeight;await settle();assert(f.list.scrollTop>0&&!notice()&&!hint(),mode);if(mode==='hidden')delete document.hidden;feature.stop();
    }
  });
  await test("timeouts do not retry automatically in either direction", async () => {
    const nativeTimeout=window.setTimeout;window.setTimeout=(fn,ms,...args)=>nativeTimeout(fn,ms===15000?30:ms,...args);
    try{for(const direction of [1,-1]){const f=fixture({first:8});f.onPage(()=>{});f.onPrevious(()=>{});begin();await advance(f,direction);await new Promise(resolve=>nativeTimeout(resolve,60));await hold(f,direction);assert(f.clicks()+f.previousClicks()===1&&notice()?.textContent.includes('paused'),'no retry');feature.stop();}}
    finally{window.setTimeout=nativeTimeout;}
  });
  await test("keyboard arrival waits, while holding the scroll key can page", async () => {
    const f=fixture({first:8});begin();f.list.dispatchEvent(new KeyboardEvent('keydown',{key:'Home',bubbles:true}));await settle();assert(f.previousClicks()===0&&!!hint(),'single key never jumps pages');
    for(let i=0;i<10;i++){tick();f.list.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowUp',repeat:true,bubbles:true}));}await settle();assert(f.previousClicks()===1,'held key');
  });
  await test("wheel line and page modes still require multiple sustained samples", async () => {
    const f=fixture();begin();await arrive(f);for(let i=0;i<10;i++){tick();wheel(f.list,3,1);}await settle();assert(f.clicks()===1,'line mode');await arrive(f);tick(1000);wheel(f.list,1,2);await settle();assert(f.clicks()===1,'one page-mode event insufficient');
  });
  await test("resizing or stopping removes owned controls and pending work", async () => {
    const f=fixture();begin();await arrive(f);window.dispatchEvent(new Event('resize'));assert(!hint(),'resize');await arrive(f);feature.stop();await hold(f);assert(!hint()&&!notice()&&f.clicks()===0,'cleanup');
  });
  Object.defineProperty(performance,"now",{configurable:true,value:realNow});
  output.dataset.failed=String(reports.filter(line=>line.startsWith('FAIL')).length);
  output.dataset.passed=String(reports.filter(line=>line.startsWith('PASS')).length);
  output.textContent+=`\n${output.dataset.passed}/${reports.length} passed`;
})();
