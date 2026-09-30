(async () => {
  "use strict";
  const feature = GmailPro.labelOrder;
  const host = document.getElementById("workspace");
  const results = document.getElementById("results");
  const reports = [];
  let saved = [], writes = 0, fail = false, failRead = false, prefs;
  let nativeSaves = 0, badEditor = false, refuseSave = false, deferEditor = false, model;
  let deferSave = false, pendingCommit, changeAccountOnSelect = false, collapseDestination = false;
  let badgeHidden, reuseMenu = false, nativeMenuNode, unknownMenu = false, deferredRead;
  const settings = GmailPro.settings;
  GmailPro.settings = { ...settings, async load() {
    if (failRead) throw new Error("read unavailable");
    if (deferredRead) await new Promise(resolve => { deferredRead = resolve; });
    return structuredClone(prefs);
  }, async save(patch) {
    if (fail) throw new Error("quota");
    if (patch.customLabelOrder) saved = [...patch.customLabelOrder];
    Object.assign(prefs, structuredClone(patch)); writes++;
    feature.update(patch);
  } };
  const settle = () => new Promise(resolve => setTimeout(resolve, 30));
  async function eventually(check, timeout = 6500) {
    const deadline = performance.now() + timeout;
    while (!check() && performance.now() < deadline) await settle();
    assert(check(), "expected result did not arrive");
  }
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
    menu.addEventListener("click", event => { event.stopPropagation(); showNativeMenu(name); });
    menu.tabIndex = 0;
    menu.addEventListener("keydown", event => { if (["Enter", " ", "ArrowDown"].includes(event.key)) showNativeMenu(name); });
    const count = document.createElement("span"); count.className = "unread"; count.textContent = "6"; count.style.color = "red";
    line.append(link, count, menu); element.append(line); return element;
  }
  function showNativeMenu(name) {
    const menu = reuseMenu && nativeMenuNode?.isConnected ? nativeMenuNode : document.createElement("div");
    for (const other of document.querySelectorAll('.aka')) if (other !== menu) other.style.display = 'none';
    menu.replaceChildren(); menu.className = "aka"; menu.setAttribute("role", "menu"); menu.tabIndex = 0;
    menu.style.display = "block"; menu.removeAttribute('aria-activedescendant'); nativeMenuNode = menu;
    const heading = document.createElement('div'); heading.textContent = unknownMenu ? 'Unknown menu' : 'In message list';
    menu.append(heading);
    for (const [index, text] of ["Show", "Hide", "Edit", "Remove label", "Add sublabel"].entries()) {
      const item = document.createElement("div"); item.setAttribute("role", index < 2 ? "menuitemcheckbox" : "menuitem"); item.textContent = text;
      item.style.color = 'rgb(32, 33, 36)'; menu.style.backgroundColor = 'white';
      item.id = 'native-action-' + index;
      if (index < 2) {
        item.setAttribute('aria-checked', String(badgeHidden.has(name) === (text === 'Hide')));
        item.addEventListener('click', () => { if (text === 'Hide') badgeHidden.add(name); else badgeHidden.delete(name); menu.style.display = 'none'; });
      }
      if (text === "Edit") item.addEventListener("click", () => {
        menu.remove(); if (!deferEditor) showEditor(name);
      });
      menu.append(item);
    }
    menu.onkeydown = event => {
      if (event.key === 'Escape' || event.key === 'Tab') { menu.style.display = 'none'; return; }
      const items = [...menu.children].filter(n => n.id.startsWith('native-action-'));
      const index = items.findIndex(n => n.id === menu.getAttribute('aria-activedescendant'));
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 :
        event.key === 'ArrowDown' ? (index + 1) % items.length : event.key === 'ArrowUp' ? (index + items.length - 1) % items.length : -1;
      if (next >= 0) { event.preventDefault(); menu.setAttribute('aria-activedescendant', items[next].id); }
    };
    menu.onblur = () => { menu.style.display = 'none'; };
    if (!menu.isConnected) document.body.append(menu);
    menu.focus({preventScroll:true});
    return menu;
  }
  function showEditor(name) {
    const parent = name.slice(0, name.lastIndexOf("/")), leaf = name.slice(name.lastIndexOf("/") + 1);
    const dialog = document.createElement("div"); dialog.setAttribute("role", "alertdialog"); dialog.setAttribute("aria-label", "Edit label");
    dialog.innerHTML = '<h2>Edit label</h2><label for="native-name">Label name:</label><input id="native-name" type="text"><label for="native-nest">Nest label under:</label><input id="native-nest" type="checkbox" checked><div role="combobox" aria-label="Nest label under:" aria-controls="native-parents" aria-expanded="false" tabindex="0"></div><ul id="native-parents" role="listbox" style="display:none"></ul><button>Cancel</button><button>Save</button>';
    dialog.querySelector('input[type="text"]').value = badEditor ? "Different label" : leaf;
    const combo = dialog.querySelector('[role="combobox"]'), list = dialog.querySelector("ul");
    combo.textContent = parent;
    combo.addEventListener("click", () => { list.style.display = "block"; combo.setAttribute("aria-expanded", "true"); });
    for (const key of model.keys()) {
      const option = document.createElement("li"); option.setAttribute("role", "option"); option.dataset.value = key; option.textContent = key;
      option.addEventListener("click", () => {
        combo.textContent = key; combo.setAttribute("aria-expanded", "false"); list.style.display = "none";
        for (const item of list.children) item.setAttribute("aria-selected", String(item === option));
        if (changeAccountOnSelect) host.querySelector('header button').setAttribute("aria-label", "Unknown account");
      });
      list.append(option);
    }
    dialog.querySelectorAll("button")[0].addEventListener("click", () => dialog.remove());
    dialog.querySelectorAll("button")[1].addEventListener("click", () => {
      if (refuseSave) return;
      const commit = () => {
        nativeSaves++;
        const newName = combo.textContent + "/" + dialog.querySelector('input[type="text"]').value;
        const next = new Map();
        for (const [path, assignments] of model) next.set(path === name || path.startsWith(name + "/") ? newName + path.slice(name.length) : path, assignments);
        model = next;
        host.querySelector(".TK").replaceChildren(...[...model.keys()].sort().map(path => row(path, path.split("/").length - 1)));
        if (collapseDestination) {
          const nativeList = host.querySelector('.TK'), parentName = combo.textContent;
          for (const node of [...nativeList.children]) if (ids(node)[0].startsWith(parentName + '/')) node.remove();
          const parentRow = [...nativeList.children].find(node => ids(node)[0] === parentName);
          const expand = document.createElement('div'); expand.setAttribute('role', 'link'); expand.title = 'Expand label: ' + parentName;
          expand.addEventListener('click', () => {
            parentRow.after(...[...model.keys()].filter(path => path.startsWith(parentName + '/')).sort().map(path => row(path, path.split('/').length - 1)));
            expand.remove();
          });
          parentRow.querySelector('.TN').append(expand);
        }
        dialog.remove();
      };
      if (deferSave) pendingCommit = commit; else commit();
    });
    document.body.append(dialog);
  }
  const handle = (list, name) => [...list.children].find(node => ids(node)[0] === name)?.querySelector(".gmail-pro-label-handle");
  const eye = (list, name) => [...list.children].find(node => ids(node)[0] === name)?.querySelector(".gmail-pro-label-eye");
  function drag(list, name, targetName, cancel = false) {
    const button = handle(list, name); button.setPointerCapture = () => {}; button.hasPointerCapture = () => false;
    const source = button.getBoundingClientRect();
    const target = [...list.children].find(node => ids(node)[0] === targetName).getBoundingClientRect();
    const send = (type, x, y) => button.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true,
      pointerId: 4, isPrimary: true, button: 0, clientX: x, clientY: y }));
    send("pointerdown", source.left + 2, source.top + 2);
    send("pointermove", target.left + 12, target.top + target.height / 2);
    send(cancel ? "pointercancel" : "pointerup", target.left + 12, target.top + target.height / 2);
  }
  function fixture(names = ["Alpha", "Alpha/Child", "Alpha/Child/Grandchild", "Beta", "Gamma"]) {
    feature.stop();
    document.querySelectorAll('.aka, [role="alertdialog"]').forEach(node => node.remove());
    prefs = { ...settings.defaults, customLabelOrder: [], sidebarHiddenSublabels: [] };
    fail = false; failRead = false; badEditor = false; refuseSave = false; deferEditor = false; nativeSaves = 0;
    deferSave = false; pendingCommit = null; changeAccountOnSelect = false; collapseDestination = false;
    badgeHidden = new Set(); reuseMenu = false; nativeMenuNode = null; unknownMenu = false; deferredRead = null;
    host.removeAttribute('style');
    model = new Map(names.map(name => [name, ["synthetic-message"]]));
    host.innerHTML = '<header role="banner"><button aria-label="Google Account: Fixture (one@example.test)">Account</button></header><div class="label-heading"><span>Labels</span><div role="button" aria-label="Create new label" tabindex="0">+</div></div><div aria-labelledby="label-heading"><h2 id="label-heading">Labels</h2><div gh="cl"><div class="TK"></div></div><span gh="mll" role="button" aria-label="More labels" tabindex="0">More</span><div class="extra" hidden></div></div><div class="system"><a href="#inbox">Inbox</a><a href="#sent">Sent</a></div>';
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
  const on = (customLabelOrder = ["label/Gamma", "label/Alpha", "label/Beta"]) => {
    Object.assign(prefs, { customLabelOrderEnabled: true, customLabelOrder }); feature.start(prefs);
  };
  async function labelMenuFor(list, name, key) {
    const source = [...list.children].find(node => ids(node)[0] === name).querySelector('[data-label-name]');
    source.dispatchEvent(key ? new KeyboardEvent('keydown', {key,bubbles:true,cancelable:true}) : new MouseEvent('click', {bubbles:true,cancelable:true}));
    await settle();
    return { source, menu:nativeMenuNode, action:document.querySelector('.gmail-pro-label-menu-action') };
  }
  await test("off is inert; parent moves with multilevel descendants and original nodes", async () => {
    const list = fixture(); const nodes = [...list.children];
    feature.start({ customLabelOrderEnabled: false, customLabelOrder: ["label/Gamma"] });
    assert([...list.children].every((node, i) => node === nodes[i]), "native DOM sequence unchanged");
    on(); equal(ids(list), ["Gamma", "Alpha", "Alpha/Child", "Alpha/Child/Grandchild", "Beta"]);
    assert([...list.children].every((node, i) => node === nodes[i]), "native DOM sequence unchanged after ordering");
    assert(list.querySelectorAll(".unread").length === 5 && !host.querySelector(".gmail-pro-label-handle"), "counts and normal mode preserved");
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
  await test("edit keeps More closed, handles roots and sublabels, keyboard reorder saves; Escape cleans up", async () => {
    const list = fixture(); on(); assert(feature.edit(), "edit available"); await settle();
    equal(host.querySelectorAll(".gmail-pro-label-handle").length, 5);
    assert(host.querySelector(".extra").hidden, "More remains closed");
    const button = list.querySelector('a[href="#label/Gamma"]').closest(".aim").querySelector("button");
    button.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })); await settle();
    equal(ids(list), ["Alpha", "Alpha/Child", "Alpha/Child/Grandchild", "Gamma", "Beta"]);
    assert(saved.indexOf("label/Alpha") < saved.indexOf("label/Gamma"), "saved keyboard order");
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); await settle();
    assert(host.querySelector(".extra").hidden && !host.querySelector(".gmail-pro-label-handle"), "More preserved, edit controls removed");
  });
  await test("editing visible labels preserves missing/More order entries", async () => {
    const list = fixture(["Alpha", "Beta", "Gamma"]); on(["label/Hidden B", "label/Hidden A", "label/Gamma", "label/Alpha", "label/Beta"]);
    feature.edit(); await settle();
    host.querySelector('[gh="mll"]').click(); await settle();
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
    feature.stop(); assert(!host.querySelector(".gmail-pro-label-handle, .gmail-pro-label-organize"), "stop cleans controls");
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
  await test("header organizer works with ordering off, stays beside +, and reordering enables the existing preference", async () => {
    const list = fixture(["Alpha", "Beta", "Gamma"]); feature.start(prefs);
    const organize = host.querySelector(".gmail-pro-label-organize");
    assert(organize?.nextElementSibling?.getAttribute("aria-label") === "Create new label", "button beside +");
    organize.click(); await settle(); assert(host.querySelector(".gmail-pro-label-toolbar"), "edit open");
    handle(list, "Beta").dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true })); await settle();
    assert(prefs.customLabelOrderEnabled && ids(list)[0] === "Beta", "ordering enabled on explicit reorder");
    organize.click(); await settle(); assert(!host.querySelector(".gmail-pro-label-toolbar"), "button exits editing");
  });
  await test("native list hiding, visibility classes, row hidden and More are never overridden", async () => {
    const list = fixture(); on(); feature.edit();
    list.style.display = "none"; await settle(); equal(getComputedStyle(list).display, "none");
    list.style.removeProperty("display"); await settle(); equal(getComputedStyle(list).display, "flex");
    const style = document.createElement("style"); style.textContent = ".native-hidden { display:none !important }"; host.append(style);
    list.classList.add("native-hidden"); await settle(); equal(getComputedStyle(list).display, "none");
    list.classList.remove("native-hidden"); await settle(); equal(getComputedStyle(list).display, "flex");
    list.hidden = true; await settle(); equal(getComputedStyle(list).display, "none");
    list.hidden = false; await settle();
    list.firstChild.hidden = true; await settle(); equal(getComputedStyle(list.firstChild).display, "none");
    assert(host.querySelector(".extra").hidden, "More remains closed");
  });
  await test("hide a branch, reveal and restore it; native badges and order are unchanged", async () => {
    const list = fixture(); on(); feature.edit(); const sequence = [...list.children];
    eye(list, "Alpha/Child").click(); await settle();
    equal(prefs.sidebarHiddenSublabels, [{ account: "one@example.test", path: "label/Alpha/Child" }]);
    const child = handle(list, "Alpha/Child").closest(".aim"), grandchild = handle(list, "Alpha/Child/Grandchild").closest(".aim");
    equal(getComputedStyle(child).display, "none"); equal(getComputedStyle(grandchild).display, "none");
    assert([...list.children].every((node,i) => node === sequence[i]), "native nodes unchanged");
    assert(child.querySelector(".unread").textContent === "6", "badge untouched");
    const reveal = host.querySelector('.gmail-pro-label-toolbar input'); reveal.click(); await settle();
    assert(getComputedStyle(child).display !== "none" && eye(list, "Alpha/Child/Grandchild").disabled, "reveal marks inherited hiding");
    eye(list, "Alpha/Child").click(); await settle(); equal(prefs.sidebarHiddenSublabels, []);
    assert(!child.hasAttribute("data-gmail-pro-label-hidden") && !grandchild.hasAttribute("data-gmail-pro-label-hidden"), "branch restored");
  });
  await test("visibility persists independently of ordering and is isolated by verified account", async () => {
    const list = fixture(); on(); feature.edit(); eye(list, "Alpha/Child").click(); await settle();
    feature.update({ customLabelOrderEnabled: false }); await settle();
    const child = handle(list, "Alpha/Child").closest(".aim"); equal(getComputedStyle(child).display, "none");
    feature.stop(); assert(!child.hasAttribute("data-gmail-pro-label-hidden"), "stop restores native display");
    feature.start(prefs); await settle(); equal(getComputedStyle(child).display, "none");
    host.querySelector('header button').setAttribute("aria-label", "Google Account: Second (two@example.test)"); await settle();
    assert(!child.hasAttribute("data-gmail-pro-label-hidden"), "other account unaffected");
    host.querySelector('header button').setAttribute("aria-label", "Unknown account"); await settle(); feature.edit();
    assert(eye(list, "Alpha/Child").disabled, "ambiguous account fails closed");
  });
  await test("read/write failures leave previous sidebar visibility unchanged", async () => {
    const list = fixture(); on(); feature.edit(); fail = true; eye(list, "Alpha/Child").click(); await settle();
    equal(prefs.sidebarHiddenSublabels, []); assert(!list.querySelector('[data-gmail-pro-label-hidden]'), "failed write kept visibility");
    fail = false; failRead = true; eye(list, "Alpha/Child").click(); await settle(); failRead = false;
    equal(prefs.sidebarHiddenSublabels, []); assert(host.querySelector('[role="status"]').textContent.includes("Couldn’t save"), "failure reported");
  });
  await test("pointer move uses Gmail editor once, preserves names, descendants and assignments, and remaps hidden paths", async () => {
    const list = fixture(); on(); feature.edit();
    eye(list, "Alpha/Child/Grandchild").click(); await settle();
    const grandchild = handle(list, "Alpha/Child/Grandchild").closest(".aim"); grandchild.remove(); await settle();
    drag(list, "Alpha/Child", "Beta"); await settle();
    equal(nativeSaves, 1); assert(model.has("Beta/Child") && model.has("Beta/Child/Grandchild") && !model.has("Alpha/Child"), "whole branch moved");
    equal(model.get("Beta/Child"), ["synthetic-message"]); equal(model.get("Beta/Child/Grandchild"), ["synthetic-message"]);
    equal(prefs.sidebarHiddenSublabels, [{ account:"one@example.test", path:"label/Beta/Child/Grandchild" }]);
    assert(host.querySelector('[role="status"]').textContent.includes("Moved under Beta"), "committed move reported");
  });
  await test("self, current parent and descendant drops never open the editor or save", async () => {
    const list = fixture(); on(); feature.edit();
    for (const target of ["Alpha/Child", "Alpha", "Alpha/Child/Grandchild"]) { drag(list, "Alpha/Child", target); await settle(); }
    equal(nativeSaves, 0); assert(!document.querySelector('[role="alertdialog"]'), "invalid drop ignored");
  });
  await test("pointer cancellation and row removal cancel stale drags", async () => {
    const list = fixture(); on(); feature.edit(); drag(list, "Alpha/Child", "Beta", true); await settle(); equal(nativeSaves, 0);
    const button = handle(list, "Alpha/Child"); button.setPointerCapture = () => {}; button.hasPointerCapture = () => false;
    button.dispatchEvent(new PointerEvent("pointerdown", { bubbles:true, pointerId:9, isPrimary:true, button:0 }));
    button.closest(".aim").remove(); await settle();
    button.dispatchEvent(new PointerEvent("pointerup", { bubbles:true, pointerId:9, isPrimary:true, button:0 })); await settle(); equal(nativeSaves, 0);
    assert(!host.querySelector('.gmail-pro-label-parent, .gmail-pro-label-dragging'), "drag feedback cleared");
  });
  await test("wrong native editor aborts without saving and preserves native fallback", async () => {
    const list = fixture(); on(); feature.edit(); badEditor = true; drag(list, "Alpha/Child", "Beta"); await settle();
    equal(nativeSaves, 0); assert(model.has("Alpha/Child"), "original label retained");
    assert(host.querySelector('[role="status"]').textContent.includes("different label"), "actionable error");
    assert(!document.querySelector('[role="alertdialog"]'), "owned dialog cancelled");
  });
  await test("keyboard opens the native editor and tracks Save/Cancel with hidden-path migration", async () => {
    const list = fixture(); on(); feature.edit(); eye(list, "Alpha/Child").click(); await settle();
    host.querySelector('.gmail-pro-label-toolbar input').click(); await settle();
    handle(list, "Alpha/Child").dispatchEvent(new KeyboardEvent("keydown", { key:"Enter", bubbles:true })); await settle();
    let dialog = document.querySelector('[role="alertdialog"]'); assert(dialog, "native editor opened"); equal(nativeSaves, 0);
    dialog.querySelector('button').click(); await settle(); assert(model.has("Alpha/Child"), "Cancel left hierarchy unchanged");
    handle(list, "Alpha/Child").dispatchEvent(new KeyboardEvent("keydown", { key:"Enter", bubbles:true })); await settle();
    dialog = document.querySelector('[role="alertdialog"]'); dialog.querySelector('[role="combobox"]').click();
    [...dialog.querySelectorAll('[role="option"]')].find(option => option.dataset.value === "Beta").click();
    dialog.querySelectorAll('button')[1].click(); await settle(); equal(nativeSaves, 1);
    equal(prefs.sidebarHiddenSublabels, [{ account:"one@example.test", path:"label/Beta/Child" }]);
  });
  await test("Gmail commit survives a preference-save failure with a truthful partial-success message", async () => {
    const list = fixture(); on(); feature.edit(); eye(list, "Alpha/Child").click(); await settle();
    host.querySelector('.gmail-pro-label-toolbar input').click(); await settle(); fail = true;
    drag(list, "Alpha/Child", "Beta"); await settle(); equal(nativeSaves, 1); assert(model.has("Beta/Child"), "Gmail commit preserved");
    assert(host.querySelector('[role="status"]').textContent.includes("Moved in Gmail, but"), "partial success reported"); fail = false;
  });
  await test("Escape cancels a pending editor discovery and releases operation state", async () => {
    const list = fixture(); on(); feature.edit(); deferEditor = true; drag(list, "Alpha/Child", "Beta"); await settle();
    document.dispatchEvent(new KeyboardEvent("keydown", {key:"Escape", bubbles:true})); await settle(); equal(nativeSaves, 0);
    assert(!host.querySelector('.gmail-pro-label-toolbar'), "edit mode exited");
    deferEditor = false; feature.edit(); drag(list, "Alpha/Child", "Beta"); await settle(); equal(nativeSaves, 1);
  });
  await test("Done after Gmail Save still verifies the commit and migrates hidden descendants", async () => {
    const list = fixture(); on(); feature.edit(); eye(list, "Alpha/Child/Grandchild").click(); await settle();
    deferSave = true; drag(list, "Alpha/Child", "Beta"); await settle(); assert(pendingCommit, "Save reached Gmail");
    host.querySelector('.gmail-pro-label-toolbar button').click(); await settle();
    assert(!host.querySelector('.gmail-pro-label-toolbar'), "Done exits immediately");
    pendingCommit(); await settle(); equal(nativeSaves, 1);
    equal(prefs.sidebarHiddenSublabels, [{account:"one@example.test", path:"label/Beta/Child/Grandchild"}]);
    assert([...list.children].find(node => ids(node)[0] === "Beta/Child/Grandchild").getAttribute("data-gmail-pro-label-hidden") === "hidden", "persisted hiding applied outside edit mode");
  });
  await test("Gmail rejection reports uncertainty without retrying or remapping preferences", async () => {
    const list = fixture(); on(); feature.edit(); refuseSave = true; drag(list, "Alpha/Child", "Beta");
    await eventually(() => host.querySelector('[role="status"]').textContent.includes("hasn’t confirmed"));
    equal(nativeSaves, 0); assert(model.has("Alpha/Child"), "source kept"); equal(prefs.sidebarHiddenSublabels, []);
    assert(document.querySelector('[role="alertdialog"]'), "Gmail validation remains available");
  });
  await test("collapsed name collisions and account changes abort before native Save", async () => {
    let list = fixture(["Alpha", "Alpha/Child", "Beta", "Beta/Child"]); on(); feature.edit();
    handle(list, "Beta/Child").closest('.aim').remove(); await settle(); drag(list, "Alpha/Child", "Beta"); await settle();
    equal(nativeSaves, 0); assert(host.querySelector('[role="status"]').textContent.includes("already has"), "collision found in native parent picker");
    list = fixture(); on(); feature.edit(); changeAccountOnSelect = true; drag(list, "Alpha/Child", "Beta"); await settle();
    equal(nativeSaves, 0); assert(!document.querySelector('[role="alertdialog"]'), "stale owned editor cancelled");
  });
  await test("post-commit preference read failure reports the successful Gmail move", async () => {
    const list = fixture(); on(); feature.edit(); failRead = true; drag(list, "Alpha/Child", "Beta"); await settle();
    equal(nativeSaves, 1); assert(host.querySelector('[role="status"]').textContent.includes("Moved in Gmail, but couldn’t load"), "read failure distinguished from Gmail failure");
  });
  await test("native hover mutations preserve an active pointer gesture", async () => {
    const list = fixture(); on(); feature.edit();
    const button = handle(list, "Alpha/Child"); button.setPointerCapture = () => {}; button.hasPointerCapture = () => false;
    const target = handle(list, "Beta").getBoundingClientRect();
    const send = type => button.dispatchEvent(new PointerEvent(type, {bubbles:true, cancelable:true, pointerId:11, isPrimary:true, button:0, clientX:target.left+12, clientY:target.top+12}));
    button.dispatchEvent(new PointerEvent("pointerdown", {bubbles:true, cancelable:true, pointerId:11, isPrimary:true, button:0}));
    send("pointermove"); button.closest('.aim').querySelector('[data-label-name]').style.color = "blue";
    await settle(); assert(list.querySelector('.gmail-pro-label-parent'), "destination survives native hover");
    send("pointerup"); await settle(); equal(nativeSaves, 1);
  });
  await test("a collapsed destination uses Gmail’s title-labelled disclosure to verify the saved path", async () => {
    const list = fixture(); on(); feature.edit(); collapseDestination = true;
    drag(list, 'Alpha/Child', 'Beta'); await settle(); equal(nativeSaves, 1);
    assert(handle(list, 'Beta/Child') && handle(list, 'Beta/Child/Grandchild'), 'native destination expanded');
    assert(host.querySelector('[role="status"]').textContent.includes('Moved under Beta'), 'result verified');
  });
  await test("pointer edge scrolling advances the native sidebar and cancellation stops it", async () => {
    const list = fixture(['Alpha', 'Alpha/Child', ...Array.from({length:30}, (_,i) => 'Beta ' + i)]); on([]); feature.edit();
    host.style.maxHeight = '330px'; host.style.overflowY = 'auto'; host.scrollIntoView();
    const button = handle(list, 'Alpha/Child'); button.setPointerCapture = () => {}; button.hasPointerCapture = () => false;
    const source = button.getBoundingClientRect(), bounds = host.getBoundingClientRect();
    button.dispatchEvent(new PointerEvent('pointerdown', {bubbles:true, cancelable:true, pointerId:12, isPrimary:true, button:0, clientX:source.left+4, clientY:source.top+4}));
    button.dispatchEvent(new PointerEvent('pointermove', {bubbles:true, cancelable:true, pointerId:12, isPrimary:true, button:0, clientX:bounds.left+40, clientY:bounds.bottom-12}));
    await eventually(() => host.scrollTop > 0, 500); assert(host.scrollTop > 0, 'native scroll host advanced');
    button.dispatchEvent(new PointerEvent('pointercancel', {bubbles:true, pointerId:12})); const stopped = host.scrollTop;
    await settle(); equal(host.scrollTop, stopped); equal(nativeSaves, 0);
  });
  await test("Escape from native controls exits organization without swallowing Gmail’s handler", async () => {
    fixture(); on(); feature.edit();
    const native = host.querySelector('.system a'); let escapes = 0;
    native.addEventListener('keydown', event => { if (event.key === 'Escape') escapes++; });
    native.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape',bubbles:true,cancelable:true}));
    equal(escapes, 1); assert(!host.querySelector('.gmail-pro-label-toolbar'), 'editing exited');
  });
  await test("native menu hides a branch outside editing with ordering off and no badge or assignment changes", async () => {
    const list = fixture(); feature.start(prefs); const sequence = [...list.children], before = writes;
    const {action, menu} = await labelMenuFor(list, 'Alpha/Child');
    assert(action?.textContent === 'Hide from sidebar — Gmail Pro', 'separate sidebar action');
    equal(getComputedStyle(action).color, getComputedStyle(menu.querySelector('[role="menuitemcheckbox"]')).color);
    action.click(); action.click(); await settle();
    equal(writes, before + 1); equal(prefs.sidebarHiddenSublabels, [{account:'one@example.test',path:'label/Alpha/Child'}]);
    assert(!prefs.customLabelOrderEnabled && !host.querySelector('.gmail-pro-label-toolbar'), 'normal mode and ordering off retained');
    assert(sequence.every((node,i)=>list.children[i]===node), 'native sequence retained');
    for (const node of sequence.slice(1,3)) equal(getComputedStyle(node).display, 'none');
    equal([...badgeHidden], []); equal([...model.values()], Array(5).fill(['synthetic-message']));
    equal(menu.style.display, 'none'); assert(host.querySelector('.gmail-pro-label-notice [role="status"]').textContent.includes('Show hidden sublabels'), 'restoration explained');
  });
  await test("revealed hidden branches can be restored from the menu and inherited descendants are disabled", async () => {
    const list = fixture(); on(); let opened = await labelMenuFor(list, 'Alpha/Child'); opened.action.click(); await settle();
    feature.edit(); host.querySelector('.gmail-pro-label-toolbar input').click(); await settle();
    opened = await labelMenuFor(list, 'Alpha/Child/Grandchild');
    assert(opened.action.disabled && opened.action.textContent.includes('restore parent first'), 'inherited hiding explained');
    const before = writes; opened.action.click(); await settle(); equal(writes, before);
    opened = await labelMenuFor(list, 'Alpha/Child', 'Enter');
    equal(opened.action.textContent, 'Show in sidebar — Gmail Pro'); opened.action.click(); await settle();
    equal(prefs.sidebarHiddenSublabels, []); assert(!list.querySelector('[data-gmail-pro-label-hidden]'), 'branch restored');
  });
  await test("native badge Hide remains native and roots or unsupported menus receive no sidebar action", async () => {
    let list = fixture(); feature.start(prefs);
    let opened = await labelMenuFor(list, 'Alpha/Child');
    [...opened.menu.querySelectorAll('[role="menuitemcheckbox"]')].find(n=>n.textContent==='Hide').click(); await settle();
    assert(badgeHidden.has('Alpha/Child'), 'native badge action handled'); equal(prefs.sidebarHiddenSublabels, []);
    assert(getComputedStyle(list.children[1]).display !== 'none' && !document.querySelector('.gmail-pro-label-menu-action'), 'sidebar remains native');
    opened = await labelMenuFor(list, 'Alpha'); assert(!opened.action, 'top-level native menu left alone');
    list = fixture(); feature.start(prefs); unknownMenu = true;
    opened = await labelMenuFor(list, 'Alpha/Child'); assert(!opened.action, 'unknown menu skipped');
    feature.stop(); await settle(); assert(!document.querySelector('.gmail-pro-label-menu-action'), 'pending discovery retired');
  });
  await test("keyboard arrows and End include the added action while Home and native items keep Gmail ownership", async () => {
    const list = fixture(); feature.start(prefs);
    const {menu, action} = await labelMenuFor(list, 'Alpha/Child', 'Enter');
    const key = (node, value) => node.dispatchEvent(new KeyboardEvent('keydown', {key:value,bubbles:true,cancelable:true}));
    const selected = () => {
      assert(document.activeElement === menu && menu.style.display !== 'none', 'Gmail menu retains focus and stays open');
      equal(menu.getAttribute('aria-activedescendant'), action.id);
      assert(action.classList.contains('gmail-pro-label-menu-selected'), 'selection visible');
    };
    key(menu, 'End'); selected();
    key(menu, 'ArrowUp'); equal(menu.getAttribute('aria-activedescendant'), 'native-action-4');
    key(menu, 'ArrowDown'); selected();
    key(menu, 'ArrowDown'); equal(menu.getAttribute('aria-activedescendant'), 'native-action-0');
    key(menu, 'ArrowUp'); selected();
    key(menu, 'Home'); equal(menu.getAttribute('aria-activedescendant'), 'native-action-0');
    key(menu, 'End'); key(menu, ' '); await settle();
    equal(prefs.sidebarHiddenSublabels, [{account:'one@example.test',path:'label/Alpha/Child'}]); equal([...badgeHidden], []);
  });
  await test("pointer activation keeps Gmail menu focus through mousedown until the save closes it", async () => {
    const list = fixture(); feature.start(prefs);
    const {menu, action} = await labelMenuFor(list, 'Alpha/Child');
    const down = new MouseEvent('mousedown', {bubbles:true,cancelable:true});
    action.dispatchEvent(down); if (!down.defaultPrevented) action.focus(); await settle();
    assert(document.activeElement === menu && menu.style.display !== 'none', 'pointer did not blur Gmail menu');
    action.click(); await settle();
    equal(prefs.sidebarHiddenSublabels, [{account:'one@example.test',path:'label/Alpha/Child'}]); equal(menu.style.display, 'none');
  });
  await test("Escape from the custom menu action closes the menu and keeps organizer editing active", async () => {
    const list = fixture(); on(); feature.edit();
    const {menu, action} = await labelMenuFor(list, 'Alpha/Child');
    menu.dispatchEvent(new KeyboardEvent('keydown', {key:'End',bubbles:true,cancelable:true}));
    menu.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape',bubbles:true,cancelable:true})); await settle();
    equal(menu.style.display, 'none'); assert(host.querySelector('.gmail-pro-label-toolbar'), 'native menu Escape did not exit organizer');
    equal(prefs.sidebarHiddenSublabels, []);
  });
  await test("a reused Gmail menu targets its new label and never keeps duplicate controls", async () => {
    const list = fixture(['Alpha','Alpha/Child','Beta','Beta/Child']); on([]); reuseMenu = true;
    const first = await labelMenuFor(list, 'Alpha/Child');
    const second = await labelMenuFor(list, 'Beta/Child'); assert(first.menu === second.menu, 'native portal reused');
    equal(second.menu.querySelectorAll('.gmail-pro-label-menu-action').length, 1);
    first.action.click(); await settle(); equal(prefs.sidebarHiddenSublabels, []);
    second.action.click(); await settle(); equal(prefs.sidebarHiddenSublabels, [{account:'one@example.test',path:'label/Beta/Child'}]);
    assert(getComputedStyle(list.children[1]).display !== 'none', 'previous source remains shown');
  });
  await test("menu storage failures keep rows visible and show a dismissible error outside editing", async () => {
    const list = fixture(); feature.start(prefs); fail = true;
    let opened = await labelMenuFor(list, 'Alpha/Child'); opened.action.click(); await settle();
    equal(prefs.sidebarHiddenSublabels, []); assert(getComputedStyle(list.children[1]).display !== 'none', 'failed write kept display');
    assert(host.querySelector('.gmail-pro-label-notice [role="status"]').textContent.includes('Couldn’t save'), 'normal-mode failure reported');
    await new Promise(resolve=>setTimeout(resolve,4050)); assert(host.querySelector('.gmail-pro-label-notice'), 'error remains until dismissed');
    host.querySelector('.gmail-pro-label-notice button').click(); assert(!host.querySelector('.gmail-pro-label-notice'), 'error dismissed');
    fail = false; failRead = true; opened.menu.style.display = 'none'; await settle();
    opened = await labelMenuFor(list, 'Alpha/Child'); opened.action.click(); await settle();
    assert(host.querySelector('.gmail-pro-label-notice [role="status"]').textContent.includes('Couldn’t save'), 'read error reported');
    failRead = false; opened.action.click(); await settle(); equal(prefs.sidebarHiddenSublabels, [{account:'one@example.test',path:'label/Alpha/Child'}]);
  });
  await test("account changes and sidebar replacement cancel a delayed menu save before writing", async () => {
    let list = fixture(); feature.start(prefs); let opened = await labelMenuFor(list, 'Alpha/Child');
    deferredRead = true; const before = writes; opened.action.click(); await settle();
    let resolveRead = deferredRead; deferredRead = null;
    host.querySelector('header button').setAttribute('aria-label','Google Account: Other (two@example.test)'); await settle();
    resolveRead(); await settle(); equal(writes, before); equal(prefs.sidebarHiddenSublabels, []);
    list = fixture(); feature.start(prefs); opened = await labelMenuFor(list, 'Alpha/Child');
    deferredRead = true; opened.action.click(); await settle(); resolveRead = deferredRead; deferredRead = null;
    list.replaceChildren(...[...model.keys()].map(path=>row(path,path.split('/').length-1))); await settle();
    resolveRead(); await settle(); equal(writes, before); equal(prefs.sidebarHiddenSublabels, []);
    assert(!document.querySelector('.gmail-pro-label-menu-action'), 'stale control removed');
  });
  await test("closing a menu or stopping the feature removes controls, notices and pending saves", async () => {
    const list = fixture(); feature.start(prefs); let opened = await labelMenuFor(list, 'Alpha/Child');
    opened.menu.style.display = 'none'; await settle(); assert(!document.querySelector('.gmail-pro-label-menu-action'), 'closed menu cleaned');
    opened = await labelMenuFor(list, 'Alpha/Child'); deferredRead = true; const before = writes;
    opened.action.click(); await settle(); const resolveRead = deferredRead; deferredRead = null;
    feature.stop(); resolveRead(); await settle(); equal(writes,before); assert(!document.querySelector('.gmail-pro-label-menu-action, .gmail-pro-label-notice'), 'stop cleaned controls');
    feature.start(prefs); opened = await labelMenuFor(list, 'Alpha/Child'); opened.action.click(); await settle();
    assert(host.querySelector('.gmail-pro-label-notice'), 'normal success notice'); feature.stop();
    assert(!host.querySelector('.gmail-pro-label-notice'), 'notice retired on stop');
  });
  await test("added menu height fits the viewport and its temporary position restores on close", async () => {
    const list = fixture(); feature.start(prefs); const {menu} = await labelMenuFor(list,'Alpha/Child');
    const original = (innerHeight-40) + 'px'; menu.style.position = 'absolute'; menu.style.top = original; await settle();
    assert(menu.getBoundingClientRect().bottom <= innerHeight-6, 'portal fitted inside viewport');
    const top = menu.style.top; await settle(); equal(menu.style.top,top);
    menu.style.display = 'none'; await settle(); equal(menu.style.top,original); equal(menu.style.getPropertyPriority('top'),'');
  });
  feature.stop();
  const failures = reports.filter(line => line.startsWith("FAIL")).length;
  results.textContent = `${reports.join("\n")}\n\n${reports.length - failures}/${reports.length} checks passed. ${writes} synthetic saves.`;
  results.dataset.failures = String(failures);
})();
