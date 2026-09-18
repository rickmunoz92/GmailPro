/* Synthetic messages only. No mail or Gmail data. */
(async () => {
  "use strict";
  const feature = GmailPro.messageZoom;
  const store = GmailProPopupTest;
  store.failRead = false;
  const reports = [];
  const result = document.getElementById("results");
  const workspace = document.getElementById("workspace");
  const byId = id => document.getElementById(id);
  const assert = (ok, message) => { if (!ok) throw new Error(message); };
  const settle = (ms = 20) => new Promise(resolve => setTimeout(resolve, ms));
  const zoom = node => Number(getComputedStyle(node).zoom);
  const rect = node => node.getBoundingClientRect();
  const key = (key, options = {}, target = document.activeElement) => {
    const event = new KeyboardEvent("keydown", { key, metaKey:true, bubbles:true, cancelable:true, ...options });
    target.dispatchEvent(event);
    return event.defaultPrevented;
  };
  const enabled = () => feature.start({ messageZoomEnabled:true });
  const setLevel = level => { focus(); key("0"); const index=feature.levels.indexOf(level)-feature.levels.indexOf(100); for(let i=0;i<Math.abs(index);i++) key(index>0?"+":"-"); };
  const focus = () => byId("body1").focus();

  const NativeObserver = window.MutationObserver;
  let observers = 0;
  window.MutationObserver = class extends NativeObserver {
    constructor(fn) { super(fn); if (/content\/messageZoom\.js/.test(new Error().stack.split("\n")[2])) observers++; }
  };
  function message(id, html) {
    return `<div role="listitem" tabindex="-1" jsaction="synthetic" aria-expanded="true"><div><div data-message-id="${id}" data-legacy-message-id="${id}"><header>Sender — <button>Reply</button></header><div class="ii"><div class="a3s" id="${id}" tabindex="0">${html}</div></div><div class="attachments"><button>Attachment</button></div><div class="reply"><div role="textbox" contenteditable="true" aria-label="Compose editor">Draft stays unchanged.</div></div></div></div></div>`;
  }
  function fixture() {
    workspace.innerHTML = `<aside id="sidebar">Sidebar <a href="#sidebar">Labels</a></aside><div role="main" id="main"><div id="message-list">Message list</div><section id="pane"><h2 data-thread-perm-id="thread" data-legacy-thread-id="thread">Conversation</h2><div role="list" id="thread">${message("body1", '<p>Plain text with wrapping. '+ 'A long readable message. '.repeat(30) + '</p><a href="#example" id="body-link">Message link</a><blockquote>Quoted content stays selectable.</blockquote>')}${message("body2", '<p style="font-size:16px" id="explicit">HTML pixel-sized text.</p><img alt="Synthetic image" width="120" height="60" src="../icons/icon128.png"><table style="width:800px"><tr><td>Fixed-width table</td><td>More content</td></tr></table><details><summary>Quoted details</summary>Quoted HTML</details>')}</div></section></div>`;
  }
  async function test(name, run) {
    try { await run(); reports.push(`PASS ${name}`); }
    catch (error) { reports.push(`FAIL ${name}: ${error.message}`); }
    result.textContent = reports.join("\n");
  }
  fixture();
  await test("default/off leaves native keyboard and layout", () => {
    feature.start({ messageZoomEnabled:false }); focus();
    assert(!key("=") && zoom(byId("body1")) === 1, "off passes through");
  });
  await test("100%, plus variants, minus, reset and clamps", () => {
    enabled(); focus(); assert(zoom(byId("body1")) === 1, "100%");
    assert(key("=", {code:"Equal"}) && zoom(byId("body1")) === 1.1, "Cmd =");
    assert(key("+", {shiftKey:true,code:"Equal"}) && zoom(byId("body1")) === 1.25, "Cmd shift plus");
    assert(key("-") && zoom(byId("body1")) === 1.1, "minus");
    for (let i=0;i<20;i++) assert(key("+"), "upper clamp consumed");
    assert(zoom(byId("body1")) === 2, "max 200");
    for (let i=0;i<20;i++) assert(key("-"), "lower clamp consumed");
    assert(zoom(byId("body1")) === .8, "min 80");
    assert(key("0") && zoom(byId("body1")) === 1, "reset");
  });
  await settle(450);
  await test("all levels preserve outer geometry, reflow, and magnify pixel HTML/images", () => {
    const pane = rect(byId("pane")).width, sidebar = rect(byId("sidebar")).width, list = rect(byId("message-list")).width;
    const header = rect(workspace.querySelector("header")).height;
    for (const width of [900, 680]) {
      workspace.style.width = `${width}px`;
      const available = rect(byId("pane")).width;
      for (const level of feature.levels) {
        setLevel(level);
        assert(zoom(byId("body1")) === level/100 && zoom(byId("body2")) === level/100, `consistent ${level}`);
        assert(Math.abs(rect(byId("pane")).width - available) < 1, `pane width ${level}`);
        assert(rect(byId("sidebar")).width === sidebar && rect(byId("message-list")).width === list, "chrome geometry stable");
        assert(rect(workspace.querySelector("header")).height === header, "sender unchanged");
        const image = byId("body2").querySelector("img");
        assert(Math.abs(rect(image).width - 120*level/100) < 1, "image magnified");
        assert(getComputedStyle(byId("explicit")).fontSize === "16px", "sender font formatting untouched");
        if (level !== 100) {
          assert(rect(byId("body1")).width <= available + 1 && rect(byId("body2")).width <= available + 1, "body stays within pane");
          assert(byId("body2").scrollWidth > byId("body2").clientWidth, "wide table scrolls locally");
          assert(byId("pane").scrollWidth <= byId("pane").clientWidth + 1, "no outer overflow");
        }
      }
    }
    workspace.style.width = "900px"; setLevel(100);
    assert(rect(byId("pane")).width === pane, "original width restored");
  });
  await test("maximum zoom stabilizes Gmail's scrollbar-width feedback at the overflow threshold", async () => {
    workspace.innerHTML = `<div role="main"><h2 data-thread-perm-id="gutter-test" data-legacy-thread-id="gutter-test">Conversation</h2>
      <div class="Nu S3" id="gutter-pane"><div id="native-sizer"><div role="list">
        <div role="listitem" tabindex="-1" jsaction="synthetic" aria-expanded="true"><div>
          <div data-message-id="gutter-message" data-legacy-message-id="gutter-message"><div class="ii">
            <div class="a3s" id="body1" tabindex="0" style="height:145px">Threshold message</div>
          </div></div>
        </div></div></div></div></div></div>`;
    const pane=byId("gutter-pane"), sizer=byId("native-sizer");
    const style=document.createElement("style");
    style.textContent="#gutter-pane { width:500.75px; height:300px; overflow:auto; } #gutter-pane::-webkit-scrollbar { width:16px; height:16px; }";
    document.head.append(style);
    await settle(); setLevel(200);
    const outer=rect(pane).width;
    const sample=async()=>{
      // Model the native sizing feedback with a one-pixel overflow. The live
      // fractional-width case is platform-dependent; this makes the same
      // scrollbar cycle deterministic across Chrome rasterization settings.
      sizer.style.width=`${pane.clientWidth + 1}px`;
      await new Promise(resolve=>requestAnimationFrame(resolve));
      return `${pane.clientWidth},${pane.clientHeight},${rect(byId("body1")).width}`;
    };
    try {
      pane.style.scrollbarGutter="auto";
      const before=[]; for(let i=0;i<12;i++) before.push(await sample());
      assert(new Set(before.slice(4)).size>1,`fixture reproduces the original bounce: ${before.join(" / ")}; zoom=${zoom(byId("body1"))}; scroll=${pane.scrollWidth},${pane.scrollHeight}`);
      pane.style.removeProperty("scrollbar-gutter");
      assert(getComputedStyle(pane).scrollbarGutter==="stable","production rule matches reading pane");
      const after=[]; for(let i=0;i<120;i++) after.push(await sample());
      assert(new Set(after.slice(4)).size===1,"width/height stable for 120 animation frames");
      assert(rect(pane).width===outer,"allocated pane width unchanged");
      assert(zoom(byId("body1"))===2,"maximum magnification retained");
      key("0"); assert(getComputedStyle(pane).scrollbarGutter==="auto","100% restores native gutter");
    } finally {
      style.remove(); fixture(); await settle(); setLevel(100);
    }
  });
  await test("search, ordinary inputs, selects, compose and editable descendants pass through", () => {
    enabled();
    const controls = [byId("search"), workspace.querySelector('[contenteditable]')];
    for (const tag of ["input", "textarea", "select"]) { const node=document.createElement(tag); byId("pane").append(node); controls.push(node); }
    for (const control of controls) { control.focus(); for (const k of ["=", "-", "0"]) assert(!key(k), `${control.tagName} passes`); }
    assert(workspace.querySelector('[contenteditable]').innerHTML === "Draft stays unchanged.", "outgoing content unchanged");
    assert(zoom(workspace.querySelector('[contenteditable]')) === 1, "editor not zoomed");
  });
  await test("sidebar and Gmail Pro controls retain default shortcuts", () => {
    byId("sidebar").querySelector("a").focus(); assert(!key("+"), "sidebar");
    const control=document.createElement("button"); control.dataset.gmailProLabelUi=""; byId("pane").append(control); control.focus();
    assert(!key("+"), "extension settings"); control.remove();
  });
  await test("unrelated modifiers, keys, composition and uncancelable events pass through", () => {
    focus();
    for (const [k, opts] of [["+",{ctrlKey:true}],["+",{altKey:true}],["+",{metaKey:false}],["+",{isComposing:true}],["+",{cancelable:false}],["0",{shiftKey:true}],["_",{shiftKey:true}],["a",{}]]) assert(!key(k,opts), "unrelated shortcut");
  });
  await test("no thread, hidden thread, missing header and ambiguous conversations pass through", () => {
    focus(); const thread=byId("thread"); thread.hidden=true; assert(!key("+"), "hidden"); thread.hidden=false;
    const heading=byId("pane").querySelector("h2"); heading.removeAttribute("data-thread-perm-id"); assert(!key("+"), "unknown heading"); heading.setAttribute("data-thread-perm-id","thread");
    const copy=thread.cloneNode(true); byId("pane").append(copy); assert(!key("+"), "ambiguous lists"); copy.remove();
    thread.remove(); document.body.focus(); assert(!key("+",{},document.body), "inbox"); fixture();
  });
  await test("visible modal blocks zoom even with stale focus; hidden modal does not", () => {
    focus(); const modal=document.createElement("div"); modal.setAttribute("role","dialog"); modal.textContent="Settings"; document.body.append(modal);
    assert(!key("+"), "modal"); modal.hidden=true; assert(key("0"), "hidden dialog ignored"); modal.remove();
  });
  await test("expanded bodies share temporary zoom without separate observers", async () => {
    await settle(); setLevel(125); focus();
    assert(zoom(byId("body1")) === 1.25 && zoom(byId("body2")) === 1.25, "navigation");
    const item=byId("body2").closest('[role="listitem"]'); item.setAttribute("aria-expanded","false"); assert(zoom(byId("body2")) === 1, "collapsed excluded");
    item.setAttribute("aria-expanded","true"); assert(zoom(byId("body2")) === 1.25, "expansion");
    assert(observers === 0, "no ongoing observers");
  });
  await test("links, selection, details, attachments and native nodes survive zoom", () => {
    const body=byId("body1"), original=body.innerHTML;
    let clicks=0; const link=byId("body-link"); link.addEventListener("click", e=>{e.preventDefault();clicks++;});
    link.click(); assert(clicks===1, "link handler intact");
    const range=document.createRange(); range.selectNodeContents(body.querySelector("p")); const selection=getSelection(); selection.removeAllRanges(); selection.addRange(range); assert(selection.toString().startsWith("Plain text"), "selection intact"); selection.removeAllRanges();
    const details=workspace.querySelector("details"); details.querySelector("summary").click(); assert(details.open,"quoted content opens");
    assert(body.innerHTML===original && workspace.querySelectorAll(".attachments button").length===2,"nodes preserved");
  });
  await test("newest first and message list features operate alongside zoom", async () => {
    GmailPro.reverseThreads.start({newestEmailFirstEnabled:true}); GmailPro.messageList.start({appleMailMessageListEnabled:true});
    await settle(); assert(byId("thread").getAttribute("data-gmail-pro-thread-order")==="reverse", "reversed");
    assert(zoom(byId("body1"))===1.25 && document.documentElement.classList.contains("gmail-pro-message-list"), "features coexist");
    GmailPro.reverseThreads.stop(); GmailPro.messageList.stop();
  });
  await test("next conversation resets to 100%, including reused list and keyboard navigation", async () => {
    focus(); setLevel(150);
    byId("pane").querySelector("h2").setAttribute("data-thread-perm-id","next");
    await settle(); assert(zoom(byId("body1"))===1,"reused thread resets");
    setLevel(125); fixture(); await settle(); assert(zoom(byId("body1"))===1,"SPA replacement resets");
    assert(!byId("thread").hasAttribute("data-gmail-pro-thread-order"),"zoom does not enable ordering");
  });
  await test("expanding current conversation and unrelated changes preserve zoom", async () => {
    setLevel(125); byId("body2").closest('[role="listitem"]').setAttribute("aria-expanded","false"); await settle();
    byId("body2").closest('[role="listitem"]').setAttribute("aria-expanded","true"); await settle();
    feature.update({autoBccEnabled:true}); assert(zoom(byId("body1"))===1.25,"same conversation retained");
  });
  await test("refresh/start resets zoom, preference level never writes storage", async () => {
    feature.stop(); feature.start({messageZoomEnabled:true});
    assert(zoom(byId("body1"))===1 && store.writes===0,"temporary only");
  });
  await test("disabling restores native layout and releases discovery when ordering is off", async () => {
    setLevel(150); feature.stop(); await settle();
    assert(zoom(byId("body1"))===1 && !key("+"),"cleanup");
    feature.stop(); assert(observers===0,"no separate zoom observer");
  });
  window.MutationObserver=NativeObserver;
  const failures=reports.filter(line=>line.startsWith("FAIL")).length;
  result.textContent=`${reports.join("\n")}\n\n${reports.length-failures}/${reports.length} checks passed.`;
  result.dataset.failures=String(failures);
  fixture(); enabled(); focus();
  let on=true;
  byId("toggle").onclick=()=>{on=!on;feature.update({messageZoomEnabled:on});};
  byId("empty").onclick=()=>{byId("thread").hidden=!byId("thread").hidden;};
  byId("width").onclick=()=>{workspace.style.width=workspace.style.width==="680px"?"900px":"680px";};
  byId("run").onclick=()=>location.reload();
  window.addEventListener("keydown",event=>{if(event.isTrusted&&event.metaKey) byId("events").textContent+=`\n${event.key}: canceled=${event.defaultPrevented}, zoom=${zoom(byId("body1"))}, devicePixelRatio=${devicePixelRatio}`;});
})();
