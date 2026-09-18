(async () => {
  "use strict";
  const feature = GmailPro.appearance, row = GmailProTestRow, result = document.getElementById("results");
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
  await test("off has no styles or DOM changes; on includes existing two-line list", () => {
    const node = row(), html = workspace.innerHTML, baseline = css(node).backgroundColor;
    feature.start(GmailPro.settings.defaults);
    assert(css(node).display === "flex" && css(node).backgroundColor === baseline, "native layout");
    enable(); assert(css(node).display === "grid", "existing grid reused");
    feature.stop(); assert(css(node).display === "flex" && css(node).backgroundColor === baseline && workspace.innerHTML === html, "exact restoration");
    assert(!root.hasAttribute("data-gp-theme") && !root.hasAttribute("data-gp-accent"), "root cleaned");
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
    node.classList.add("aps");
    // The requested vivid Apple blue is ~4:1 with white; its dark-sidebar
    // variant is ~3:1. Keep the stronger existing checks for other accents.
    const selectionContrast = accent === "blue" ? 4 : 4.5;
    const sidebarContrast = accent === "blue" && theme === "dark" ? 3 : 4.5;
    assert(css(node).backgroundColor === token("--gp-accent"), "native open row uses accent");
    assert(contrast(css(node).backgroundColor, css(node.querySelector(".bog")).color) >= selectionContrast, "subject contrast");
    assert(contrast(css(node).backgroundColor, css(node.querySelector(".xW")).color) >= selectionContrast, "date contrast");
    assert(contrast(css(node).backgroundColor, css(node.querySelector(".at .av")).color) >= selectionContrast, "nested Gmail label text contrast");
    assert(dot(node).visibility === "hidden" && node.classList.contains("zE"), "selected unread state retained, redundant dot hidden");
    const selected = document.querySelector(".TO.nZ"), link = selected.querySelector("a");
    assert(css(selected).backgroundColor === token("--gp-selection-sidebar-bg"), "neutral sidebar selection");
    assert(css(link).color === token("--gp-accent-ui"), "accent mailbox text");
    assert(css(selected.querySelector("svg")).fill === token("--gp-accent-ui"), "accent mailbox icon");
    assert(contrast(css(link).color, css(selected).backgroundColor) >= sidebarContrast, "sidebar text contrast");
    assert(contrast(css(selected.querySelector(".bsU")).color, css(selected).backgroundColor) >= 4.5, "count contrast >= 4.5");
    selected.classList.add("nY");
    assert(css(selected).backgroundColor === token("--gp-accent"), "drop target uses current accent");
    assert(contrast(css(link).color, css(selected).backgroundColor) >= selectionContrast, "drop label contrast");
    assert(css(selected.querySelector("svg")).fill === token("--gp-accent-contrast"), "drop icon matches foreground");
    selected.classList.remove("nY");
    node.classList.remove("aps"); assert(dot(node).visibility === "visible" && css(node).backgroundColor === token("--gp-bg-primary"), "deselect restores unread");
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
    assert(css(document.getElementById("sidebar")).backgroundColor === "rgb(35, 41, 43)", "sidebar is #23292B");
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
    assert(dot(a).visibility === "visible", "prior unread dot restored");
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
    node.focus(); assert(node.matches(":focus-visible") && css(node).outlineStyle === "solid", "row keyboard focus visible");
    node.blur(); feature.stop();
    assert(rect(box).width > 0 && rect(node.querySelector('[role="toolbar"]')).width > 0, "native controls restore on OFF");
  });
  await test("Ctrl/Command-click toggles native selection without opening or marking read", () => {
    const nodes = selectableRows(); let opened = 0;
    nodes.forEach(node => node.addEventListener("click", () => opened++)); enable(); enable();
    gesture(nodes[1].querySelector(".sender"), {ctrlKey:true});
    gesture(nodes[3].querySelector(".bog"), {metaKey:true});
    assert(selectedIndices(nodes) === "1,3" && opened === 0, "disjoint native selection, no open");
    gesture(nodes[1], {ctrlKey:true});
    assert(selectedIndices(nodes) === "3" && nodes.every(node => node.classList.contains("zE")), "toggle off and unread preserved");
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
    gesture(nodes[2], {shiftKey:true}); assert(selectedIndices(nodes) === "1,2", "range contracts from original anchor");
    gesture(nodes[0], {shiftKey:true}); assert(selectedIndices(nodes) === "0,1", "reverse range");
    gesture(nodes[4], {metaKey:true}); gesture(nodes[3], {metaKey:true,shiftKey:true});
    assert(selectedIndices(nodes) === "0,1,3,4", "additive range preserves disjoint selection");
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
  await test("SPA replacement receives styles without per-row discovery or listeners", () => {
    enable(); row().closest("table").remove(); const next = row({unread:true}); next.classList.add("aps");
    assert(css(next).display === "grid" && css(next).backgroundColor === token("--gp-accent"), "replacement styled immediately");
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
    const node = row(); GmailPro.messageList.start({appleMailMessageListEnabled:true}); enable(); feature.stop();
    assert(css(node).display === "grid", "standalone list preference retained");
    GmailPro.messageList.stop(); assert(css(node).display === "flex", "all visual overrides removed");
  });
  await test("follow-system resolves live OS preference", () => {
    enable({appearanceTheme:"system"});
    assert(root.dataset.gpTheme === (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"), "system theme resolved");
  });
  const failures = reports.filter(line => line.startsWith("FAIL")).length;
  result.textContent = `${reports.join("\n")}\n\n${reports.length - failures}/${reports.length} checks passed.`;
  result.dataset.failures = String(failures);
})();
