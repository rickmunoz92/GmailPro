/* Synthetic content only. Tests production CSS and preference lifecycle. */
(async () => {
  "use strict";
  const feature = GmailPro.messageList;
  const reports = [];
  const result = document.getElementById("results");
  const workspace = () => document.getElementById("workspace");
  const assert = (value, message) => { if (!value) throw new Error(message); };
  const rect = node => node.getBoundingClientRect();
  const css = node => getComputedStyle(node);
  const frame = () => new Promise(resolve => requestAnimationFrame(resolve));
  const enable = () => feature.start({ appleMailMessageListEnabled: true });
  let observerCreations = 0;
  const NativeObserver = window.MutationObserver;
  window.MutationObserver = class extends NativeObserver {
    constructor(callback) {
      if (/content\/messageList\.js/.test(new Error().stack)) observerCreations++;
      super(callback);
    }
  };

  const row = window.GmailProTestRow;

  function geometry(node) {
    const r = rect(node), sender = rect(node.querySelector(".yX")), subject = rect(node.querySelector(".a4W")), date = rect(node.querySelector(".xW"));
    assert(r.height >= 52 && r.height <= 64, `compact height (${r.height})`);
    assert(subject.top >= sender.bottom, "subject below sender");
    assert(Math.abs(subject.left - sender.left) < 1, "text lines aligned");
    assert(subject.right <= r.right && subject.width > r.width * 0.5, "subject uses available width");
    assert(sender.right <= date.left && date.right <= r.right, "sender and date cannot overlap");
    assert(rect(node.querySelector('[role="checkbox"]')).right <= sender.left, "controls left of both text lines");
    assert(css(node.querySelector(".y2")).display === "none", "snippet hidden without parsing");
  }

  async function test(name, run) {
    try { await run(); reports.push(`PASS ${name}`); }
    catch (error) { reports.push(`FAIL ${name}: ${error.message}`); }
    feature.stop(); workspace().replaceChildren(); workspace().style.width = "";
    workspace().classList.remove("dark", "native-narrow"); workspace().removeAttribute("dir");
    result.textContent = reports.join("\n");
  }

  await test("off leaves native layout and all Gmail nodes unchanged", () => {
    const node = row(); const original = workspace().innerHTML;
    feature.start({ appleMailMessageListEnabled: false });
    assert(css(node).display === "flex" && workspace().innerHTML === original, "native appearance and DOM");
  });
  for (const width of [320, 380, 560, 1200]) await test(`two-line layout at ${width}px`, () => {
    workspace().style.width = `${width}px`;
    const node = row({ sender: "A very long sender name ".repeat(10), subject: "A very long subject ".repeat(20) }); enable(); geometry(node);
    const subject = node.querySelector(".bog");
    assert(css(subject).textOverflow === "ellipsis" && subject.scrollWidth > subject.clientWidth, "long subject truncates");
    assert(node.querySelector(".bA4").scrollWidth > node.querySelector(".bA4").clientWidth, "long sender constrained");
  });
  await test("resizing into Gmail's narrow mode keeps the subject aligned", () => {
    const node = row(); enable();
    for (const width of [680, 440, 320, 680]) {
      workspace().style.width = `${width}px`;
      workspace().classList.toggle("native-narrow", width < 500);
      geometry(node);
      assert(Math.abs(rect(node.querySelector(".bog")).left - rect(node.querySelector(".yW")).left) < 1, "visible subject and sender aligned");
    }
    workspace().classList.add("native-narrow"); feature.stop();
    assert(css(node.querySelector(".a4W")).marginLeft === "46px", "native narrow indent restored when disabled");
  });
  await test("read and unread weights track native state changes", () => {
    const node = row(); enable();
    assert(css(node.querySelector(".sender")).fontWeight === "400", "read sender weight");
    node.classList.add("zE");
    assert(css(node.querySelector(".sender")).fontWeight === "700" && css(node.querySelector(".bqe")).fontWeight === "700", "native unread weight");
    node.classList.remove("zE"); assert(css(node.querySelector(".bqe")).fontWeight === "400", "native mark-read update");
  });
  await test("selected/current-message background is owned by Gmail", () => {
    const node = row(); node.classList.add("aps"); const native = css(node).backgroundColor;
    enable(); assert(css(node).backgroundColor === native, "selected background retained");
  });
  await test("short subject, conversation senders, label and attachment survive", () => {
    const node = row({ subject: "Hi", label: "Projects/Example", attachment: true }); enable(); geometry(node);
    assert(rect(node.querySelector(".yi")).width > 0 && rect(node.querySelector('.yf [role="img"]')).width > 0, "label and attachment visible");
    assert(rect(node.querySelector(".yi")).right <= rect(node.querySelector(".y6")).left, "label precedes subject");
    assert(node.querySelector(".sender").textContent === "Alex, Morgan 3", "native conversation sender string retained");
  });
  await test("long labels leave space for subject in a narrow pane", () => {
    workspace().style.width = "380px";
    const node = row({ label: "Projects/A very long user-created label ".repeat(5) }); enable();
    assert(rect(node.querySelector(".yi")).width <= rect(node.querySelector(".xT")).width * 0.45 + 1, "label width bounded");
    assert(rect(node.querySelector(".bog")).width > 80, "subject remains readable");
  });
  await test("subject quick-action wrapper in Sent preserves native controls", () => {
    const node = row(); const link = node.querySelector('[role="link"]');
    const wrapper = document.createElement("div"); wrapper.className = "a4X";
    link.replaceWith(wrapper); wrapper.append(link);
    const action = document.createElement("button"); action.textContent = "Native action";
    wrapper.append(action); let clicks = 0; action.addEventListener("click", () => clicks++);
    enable(); geometry(node); action.click();
    assert(clicks === 1 && rect(action).width > 0, "quick-action handler and visibility preserved");
    assert(rect(link).right <= rect(action).left, "subject and quick action do not overlap");
  });
  await test("optional importance marker can be hidden natively", () => {
    const node = row({ importance: false }); enable(); geometry(node);
    assert(css(node.querySelector(".WA")).display === "none", "native marker setting respected");
  });
  await test("hover actions do not enlarge the row or overlap either text line", () => {
    workspace().style.width = "380px";
    const node = row({ sender: "Long sender ".repeat(10) }); enable();
    const height = rect(node).height; const subjectTop = rect(node.querySelector(".a4W")).top;
    node.classList.add("aqw");
    const toolbar = rect(node.querySelector('[role="toolbar"]'));
    assert(rect(node).height === height && rect(node.querySelector(".a4W")).top === subjectTop, "no hover layout jump");
    assert(rect(node.querySelector(".yX")).right <= toolbar.left, "sender does not overlap actions");
    assert(toolbar.bottom <= rect(node.querySelector(".a4W")).top, "subject does not overlap actions");
    assert(css(node.querySelector(".xW")).display === "none", "Gmail hides date");
    let actions = 0; node.querySelector('[role="toolbar"]').addEventListener("click", () => actions++);
    for (const button of node.querySelectorAll('[role="toolbar"] > li')) button.click();
    assert(actions === 4, "all native toolbar handlers retained");
  });
  await test("checkbox multi-select, star, keyboard, context menu and drag handlers survive", () => {
    const first = row(), second = row(); let clicks = 0, menus = 0, drags = 0;
    for (const node of [first, second]) {
      node.addEventListener("click", () => clicks++);
      node.addEventListener("contextmenu", e => { e.preventDefault(); menus++; });
      node.addEventListener("dragstart", () => drags++);
      const checkbox = node.querySelector('[role="checkbox"]');
      checkbox.addEventListener("click", () => checkbox.setAttribute("aria-checked", "true"));
      node.querySelector('.apU [role="button"]').addEventListener("click", e => e.currentTarget.setAttribute("aria-label", "Starred"));
    }
    first.addEventListener("keydown", event => { if (event.key === "ArrowDown") second.focus(); });
    enable();
    first.querySelector('[role="checkbox"]').click(); second.querySelector('[role="checkbox"]').click();
    first.querySelector('.apU [role="button"]').click();
    first.focus(); first.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
    assert(document.activeElement === second, "native keyboard handler and focus retained");
    first.dispatchEvent(new MouseEvent("contextmenu")); first.dispatchEvent(new Event("dragstart"));
    assert(clicks === 3 && menus === 1 && drags === 1, "native listeners and bubbling retained");
    assert([first, second].every(n => n.querySelector('[role="checkbox"]').getAttribute("aria-checked") === "true"), "native multi-selection retained");
    assert(first.querySelector('.apU [role="button"]').getAttribute("aria-label") === "Starred", "star remains interactive");
  });
  await test("toggle OFF immediately restores exact native DOM, styles and geometry", () => {
    const node = row({ label: "Label", attachment: true }); node.style.color = "purple";
    const original = workspace().innerHTML; const height = rect(node).height;
    enable(); feature.update({ appleMailMessageListEnabled: false });
    assert(workspace().innerHTML === original && rect(node).height === height && css(node).display === "flex", "exact immediate restoration");
    assert(css(node.querySelector(".y2")).display !== "none", "preview restored");
  });
  await test("SPA insertion, staged rendering, removal, main replacement and Back/Forward need no scans", async () => {
    enable(); const node = row(); geometry(node);
    const subject = node.querySelector("[data-thread-id]"); subject.removeAttribute("data-thread-id");
    assert(css(node).display === "flex", "incomplete structural gate fails closed");
    subject.setAttribute("data-thread-id", "synthetic"); geometry(node);
    const pane = document.createElement("div"); pane.id = "workspace"; pane.setAttribute("role", "main"); workspace().replaceWith(pane);
    const next = row(); window.dispatchEvent(new PopStateEvent("popstate")); window.dispatchEvent(new HashChangeEvent("hashchange"));
    await frame(); geometry(next); next.remove(); pane.append(node.closest("table")); geometry(node);
  });
  await test("unknown rows, thread content and unrelated controls receive no CSS", () => {
    const node = row(); node.querySelector('[role="checkbox"]').removeAttribute("role");
    const thread = document.createElement("div"); thread.setAttribute("data-message-id", "synthetic-message");
    const embedded = row(); workspace().append(thread); thread.append(embedded.closest("table"));
    const outside = row(); document.body.append(outside.closest("table"));
    enable();
    assert([node, embedded, outside].every(n => css(n).display === "flex"), "structural boundaries respected");
    outside.closest("table").remove();
  });
  await test("unrecognized preview markup is kept instead of parsed or removed", () => {
    const node = row(); node.querySelector(".y2").className = "unknown-preview"; enable();
    assert(css(node.querySelector(".unknown-preview")).display !== "none", "unknown snippet left to Gmail");
  });
  await test("native dark colors and RTL direction are inherited", () => {
    workspace().classList.add("dark"); workspace().setAttribute("dir", "rtl");
    const node = row(); const color = css(node).color, background = css(node).backgroundColor;
    enable();
    assert(css(node).color === color && css(node).backgroundColor === background, "colors retained");
    assert(rect(node.querySelector(".xW")).right <= rect(node.querySelector(".yX")).left, "RTL date at logical end");
  });
  await test("no row writes, scans, timers or observer work on idle or mutation bursts", async () => {
    const node = row(); const original = workspace().innerHTML;
    enable(); enable(); feature.update({ autoBccEnabled: true, newestEmailFirstEnabled: true });
    assert(workspace().innerHTML === original, "message DOM untouched");
    for (let i = 0; i < 100; i++) row({ subject: `Synthetic ${i}` });
    await frame(); await frame();
    assert(observerCreations === 0, "no message-list MutationObserver after html exists");
    assert(css(node).display === "grid", "unrelated preferences leave layout enabled");
    feature.stop(); feature.stop(); assert(css(node).display === "flex", "idempotent cleanup");
  });
  window.MutationObserver = NativeObserver;
  const failures = reports.filter(line => line.startsWith("FAIL")).length;
  result.textContent = `${reports.join("\n")}\n\n${reports.length - failures}/${reports.length} checks passed.`;
  result.dataset.failures = String(failures);
})();
