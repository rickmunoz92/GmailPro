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
  await test("native unread class changes only the dot, not text or background", () => {
    const node = row(); enable(); const bg = css(node).backgroundColor;
    const textStyle = () => [".sender", ".bqe", ".xW span"].map(selector => { const style = css(node.querySelector(selector)); return [style.color, style.fontWeight]; });
    const readText = JSON.stringify(textStyle());
    assert(dot(node).content === "none", "read has no dot");
    node.classList.add("zE");
    assert(dot(node).content === '""' && dot(node).backgroundColor === token("--gp-accent"), "unread accent dot");
    assert(rect(node.querySelector(".yW")).left >= rect(node.querySelector(".yX")).left + 12, "dot never overlaps sender text");
    assert(JSON.stringify(textStyle()) === readText && css(node).backgroundColor === bg, "read/unread typography and background match");
    node.classList.remove("zE"); assert(dot(node).content === "none", "read clears dot synchronously");
  });
  for (const theme of ["dark", "light"]) for (const accent of GmailPro.settings.choices.accentColor) await test(`${theme} / ${accent}: selected row, dot, neutral sidebar and accessible contrast`, () => {
    const node = row({unread:true,label:"Projects/Example",attachment:true}); enable({appearanceTheme:theme,accentColor:accent});
    node.classList.add("aps");
    assert(css(node).backgroundColor === token("--gp-accent"), "native open row uses accent");
    assert(contrast(css(node).backgroundColor, css(node.querySelector(".bog")).color) >= 4.5, "subject contrast >= 4.5");
    assert(contrast(css(node).backgroundColor, css(node.querySelector(".xW")).color) >= 4.5, "date contrast >= 4.5");
    assert(contrast(css(node).backgroundColor, css(node.querySelector(".at .av")).color) >= 4.5, "nested Gmail label text contrast >= 4.5");
    assert(dot(node).visibility === "hidden" && node.classList.contains("zE"), "selected unread state retained, redundant dot hidden");
    const selected = document.querySelector(".TO.nZ"), link = selected.querySelector("a");
    assert(css(selected).backgroundColor === token("--gp-selection-sidebar-bg"), "neutral sidebar selection");
    assert(css(link).color === token("--gp-accent-ui"), "accent mailbox text");
    assert(css(selected.querySelector("svg")).fill === token("--gp-accent-ui"), "accent mailbox icon");
    assert(contrast(css(link).color, css(selected).backgroundColor) >= 4.5, "sidebar text contrast >= 4.5");
    assert(contrast(css(selected.querySelector(".bsU")).color, css(selected).backgroundColor) >= 4.5, "count contrast >= 4.5");
    selected.classList.add("nY");
    assert(css(selected).backgroundColor === token("--gp-accent"), "drop target uses current accent");
    assert(contrast(css(link).color, css(selected).backgroundColor) >= 4.5, "drop label contrast >= 4.5");
    assert(css(selected.querySelector("svg")).fill === token("--gp-accent-contrast"), "drop icon matches foreground");
    selected.classList.remove("nY");
    node.classList.remove("aps"); assert(dot(node).visibility === "visible" && css(node).backgroundColor === token("--gp-bg-primary"), "deselect restores unread");
  });
  await test("list stars and importance markers hide without reserving space and restore on OFF", () => {
    const node = row(), star = node.querySelector(".apU"), importance = node.querySelector(".WA");
    const html = node.innerHTML; enable();
    assert(css(star).display === "none" && css(importance).display === "none", "both cells hidden");
    assert(rect(node.querySelector(".yX")).left <= rect(node.querySelector(".oZ-x3")).right + 1, "no empty control columns");
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
    const h = rect(node).height; assert(h >= 50 && h <= 64, `compact row (${h})`);
    assert(rect(node.querySelector(".yX")).right <= rect(node.querySelector(".xW")).left, "sender date don't overlap");
    assert(node.querySelector(".bog").scrollWidth > node.querySelector(".bog").clientWidth, "subject ellipsized");
    node.classList.add("aqw");
    assert(rect(node).height === h && rect(node.querySelector('[role="toolbar"]')).width === 0, "hover toolbar hidden without height jump");
    assert(css(node.querySelector(".xW")).display !== "none" && css(node.querySelector(".yf")).display !== "none", "date and attachment stay visible");
    assert(rect(node.querySelector(".yX")).right <= rect(node.querySelector(".xW")).left, "date doesn't overlap sender on hover");
  });
  await test("hover checkbox emphasis and grip are suppressed; selection, focus and OFF still work", () => {
    const node = row(), box = node.querySelector('[role="checkbox"]'); enable();
    const opacity = css(box).opacity;
    node.classList.add("aqw", "btb");
    assert(css(box).opacity === opacity, "row hover/focus doesn't brighten checkbox");
    assert(getComputedStyle(box, "::before").content === "none" && getComputedStyle(box.parentElement, "::before").content === "none", "no ripple or grip");
    box.setAttribute("aria-checked", "true"); assert(css(box).opacity === "1", "checked remains clear");
    box.setAttribute("aria-checked", "false"); box.focus();
    assert(box.matches(":focus-visible") && css(box).outlineStyle === "solid" && css(box).opacity === "1", "keyboard focus stays visible");
    box.blur(); feature.stop();
    assert(css(box).opacity === "1" && rect(node.querySelector('[role="toolbar"]')).width > 0, "native hover controls restore on OFF");
  });
  await test("SPA replacement receives styles without discovery, listeners, or cached row state", () => {
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
