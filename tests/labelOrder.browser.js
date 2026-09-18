(async () => {
  "use strict";
  const feature = GmailPro.labelOrder;
  const host = document.getElementById("workspace");
  const results = document.getElementById("results");
  const reports = [];
  let saved = [], writes = 0, fail = false;
  GmailPro.settings = { async save(patch) {
    if (fail) throw new Error("quota");
    saved = [...patch.customLabelOrder]; writes++;
    feature.update(patch);
  } };
  const settle = () => new Promise(resolve => setTimeout(resolve, 30));
  const assert = (value, message) => { if (!value) throw new Error(message); };
  const equal = (a, b) => assert(JSON.stringify(a) === JSON.stringify(b), `${JSON.stringify(a)} != ${JSON.stringify(b)}`);
  const ids = list => [...list.querySelectorAll('a[href*="#label/"]')]
    .sort((a, b) => (Number(a.closest('.aim').style.order) || 0) - (Number(b.closest('.aim').style.order) || 0))
    .map(a => decodeURIComponent(a.hash.slice(7).replace(/\+/g, " ")));
  function row(name, depth = 0) {
    const element = document.createElement("div"); element.className = "aim";
    const line = document.createElement("div"); line.className = "TN"; line.style.marginLeft = `${depth * 12}px`;
    const link = document.createElement("a"); link.href = `#label/${encodeURIComponent(name).replace(/%20/g, "+")}`; link.textContent = name.split("/").at(-1); link.draggable = false;
    const menu = document.createElement("div"); menu.dataset.labelName = name; menu.setAttribute("aria-haspopup", "true");
    const count = document.createElement("span"); count.className = "unread"; count.textContent = "6"; count.style.color = "red";
    line.append(link, count, menu); element.append(line); return element;
  }
  function fixture(names = ["Alpha", "Alpha/Child", "Alpha/Child/Grandchild", "Beta", "Gamma"]) {
    feature.stop();
    host.innerHTML = '<div aria-labelledby="label-heading"><h2 id="label-heading">Labels</h2><div gh="cl"><div class="TK"></div></div><span gh="mll" role="button" aria-label="More labels" tabindex="0">More</span><div class="extra" hidden></div></div><div class="system"><a href="#inbox">Inbox</a><a href="#sent">Sent</a></div>';
    const list = host.querySelector(".TK");
    names.forEach(name => list.append(row(name, name.split("/").length - 1)));
    const more = host.querySelector('[gh="mll"]');
    more.addEventListener("click", () => {
      const extra = host.querySelector(".extra");
      extra.hidden = !extra.hidden;
      more.setAttribute("aria-label", extra.hidden ? "More labels" : "Less labels");
      extra.innerHTML = extra.hidden ? "" : '<div gh="cl"><div class="TK"></div></div>';
      if (!extra.hidden) extra.querySelector(".TK").append(row("Hidden A"), row("Hidden B"));
    });
    return list;
  }
  async function test(name, run) {
    try { await run(); reports.push(`PASS ${name}`); }
    catch (error) { reports.push(`FAIL ${name}: ${error.message}`); }
    results.textContent = reports.join("\n");
  }
  const on = (customLabelOrder = ["label/Gamma", "label/Alpha", "label/Beta"]) => feature.start({ customLabelOrderEnabled: true, customLabelOrder });
  await test("off is inert; parent moves with multilevel descendants and original nodes", async () => {
    const list = fixture(); const nodes = [...list.children];
    feature.start({ customLabelOrderEnabled: false, customLabelOrder: ["label/Gamma"] });
    assert([...list.children].every((node, i) => node === nodes[i]), "native DOM sequence unchanged");
    on(); equal(ids(list), ["Gamma", "Alpha", "Alpha/Child", "Alpha/Child/Grandchild", "Beta"]);
    assert([...list.children].every((node, i) => node === nodes[i]), "native DOM sequence unchanged after ordering");
    assert(list.querySelectorAll(".unread").length === 5 && !host.querySelector("button"), "counts and normal mode preserved");
    equal([...host.querySelectorAll('.system a')].map(a => a.hash), ["#inbox", "#sent"]);
  });
  await test("idle and repeated apply have no mutation loop or DOM writes", async () => {
    const list = fixture(); on(); await settle();
    let records = 0; const observer = new MutationObserver(items => { records += items.length; });
    observer.observe(host, { subtree: true, childList: true, attributes: true });
    feature.update({ customLabelOrder: ["label/Gamma", "label/Alpha", "label/Beta"] });
    await settle(); equal(records, 0); observer.disconnect();
    equal(ids(list).slice(0, 2), ["Gamma", "Alpha"]);
  });
  await test("off restores native order; on reapplies; reset restores", async () => {
    const list = fixture(); on();
    feature.update({ customLabelOrderEnabled: false }); equal(ids(list), ["Alpha", "Alpha/Child", "Alpha/Child/Grandchild", "Beta", "Gamma"]);
    feature.update({ customLabelOrderEnabled: true }); assert(ids(list)[0] === "Gamma", "re-enabled");
    feature.update({ customLabelOrder: [] }); assert(ids(list)[0] === "Alpha", "reset");
    assert(![...list.childNodes].some(n => n.nodeType === 8), "anchors removed");
  });
  await test("new labels append after ranked labels and stale/deleted/renamed entries are ignored", async () => {
    const list = fixture(["Alpha", "Beta", "Gamma"]); on(["label/Deleted", "label/Gamma", "label/Alpha", "label/Beta"]);
    list.prepend(row("New")); await settle(); equal(ids(list), ["Gamma", "Alpha", "Beta", "New"]);
    const beta = [...list.children].find(n => ids(n)[0] === "Beta"); beta.replaceWith(row("Renamed")); await settle();
    equal(ids(list), ["Gamma", "Alpha", "New", "Renamed"]);
  });
  await test("collapse, expand and SPA list replacement preserve group ordering", async () => {
    let list = fixture(); on();
    for (const node of [...list.children]) if (ids(node)[0].startsWith("Alpha/")) node.remove();
    await settle(); equal(ids(list), ["Gamma", "Alpha", "Beta"]);
    const alpha = [...list.children].find(n => ids(n)[0] === "Alpha"); alpha.after(row("Alpha/Again", 1));
    await settle(); equal(ids(list), ["Gamma", "Alpha", "Alpha/Again", "Beta"]);
    const replacement = document.createElement("div"); replacement.setAttribute("gh", "cl"); replacement.innerHTML = '<div class="TK"></div>';
    ["Alpha", "Beta", "Gamma"].forEach(name => replacement.firstChild.append(row(name)));
    list.parentElement.replaceWith(replacement); list = replacement.firstChild;
    await settle(); equal(ids(list), ["Gamma", "Alpha", "Beta"]);
    window.dispatchEvent(new Event("hashchange")); window.dispatchEvent(new Event("popstate")); await settle();
    equal(ids(list), ["Gamma", "Alpha", "Beta"]);
  });
  await test("edit temporarily opens More, handles only roots, keyboard moves save; Escape cleans up", async () => {
    const list = fixture(); on(); assert(feature.edit(), "edit available"); await settle();
    equal(host.querySelectorAll(".gmail-pro-label-handle").length, 5);
    assert(!host.querySelector(".extra").hidden, "More opened");
    const button = list.querySelector('a[href="#label/Gamma"]').closest(".aim").querySelector("button");
    button.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })); await settle();
    equal(ids(list), ["Alpha", "Alpha/Child", "Alpha/Child/Grandchild", "Gamma", "Beta"]);
    assert(saved.indexOf("label/Alpha") < saved.indexOf("label/Gamma"), "saved keyboard order");
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); await settle();
    assert(host.querySelector(".extra").hidden && !host.querySelector("button"), "More restored, controls removed");
  });
  await test("editing visible labels preserves missing/More order entries", async () => {
    const list = fixture(["Alpha", "Beta", "Gamma"]); on(["label/Hidden B", "label/Hidden A", "label/Gamma", "label/Alpha", "label/Beta"]);
    feature.edit(); await settle();
    list.querySelector('a[href="#label/Gamma"]').closest(".aim").querySelector("button").dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })); await settle();
    assert(saved.indexOf("label/Hidden B") < saved.indexOf("label/Hidden A"), "hidden ranks preserved");
    const hiddenList = host.querySelector(".extra .TK"); equal(ids(hiddenList), ["Hidden B", "Hidden A"]);
  });
  await test("storage failure reports error without changing order", async () => {
    const list = fixture(["Alpha", "Beta", "Gamma"]); on(); feature.edit(); await settle();
    const before = ids(list); fail = true;
    list.querySelector('a[href="#label/Gamma"]').closest(".aim").querySelector("button").dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })); await settle(); fail = false;
    equal(ids(list), before); assert(host.querySelector('[role="status"]').textContent.includes("Couldn’t save"), "failure announced");
  });
  await test("pointer handles reorder and ordinary message drag remains untouched", async () => {
    const list = fixture(["Alpha", "Beta", "Gamma"]); on(); feature.edit(); await settle();
    const button = list.querySelector('a[href="#label/Gamma"]').closest(".aim").querySelector("button");
    button.setPointerCapture = () => {};
    button.hasPointerCapture = () => false;
    const source = button.getBoundingClientRect();
    const target = list.querySelector('a[href="#label/Beta"]').closest(".aim").getBoundingClientRect();
    const send = (type, x, y) => button.dispatchEvent(new PointerEvent(type, {
      bubbles: true, cancelable: true, pointerId: 1, isPrimary: true, button: 0, clientX: x, clientY: y
    }));
    send("pointerdown", source.left + 2, source.top + 2);
    send("pointermove", target.left + 2, target.bottom - 1);
    send("pointerup", target.left + 2, target.bottom - 1);
    await settle(); equal(ids(list), ["Alpha", "Beta", "Gamma"]);
    const external = new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: new DataTransfer() });
    list.lastElementChild.dispatchEvent(external); assert(!external.defaultPrevented, "message drag preserved");
    feature.stop(); assert(!host.querySelector("button"), "stop cleans handles");
  });
  await test("unknown structure and orphan children fail closed", async () => {
    const list = fixture(["Alpha", "Beta", "Gamma"]); const bad = document.createElement("button"); list.append(bad); on();
    equal(ids(list), ["Alpha", "Beta", "Gamma"]);
    const orphan = fixture(["Missing/Child", "Beta", "Gamma"]); on(); equal(ids(orphan), ["Missing/Child", "Beta", "Gamma"]);
  });
  await test("large list remains stable and cleanup removes ordering styles", async () => {
    const names = Array.from({ length: 300 }, (_, i) => `Label ${String(i).padStart(3, "0")}`);
    const list = fixture(names); on(names.slice().reverse().map(name => "label/" + name));
    equal(ids(list), names.slice().reverse()); await settle(); feature.stop(); equal(ids(list), names);
    assert(list.childNodes.length === 300 && !list.hasAttribute("style") && [...list.children].every(n => !n.hasAttribute("style")), "native styles restored");
  });
  await test("delayed initial sidebar discovery", async () => {
    feature.stop(); host.innerHTML = ""; on();
    const section = document.createElement("div"); section.innerHTML = '<div gh="cl"><div class="TK"></div></div>';
    ["Alpha", "Beta", "Gamma"].forEach(name => section.querySelector(".TK").append(row(name)));
    host.append(section); await settle(); equal(ids(section), ["Gamma", "Alpha", "Beta"]); feature.stop();
  });
  await test("partially rendered rows recover when links and menus arrive", async () => {
    const list = fixture(["Alpha", "Beta", "Gamma"]); on();
    const incomplete = document.createElement("div"); incomplete.className = "aim"; list.prepend(incomplete);
    await settle(); assert(!list.hasAttribute("style"), "unknown row restores native layout");
    incomplete.append(row("New").firstChild); await settle();
    equal(ids(list), ["Gamma", "Alpha", "Beta", "New"]); feature.stop();
  });
  await test("normal label events, unread counts and unrelated settings stay native", async () => {
    const list = fixture(["Alpha", "Beta", "Gamma"]); let clicks = 0, menus = 0, drags = 0;
    list.firstChild.addEventListener("click", event => { event.preventDefault(); clicks++; });
    list.firstChild.addEventListener("contextmenu", event => { event.preventDefault(); menus++; });
    list.firstChild.addEventListener("drop", () => drags++);
    on(); list.firstChild.querySelector("a").click();
    list.firstChild.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
    list.firstChild.dispatchEvent(new DragEvent("drop", { bubbles: true }));
    equal([clicks, menus, drags], [1, 1, 1]);
    list.firstChild.querySelector(".unread").textContent = "0";
    feature.update({ autoBccEnabled: true, newestEmailFirstEnabled: true, appleMailMessageListEnabled: true });
    await settle(); equal(ids(list), ["Gamma", "Alpha", "Beta"]); feature.stop();
  });
  const failures = reports.filter(line => line.startsWith("FAIL")).length;
  results.textContent = `${reports.join("\n")}\n\n${reports.length - failures}/${reports.length} checks passed. ${writes} synthetic saves.`;
  results.dataset.failures = String(failures);
})();
