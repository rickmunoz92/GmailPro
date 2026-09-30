(() => {
  "use strict";
  const app = (globalThis.GmailPro ??= {});
  if (app.labelOrder) return;
  const S = app.selectors;
  const states = new Map(), handles = new Map(), hiddenRows = new Set();
  let active = false, enabled = false, started = false, order = [], hidden = [];
  let observer, bootstrap, bootstrapTimer, headerButton, toolbar, status, returnFocus;
  let editing = false, revealHidden = false, dragging, scrollFrame = 0, saving = false;
  let operation, generation = 0, orderRevision = 0, hiddenRevision = 0;
  let labelMenu, visibilitySave, notice, noticeTimer;
  const help = "Drag parents to reorder. Drag a sublabel onto its new parent. Enter on a sublabel opens Gmail’s editor.";
  const below = (path, parent) => path.startsWith(parent + "/");
  const visible = node => node?.isConnected && node.getClientRects().length > 0 &&
    getComputedStyle(node).visibility !== "hidden";

  function identity(link) {
    try {
      const url = new URL(link.getAttribute("href"), location.href);
      if (!url.hash.startsWith("#label/")) return null;
      return "label/" + decodeURIComponent(url.hash.slice(7).replace(/\+/g, " "));
    } catch { return null; }
  }

  function account() {
    const accounts = new Set();
    for (const node of document.querySelectorAll(S.labelAccount)) {
      const address = /\(([^()\s]+@[^()\s]+)\)\s*$/.exec(node.getAttribute("aria-label") || "")?.[1];
      if (address && app.settings.isValidEmail(address)) accounts.add(address.toLowerCase());
    }
    return accounts.size === 1 ? [...accounts][0] : null;
  }

  function read(list) {
    const rows = [], groups = [], stack = [];
    for (const node of list.children) {
      if (!node.matches(S.labelRow)) return null;
      const links = node.querySelectorAll(S.labelLink), line = node.querySelector(S.labelLine);
      const menu = node.querySelector(S.labelMenu), id = links.length === 1 && identity(links[0]);
      const indent = line?.style.marginLeft;
      if (!id || !menu || menu.getAttribute("data-label-name") !== id.slice(6) ||
          !/^\d+px$/.test(indent || "")) return null;
      const row = { node, line, menu, link: links[0], id, depth: Number.parseInt(indent, 10), list };
      while (stack.length && stack.at(-1).depth >= row.depth) stack.pop();
      const parent = stack.at(-1);
      if (row.depth && (!parent || !below(id, parent.id))) return null;
      row.parentId = parent?.id;
      if (!row.depth) groups.push({ ...row, rows: [] });
      const group = groups.at(-1);
      if (!group) return null;
      row.groupId = group.id;
      group.rows.push(row); rows.push(row); stack.push(row);
    }
    return new Set(rows.map(row => row.id)).size === rows.length ? groups : null;
  }

  function allRows() {
    return [...states.keys()].filter(list => list.isConnected).flatMap(list =>
      (read(list) || []).flatMap(group => group.rows));
  }
  function findRow(id) {
    const rows = allRows().filter(row => row.id === id);
    return rows.length === 1 ? rows[0] : null;
  }
  function rank(groups) {
    const ranks = new Map(order.map((id, index) => [id, index]));
    return groups.slice().sort((a, b) => (ranks.get(a.id) ?? Infinity) - (ranks.get(b.id) ?? Infinity));
  }
  function hiddenBy(row, owner = account()) {
    // Native indentation, not slashes alone, distinguishes Gmail sublabels.
    return row.depth && owner ? hidden.find(entry => entry.account === owner &&
      (entry.path === row.id || below(row.id, entry.path)))?.path : null;
  }

  function style(state, node, property, value) {
    let properties = state.styles.get(node);
    if (!properties) { properties = new Map(); state.styles.set(node, properties); }
    let entry = properties.get(property);
    if (!entry || (node.style.getPropertyValue(property) !== entry.applied ||
        node.style.getPropertyPriority(property) !== "important")) {
      entry = { value: node.style.getPropertyValue(property), priority: node.style.getPropertyPriority(property) };
      properties.set(property, entry);
    }
    entry.applied = value;
    if (node.style.getPropertyValue(property) !== value || node.style.getPropertyPriority(property) !== "important") {
      node.style.setProperty(property, value, "important");
    }
  }
  function restoreNode(state, node) {
    const properties = state.styles.get(node);
    if (!properties) return;
    for (const [property, entry] of properties) {
      if (node.style.getPropertyValue(property) !== entry.applied || node.style.getPropertyPriority(property) !== "important") continue;
      if (entry.value) node.style.setProperty(property, entry.value, entry.priority);
      else node.style.removeProperty(property);
    }
    if (node.getAttribute("style") === "") node.removeAttribute("style");
    state.styles.delete(node);
  }
  function restore(state) { for (const node of state.styles.keys()) restoreNode(state, node); }

  function observe() {
    if (!active) return;
    observer.disconnect();
    const ancestors = new Set();
    for (const { list } of states.values()) {
      const section = list.closest(S.labelSection) || list;
      observer.observe(section, { childList: true, subtree: true, attributes: true, attributeOldValue: true,
        attributeFilter: ["href", "data-label-name", "style", "class", "hidden", "aria-hidden"] });
      for (let node = section.parentElement; node; node = node.parentElement) {
        if (ancestors.has(node)) break;
        ancestors.add(node);
        observer.observe(node, { childList: true, attributes: true,
          attributeFilter: ["style", "class", "hidden", "aria-hidden"] });
      }
    }
    for (const node of document.querySelectorAll(S.labelAccount)) observer.observe(node, { attributes: true, attributeFilter: ["aria-label"] });
    if (!states.size && document.documentElement) observer.observe(document.documentElement, { childList: true });
  }

  function placeHeaderButton() {
    const buttons = [...document.querySelectorAll(S.labelCreate)].filter(node =>
      !node.closest(`${S.main}, ${S.labelEditor}, ${S.editor}`));
    const source = buttons.length === 1 ? buttons[0] : null;
    if (headerButton && (!source || headerButton.nextElementSibling !== source)) {
      headerButton.remove(); headerButton = null;
    }
    if (!source || headerButton) return;
    headerButton = iconButton("Organize labels", "M8 20V4m-4 4 4-4 4 4M16 4v16m-4-4 4 4 4-4", "gmail-pro-label-organize");
    headerButton.setAttribute("aria-pressed", String(editing));
    headerButton.addEventListener("click", () => { if (editing) exit(); else edit(); });
    source.before(headerButton);
  }

  function apply() {
    if (!active) return;
    observer.disconnect();
    const owner = account(), seenHidden = new Set();
    try {
      for (const [list, state] of states) {
        if (!list.isConnected) { restore(state); states.delete(list); continue; }
        for (const node of state.styles.keys()) {
          if (node !== list && node.parentElement !== list) restoreNode(state, node);
        }
        const groups = read(list);
        // Never override Gmail's explicit hidden state or its native display:none.
        if (!groups || !enabled || !order.length || list.hidden || list.getAttribute("aria-hidden") === "true" ||
            list.style.display === "none" || getComputedStyle(list).display === "none") restore(state);
        else {
          // Gmail indexes this native flat child sequence: presentation only.
          style(state, list, "display", "flex"); style(state, list, "flex-direction", "column");
          rank(groups).flatMap(group => group.rows).forEach((row, index) => style(state, row.node, "order", String(index)));
        }
        for (const row of (groups || []).flatMap(group => group.rows)) {
          if (!hiddenBy(row, owner)) continue;
          const value = editing && revealHidden ? "revealed" : "hidden";
          if (row.node.getAttribute("data-gmail-pro-label-hidden") !== value) row.node.setAttribute("data-gmail-pro-label-hidden", value);
          seenHidden.add(row.node); hiddenRows.add(row.node);
        }
      }
      for (const row of hiddenRows) {
        if (!seenHidden.has(row)) { row.removeAttribute("data-gmail-pro-label-hidden"); hiddenRows.delete(row); }
      }
      placeHeaderButton();
      if (editing) renderHandles();
      refreshLabelMenu();
      if (notice && (!notice.node.isConnected || notice.account !== owner)) clearNotice();
    } finally { observe(); }
  }

  function register(root) {
    if (!(root instanceof Element)) return;
    const enclosing = root.closest(S.labelContainer);
    const containers = enclosing ? [enclosing] : [...root.querySelectorAll(S.labelContainer)];
    for (const container of containers) {
      if (container.closest(`${S.main}, ${S.editor}`)) continue;
      const list = container.querySelector(S.labelList);
      if (list && !states.has(list) && read(list)) states.set(list, { list, styles: new Map() });
    }
  }
  const nativeClasses = value => (value || "").split(/\s+/).filter(x => !x.startsWith("gmail-pro-label-")).join(" ");
  function mutations(records) {
    if (!active) return;
    if (labelMenu?.menu && !labelMenu.menu.isConnected) clearLabelMenu();
    let changed = false;
    for (const record of records) {
      const target = record.target;
      if (target.closest?.("[data-gmail-pro-label-ui]")) continue;
      if (record.type === "attributes") {
        if (record.attributeName === "aria-label") { changed = true; continue; }
        if (record.attributeName === "class" && nativeClasses(record.oldValue) === nativeClasses(target.className)) continue;
        const relevant = states.has(target) || target.matches(S.labelRow) ||
          (record.attributeName !== "class" && target.matches(`${S.labelLine}, ${S.labelLink}, ${S.labelMenu}`)) ||
          [...states.keys()].some(list => target.contains(list));
        if (!relevant) continue;
        // Release our layout before checking newly changed native visibility classes.
        if (record.attributeName === "class" || record.attributeName === "hidden" || record.attributeName === "aria-hidden") {
          for (const state of states.values()) if (target === state.list) restoreNode(state, target);
        }
        register(target); changed = true;
      } else {
        for (const node of [...record.addedNodes, ...record.removedNodes]) {
          if (!(node instanceof Element) || node.matches("[data-gmail-pro-label-ui]")) continue;
          if (node.matches(`${S.labelRow}, ${S.labelContainer}, ${S.labelLink}, ${S.labelMenu}, ${S.labelLine}, ${S.labelCreate}`) ||
              node.querySelector(`${S.labelContainer}, ${S.labelLink}, ${S.labelCreate}`)) {
            if (node.isConnected) register(node);
            changed = true;
          }
        }
      }
    }
    if (!changed) return;
    if (states.size) { bootstrap?.disconnect(); clearTimeout(bootstrapTimer); }
    if (editing && !toolbar?.isConnected) exit();
    apply();
    // Gmail changes hover/menu styling during a real pointer gesture. Only an
    // invalidated source/account should cancel it; recheck after native updates.
    if (dragging) dragTarget();
    if (!states.size) discover();
  }
  function discover() {
    if (!active || !document.documentElement) return;
    clearLabelMenu();
    cancelDrag();
    const connected = [...states.keys()].filter(list => list.isConnected);
    if (connected.length) for (const list of connected) register(list.closest(S.labelSection) || list.parentElement);
    else register(document.documentElement);
    apply(); bootstrap?.disconnect(); clearTimeout(bootstrapTimer);
    if (!states.size) {
      bootstrap = new MutationObserver(mutations);
      bootstrap.observe(document.documentElement, { childList: true, subtree: true });
      bootstrapTimer = setTimeout(() => bootstrap.disconnect(), 10000);
    }
  }
  function announce(message) { if (status) status.textContent = message; }
  function clearNotice() {
    clearTimeout(noticeTimer); notice?.node.remove(); notice = null;
  }
  function visibilityFeedback(message, error = false) {
    if (status) { announce(message); return; }
    clearNotice();
    const section = [...states.keys()].find(visible)?.closest(S.labelSection);
    if (!active || !section) return;
    const node = document.createElement("div"), text = document.createElement("span"), dismiss = document.createElement("button");
    node.className = "gmail-pro-label-notice"; node.dataset.gmailProLabelUi = "notice";
    text.setAttribute("role", "status"); text.setAttribute("aria-live", "polite"); text.setAttribute("aria-atomic", "true");
    dismiss.type = "button"; dismiss.textContent = "Dismiss"; dismiss.addEventListener("click", clearNotice);
    node.append(text, dismiss); section.prepend(node); text.textContent = message;
    notice = { node, account: account() };
    if (!error) noticeTimer = setTimeout(clearNotice, 4000);
  }

  function sameSource(source, owner) {
    const fresh = findRow(source.id);
    return active && owner === account() && fresh?.node === source.node &&
      fresh.menu === source.menu && fresh.parentId === source.parentId;
  }
  function clearLabelMenu() {
    const context = labelMenu; labelMenu = null;
    if (!context) return;
    context.controller.abort(); context.watch?.disconnect();
    context.menu?.removeEventListener("keydown", context.keydown, true);
    if (context.button && context.menu?.getAttribute("aria-activedescendant") === context.button.id) context.menu.removeAttribute("aria-activedescendant");
    if (context.styles) restore(context);
    context.button?.remove(); context.separator?.remove();
  }
  function nativeMenuItems(menu) {
    return [...menu.children].filter(node => node.matches('[role="menuitem"], [role="menuitemcheckbox"]') &&
      !node.hasAttribute("data-gmail-pro-label-ui") && visible(node));
  }
  function verifiedLabelMenu(menu) {
    const items = nativeMenuItems(menu);
    return ["Edit", "Remove label", "Add sublabel"].every(text =>
      items.filter(item => item.getAttribute("role") === "menuitem" && item.textContent.trim() === text).length === 1) &&
      [...menu.children].some(node => visible(node) && node.textContent.trim() === "In message list") &&
      items.every(item => item.id);
  }
  function nativeMenuKey(context, key) {
    // Gmail's public menu uses Home/End and aria-activedescendant. Keep its
    // own item selection/activation in charge when returning from our item.
    context.forwarding = true;
    try {
      context.button?.classList.remove("gmail-pro-label-menu-selected");
      context.menu.focus({ preventScroll: true });
      context.menu.dispatchEvent(new KeyboardEvent("keydown", { key,
        keyCode: { Escape: 27, Home: 36, End: 35 }[key], bubbles: true, cancelable: true }));
    } finally { context.forwarding = false; }
  }
  function menuKeydown(context, event) {
    if (context.forwarding || labelMenu !== context) return;
    const own = event.target === context.button || context.menu.getAttribute("aria-activedescendant") === context.button.id;
    if (own) {
      if (!["Enter", " ", "ArrowUp", "ArrowDown", "Home", "End", "Escape"].includes(event.key)) return;
      event.preventDefault(); event.stopPropagation();
      if (event.key === "Enter" || event.key === " ") {
        if (!context.button.disabled) void saveSidebarVisibility(context.source.id, context.hide, context);
      } else if (event.key === "Escape") {
        nativeMenuKey(context, "Escape"); clearLabelMenu();
        if (visible(context.source.link)) context.source.link.focus({ preventScroll: true });
      } else if (event.key !== "End") nativeMenuKey(context, event.key === "ArrowUp" ? "End" : "Home");
      return;
    }
    if (context.button.disabled) return;
    const items = nativeMenuItems(context.menu), selected = context.menu.getAttribute("aria-activedescendant");
    if (event.key === "End" || (event.key === "ArrowDown" && selected === items.at(-1)?.id) ||
        (event.key === "ArrowUp" && selected === items[0]?.id)) {
      event.preventDefault(); event.stopPropagation();
      // Gmail closes this portal when focus leaves the menu, even for a child.
      // Use its active-descendant pattern for our item too.
      context.menu.setAttribute("aria-activedescendant", context.button.id);
      context.button.classList.add("gmail-pro-label-menu-selected");
    }
  }
  function refreshLabelMenu() {
    const context = labelMenu;
    if (!context) return;
    if (!sameSource(context.source, context.account)) { clearLabelMenu(); return; }
    if (!context.menu) return;
    if (!visible(context.menu) || !context.button.isConnected || !verifiedLabelMenu(context.menu) ||
        (!visible(context.source.node) && visibilitySave?.context !== context)) { clearLabelMenu(); return; }
    const ancestor = hiddenBy(context.source, context.account);
    const inherited = hidden.some(entry => entry.account === context.account && below(context.source.id, entry.path));
    const text = inherited ? "Hidden with parent — restore parent first" : ancestor ? "Show in sidebar — Gmail Pro" : "Hide from sidebar — Gmail Pro";
    context.hide = !ancestor;
    if (context.button.textContent !== text) context.button.textContent = text;
    context.button.disabled = saving || inherited;
    context.button.title = saving ? "Saving sidebar visibility…" : text;
    // Gmail can use a light portal inside a dark sidebar. Match its native
    // item text rather than inheriting the sidebar's foreground color.
    const color = getComputedStyle(nativeMenuItems(context.menu)[0]).color;
    if (context.button.style.color !== color) {
      context.button.style.color = color; context.separator.style.color = color;
    }
    const selected = context.menu.getAttribute("aria-activedescendant") === context.button.id;
    if (context.button.classList.contains("gmail-pro-label-menu-selected") !== selected) context.button.classList.toggle("gmail-pro-label-menu-selected", selected);
    // Gmail positions the portal before our new row exists. Fit its added
    // height near the bottom edge and restore only our own positioning.
    const bounds = context.menu.getBoundingClientRect(), overflow = bounds.bottom - innerHeight + 8;
    const top = Number.parseFloat(context.menu.style.top);
    if (overflow > 1 && Number.isFinite(top) && getComputedStyle(context.menu).position === "absolute") {
      style(context, context.menu, "top", Math.max(8, top - overflow) + "px");
    }
  }
  async function decorateLabelMenu(context) {
    try {
      const menu = await waitFor(() => one(document.querySelectorAll(S.labelNativeMenu), node =>
        visible(node) && verifiedLabelMenu(node)), [document.body], context.controller.signal);
      if (labelMenu !== context || !sameSource(context.source, context.account) || !visible(context.source.node)) return;
      context.menu = menu; context.styles = new Map();
      const separator = document.createElement("div"), button = document.createElement("button");
      separator.className = "gmail-pro-label-menu-divider"; separator.setAttribute("role", "separator");
      separator.dataset.gmailProLabelUi = "menu-divider";
      button.type = "button"; button.className = "gmail-pro-label-menu-action";
      button.id = "gmail-pro-label-sidebar-action";
      button.setAttribute("role", "menuitem"); button.tabIndex = -1; button.dataset.gmailProLabelUi = "menu-action";
      context.button = button; context.separator = separator;
      for (const type of ["mousedown", "mouseup", "pointerdown", "dblclick"]) button.addEventListener(type, event => {
        if (type === "mousedown") event.preventDefault();
        event.stopPropagation();
      });
      button.addEventListener("click", event => {
        event.preventDefault(); event.stopPropagation();
        if (!button.disabled && labelMenu === context) void saveSidebarVisibility(context.source.id, context.hide, context);
      });
      context.keydown = event => menuKeydown(context, event);
      menu.addEventListener("keydown", context.keydown, true); menu.append(separator, button);
      context.watch = new MutationObserver(refreshLabelMenu);
      context.watch.observe(menu, { childList: true, subtree: true, attributes: true,
        attributeFilter: ["style", "class", "hidden", "aria-hidden", "aria-activedescendant"] });
      refreshLabelMenu();
    } catch { /* Unsupported or dismissed menus keep Gmail's native controls. */ }
    finally { if (labelMenu === context && !context.menu) clearLabelMenu(); }
  }
  function labelMenuTrigger(event) {
    if (event.type === "keydown" && event.key === "Escape" && labelMenu && !labelMenu.menu) { clearLabelMenu(); return; }
    if (event.type === "pointerdown" && labelMenu && !event.target.closest?.(S.labelMenu) &&
        !labelMenu.menu?.contains(event.target)) clearLabelMenu();
    if (!active || (event.type === "keydown" && !["Enter", " ", "ArrowDown"].includes(event.key)) ||
        (event.type === "pointerdown" && event.button !== 0)) return;
    const trigger = event.target.closest?.(S.labelMenu);
    if (!trigger) return;
    const source = allRows().find(row => row.menu === trigger);
    if (!source?.depth || !account() || operation || saving) { clearLabelMenu(); return; }
    if (labelMenu?.source.menu === trigger) return;
    clearLabelMenu();
    const context = { source, account: account(), controller: new AbortController() };
    labelMenu = context;
    // Capture the association first; inspect after Gmail handles this gesture.
    queueMicrotask(() => { if (labelMenu === context) void decorateLabelMenu(context); });
  }
  function setSaving(value) {
    saving = value;
    const owner = account();
    for (const { button, eye } of handles.values()) {
      button.disabled = value;
      if (eye) eye.disabled = value || eye.dataset.inherited === "true" || !owner;
    }
    if (toolbar) toolbar.querySelector("input").disabled = value;
    refreshLabelMenu();
  }

  async function move(id, targetId, after = false) {
    if (!editing || saving) return;
    const source = findRow(id), target = findRow(targetId);
    if (!source || source.depth || !target || target.depth || source.list !== target.list || id === targetId) return;
    const groups = rank(read(source.list) || []), visibleIds = groups.map(group => group.id);
    const next = [...order, ...visibleIds.filter(key => !order.includes(key))];
    next.splice(next.indexOf(id), 1); next.splice(next.indexOf(targetId) + (after ? 1 : 0), 0, id);
    const token = generation, revision = orderRevision;
    setSaving(true); announce("Saving label order…");
    try {
      await app.settings.save({ customLabelOrderEnabled: true, customLabelOrder: next });
      if (active && token === generation && revision === orderRevision) { enabled = true; order = next; apply(); }
      if (token === generation) announce("Order saved. " + help);
    } catch { if (token === generation) announce("Couldn’t save this move. Please try again; the previous order is unchanged."); }
    finally {
      if (token === generation) { setSaving(false); handles.get(id)?.button.focus({ preventScroll: true }); }
    }
  }

  async function saveSidebarVisibility(id, hide, context) {
    if (!active || saving) return;
    const row = findRow(id), owner = account();
    if (!row?.depth || !owner) { visibilityFeedback("Couldn’t identify this Gmail account. Refresh Gmail and try again.", true); return; }
    const save = { source: row, account: owner, context }, revision = hiddenRevision;
    visibilitySave = save;
    setSaving(true); cancelDrag();
    try {
      const stored = await app.settings.load();
      if (visibilitySave !== save || !sameSource(row, owner) || (context && labelMenu !== context)) return;
      const current = stored.sidebarHiddenSublabels;
      const exact = current.some(entry => entry.account === owner && entry.path === id);
      if (current.some(entry => entry.account === owner && below(id, entry.path))) {
        visibilityFeedback("This sublabel is hidden with its parent. Restore the parent first.", true); return;
      }
      const next = hide ? exact ? current : [...current, { account: owner, path: id }] :
        current.filter(entry => entry.account !== owner || entry.path !== id);
      if (exact !== hide) await app.settings.save({ sidebarHiddenSublabels: next });
      if (visibilitySave !== save || !active || owner !== account()) return;
      if (revision === hiddenRevision) { hidden = next; apply(); }
      if (context && labelMenu === context) { nativeMenuKey(context, "Escape"); clearLabelMenu(); }
      visibilityFeedback(hide ? "Sublabel hidden. Restore it in Organize labels → Show hidden sublabels." : "Sublabel shown in this sidebar.");
      if (!visible(row.node)) (toolbar?.querySelector("button") || headerButton)?.focus({ preventScroll: true });
    } catch {
      if (visibilitySave === save && active && owner === account()) visibilityFeedback("Couldn’t save sidebar visibility. Please try again; the previous setting is unchanged.", true);
    } finally {
      if (visibilitySave === save) { visibilitySave = null; setSaving(!!operation); if (active) apply(); }
    }
  }

  // Use Gmail's own gesture/validation/save path; no private API or network calls.
  function gesture(node) {
    for (const type of ["mousedown", "mouseup", "click"]) node.dispatchEvent(new MouseEvent(type, {
      bubbles: true, cancelable: true, view: window, button: 0, buttons: type === "mousedown" ? 1 : 0
    }));
  }
  function one(nodes, predicate) {
    const matches = [...nodes].filter(predicate); return matches.length === 1 ? matches[0] : null;
  }
  function editorFields(dialog) {
    const heading = dialog.querySelector("h2, [role='heading']");
    if (heading?.textContent.trim() !== "Edit label") return null;
    const field = text => {
      const label = one(dialog.querySelectorAll("label"), node => node.textContent.trim() === text);
      const input = label?.control;
      return input && dialog.contains(input) ? input : null;
    };
    const name = field("Label name:"), nest = field("Nest label under:");
    const combo = one(dialog.querySelectorAll('[role="combobox"]'), node => node.getAttribute("aria-label") === "Nest label under:");
    const action = text => one(dialog.querySelectorAll('button, [role="button"]'), node => node.textContent.trim() === text);
    const save = action("Save"), cancel = action("Cancel");
    return name?.matches('input[type="text"]') && nest?.matches('input[type="checkbox"]') && combo && save && cancel ?
      { dialog, name, nest, combo, save, cancel } : null;
  }
  function waitFor(check, roots, signal, timeout = 5000) {
    return new Promise((resolve, reject) => {
      let watch, timer;
      const finish = (value, error) => {
        watch?.disconnect(); clearTimeout(timer); signal.removeEventListener("abort", abort);
        if (error) reject(error); else resolve(value);
      };
      const inspect = () => {
        try { const value = check(); if (value) finish(value); } catch (error) { finish(null, error); }
      };
      const abort = () => finish(null, new DOMException("Cancelled", "AbortError"));
      if (signal.aborted) { abort(); return; }
      watch = new MutationObserver(inspect);
      for (const root of new Set(roots.filter(Boolean))) watch.observe(root, {
        childList: true, subtree: true, attributes: true,
        attributeFilter: ["style", "class", "aria-expanded", "aria-selected", "aria-hidden", "aria-disabled", "disabled", "href", "data-label-name"]
      });
      signal.addEventListener("abort", abort, { once: true });
      timer = setTimeout(() => finish(null, new Error("Gmail did not confirm the move")), timeout);
      inspect();
    });
  }
  function checkOperation(op) {
    if (!active || (!editing && !op.submitted) || operation !== op || op.controller.signal.aborted || op.account !== account()) {
      throw new DOMException("Cancelled", "AbortError");
    }
  }
  async function openEditor(source, op) {
    if ([...document.querySelectorAll(`${S.labelNativeMenu}, ${S.labelEditor}`)].some(visible)) {
      throw new Error("Close the open Gmail menu or dialog first.");
    }
    checkOperation(op); gesture(source.menu);
    // Gmail portals its menu/dialog. This temporary watch retires after each
    // stage (at most five seconds), unlike our narrow idle sidebar observer.
    const menu = await waitFor(() => one(document.querySelectorAll(S.labelNativeMenu), node => visible(node) &&
      [...node.querySelectorAll('[role="menuitem"]')].some(item => item.textContent.trim() === "Add sublabel")), [document.body], op.controller.signal);
    op.menu = menu;
    checkOperation(op);
    const editItem = one(menu.querySelectorAll('[role="menuitem"]'), node => visible(node) && node.textContent.trim() === "Edit");
    if (!editItem || !findRow(source.id)) throw new Error("Gmail’s label editor is unavailable.");
    gesture(editItem);
    const fields = await waitFor(() => one(document.querySelectorAll(S.labelEditor), node => visible(node) && editorFields(node)), [document.body], op.controller.signal);
    op.fields = editorFields(fields); checkOperation(op);
    const parent = source.parentId.slice(6), name = source.id.slice(source.parentId.length + 1);
    if (op.fields.name.value !== name || !op.fields.nest.checked || op.fields.combo.textContent.trim() !== parent) {
      throw new Error("Gmail opened a different label. No move was saved.");
    }
    return op.fields;
  }
  function cancelOwnedEditor(op) {
    if (!op?.submitted && visible(op?.fields?.dialog)) gesture(op.fields.cancel);
    else if (!op?.fields && visible(op?.menu)) op.menu.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", keyCode: 27, bubbles: true }));
  }
  function userSave(fields, op) {
    return new Promise(resolve => {
      const watch = new MutationObserver(() => { if (!visible(fields.dialog)) finish(null); });
      const finish = value => {
        watch.disconnect(); fields.save.removeEventListener("click", save, true);
        fields.cancel.removeEventListener("click", cancel, true); op.controller.signal.removeEventListener("abort", cancel);
        resolve(value);
      };
      const cancel = () => finish(null);
      const save = () => {
        const list = document.getElementById(fields.combo.getAttribute("aria-controls"));
        const selected = list && one(list.querySelectorAll('[role="option"]'), node => node.getAttribute("aria-selected") === "true");
        const parent = selected?.getAttribute("data-value") || fields.combo.textContent.trim();
        if (!fields.nest.checked || !parent || !fields.name.value) { finish(null); return; }
        op.submitted = true;
        finish({ parentId: "label/" + parent, newId: "label/" + parent + "/" + fields.name.value });
      };
      fields.save.addEventListener("click", save, true); fields.cancel.addEventListener("click", cancel, true);
      op.controller.signal.addEventListener("abort", cancel, { once: true });
      if (fields.dialog.parentElement) watch.observe(fields.dialog.parentElement, { childList: true });
      watch.observe(fields.dialog, { attributes: true, attributeFilter: ["style", "hidden", "aria-hidden"] });
    });
  }
  async function reparent(id, targetId) {
    if (!editing || saving) return;
    const source = findRow(id), target = targetId ? findRow(targetId) : null, owner = account();
    if (!source?.depth || !source.parentId || !owner) { announce("Couldn’t identify this sublabel or Gmail account. Refresh Gmail and try again."); return; }
    if (targetId && (!target || id === targetId || below(targetId, id) || targetId === source.parentId)) {
      announce("Choose a different parent outside this sublabel’s branch."); return;
    }
    const op = { controller: new AbortController(), account: owner, submitted: false, generation };
    operation = op; setSaving(true); cancelDrag(); announce("Opening Gmail’s label editor…");
    try {
      const fields = await openEditor(source, op);
      let newId, parentId;
      if (!target) {
        // Keyboard users keep Gmail's full accessible parent picker and Save.
        announce("Choose the parent in Gmail’s editor, then Save or Cancel.");
        const choice = await userSave(fields, op);
        if (!choice) { announce("Parent move cancelled."); return; }
        ({ newId, parentId } = choice);
        if (newId === id) { announce("Parent unchanged."); return; }
      } else {
        checkOperation(op);
        const name = fields.name.value;
        newId = target.id + "/" + name; parentId = target.id;
        if (findRow(newId)) throw new Error("That parent already has a sublabel with this name. No move was saved.");
        gesture(fields.combo);
        const options = await waitFor(() => {
          const list = document.getElementById(fields.combo.getAttribute("aria-controls"));
          if (!list || !fields.dialog.contains(list) || list.getAttribute("role") !== "listbox" || !visible(list)) return null;
          if ([...list.querySelectorAll('[role="option"]')].some(node => node.getAttribute("data-value") === newId.slice(6))) {
            throw new Error("That parent already has a sublabel with this name. No move was saved.");
          }
          return one(list.querySelectorAll('[role="option"]'), node => node.getAttribute("data-value") === target.id.slice(6) && node.getAttribute("aria-disabled") !== "true");
        }, [fields.dialog], op.controller.signal);
        checkOperation(op); gesture(options);
        await waitFor(() => fields.combo.textContent.trim() === target.id.slice(6) && fields.combo.getAttribute("aria-expanded") !== "true", [fields.dialog], op.controller.signal);
        checkOperation(op);
        if (fields.name.value !== name || !fields.nest.checked || !findRow(id) || !findRow(targetId) ||
            fields.save.disabled || fields.save.getAttribute("aria-disabled") === "true") throw new Error("The label changed before saving. No move was saved.");
        op.submitted = true; announce("Saving new parent in Gmail…"); gesture(fields.save);
      }
      await waitFor(() => !visible(fields.dialog), [fields.dialog.parentElement || document.body], op.controller.signal);
      checkOperation(op);
      // Expand only the chosen destination to expose Gmail's committed path.
      const freshTarget = findRow(parentId);
      const expand = freshTarget?.node.querySelector(S.labelExpand);
      if (expand && editing && op.generation === generation) gesture(expand);
      await waitFor(() => !findRow(id) && findRow(newId), [...states.keys()].map(list => list.closest(S.labelSection) || list), op.controller.signal, 10000);
      checkOperation(op);
      op.confirmed = true;
      const stored = await app.settings.load(); checkOperation(op);
      const next = stored.sidebarHiddenSublabels.map(entry => entry.account === owner &&
        (entry.path === id || below(entry.path, id)) ? { account: owner, path: newId + entry.path.slice(id.length) } : entry);
      if (JSON.stringify(next) !== JSON.stringify(stored.sidebarHiddenSublabels)) {
        const revision = hiddenRevision;
        try {
          await app.settings.save({ sidebarHiddenSublabels: next });
          if (active && owner === account() && revision === hiddenRevision) { hidden = next; apply(); }
        } catch {
          announce("Moved in Gmail, but couldn’t save Gmail Pro’s hidden-label preferences. Review sidebar visibility."); return;
        }
      }
      announce("Moved under " + parentId.slice(6) + ".");
      handles.get(newId)?.button.focus({ preventScroll: true });
    } catch (error) {
      cancelOwnedEditor(op);
      if (op.generation === generation && error.name !== "AbortError") announce(op.confirmed ?
        "Moved in Gmail, but couldn’t load Gmail Pro’s hidden-label preferences. Review sidebar visibility." : op.submitted ?
        "Gmail hasn’t confirmed this move. Check the label’s parent before trying again." : error.message + " You can use Gmail’s Edit menu.");
    } finally {
      if (operation === op) { operation = null; setSaving(false); }
    }
  }

  function iconButton(label, path, className) {
    const button = document.createElement("button"); button.type = "button"; button.className = className;
    button.dataset.gmailProLabelUi = "control"; button.title = label; button.setAttribute("aria-label", label);
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24"); svg.setAttribute("aria-hidden", "true");
    const shape = document.createElementNS(svg.namespaceURI, "path"); shape.setAttribute("d", path);
    svg.append(shape); button.append(svg); return button;
  }
  function clearDrop() {
    for (const { row } of handles.values()) row.classList.remove("gmail-pro-label-before", "gmail-pro-label-after", "gmail-pro-label-dragging", "gmail-pro-label-parent");
  }
  function cancelDrag() {
    cancelAnimationFrame(scrollFrame); scrollFrame = 0;
    const current = dragging; dragging = null; clearDrop();
    if (current?.button.hasPointerCapture(current.pointerId)) current.button.releasePointerCapture(current.pointerId);
  }
  function scrollHost(node) {
    for (let parent = node.parentElement; parent; parent = parent.parentElement) {
      if (/auto|scroll/.test(getComputedStyle(parent).overflowY) && parent.scrollHeight > parent.clientHeight) return parent;
    }
    return null;
  }
  function dragTarget() {
    const fresh = dragging && findRow(dragging.id);
    if (!fresh || !dragging.button.isConnected || fresh.node !== dragging.button.closest(S.labelRow) ||
        fresh.parentId !== dragging.parentId || dragging.account !== account()) { cancelDrag(); return; }
    const current = dragging, source = findRow(current.id);
    const hit = document.elementFromPoint(current.x, current.y)?.closest(S.labelRow);
    const row = allRows().find(item => item.node === hit && visible(item.node));
    clearDrop(); source.node.classList.add("gmail-pro-label-dragging"); current.target = null;
    if (!row || row.id === source.id) return;
    if (source.depth) {
      if (row.id === source.parentId || below(row.id, source.id)) return;
      row.node.classList.add("gmail-pro-label-parent"); current.target = { id: row.id };
      announce("Move under " + row.link.textContent + ".");
    } else if (row.list === source.list) {
      const target = findRow(row.groupId), bounds = target.node.getBoundingClientRect();
      if (target.id === source.id) return;
      const after = current.y > bounds.top + bounds.height / 2;
      target.node.classList.add(after ? "gmail-pro-label-after" : "gmail-pro-label-before");
      current.target = { id: target.id, after };
    }
  }
  function autoScroll() {
    scrollFrame = 0;
    if (!dragging?.moved || !dragging.scroller) return;
    const { scroller, y } = dragging, bounds = scroller.getBoundingClientRect();
    const delta = y < bounds.top + 32 ? -8 : y > bounds.bottom - 32 ? 8 : 0;
    if (!delta) return;
    const previous = scroller.scrollTop; scroller.scrollTop += delta;
    if (previous === scroller.scrollTop) return;
    dragTarget(); if (dragging) scrollFrame = requestAnimationFrame(autoScroll);
  }
  function renderHandles() {
    const seen = new Set(), owner = account();
    for (const row of allRows()) {
      seen.add(row.id);
      let entry = handles.get(row.id);
      if (entry && entry.row !== row.node) { entry.button.remove(); entry.eye?.remove(); handles.delete(row.id); entry = null; }
      if (!entry) {
        const button = document.createElement("button"); button.type = "button";
        button.className = "gmail-pro-label-handle"; button.dataset.gmailProLabelUi = "handle";
        button.textContent = "⠿"; button.draggable = false;
        button.setAttribute("aria-label", row.depth ? `Move ${row.link.textContent} under another parent. Press Enter to edit in Gmail.` :
          `Reorder ${row.link.textContent}. Use up or down arrow keys.`);
        button.title = row.depth ? "Drag onto the new parent, or press Enter to edit in Gmail" : "Drag to reorder, or use ↑ / ↓";
        for (const type of ["mousedown", "click", "dblclick"]) button.addEventListener(type, event => event.stopPropagation());
        button.addEventListener("keydown", event => {
          if (row.depth && ["Enter", " "].includes(event.key)) {
            event.preventDefault(); event.stopPropagation(); void reparent(row.id); return;
          }
          if (row.depth || !["ArrowUp", "ArrowDown"].includes(event.key)) return;
          event.preventDefault(); event.stopPropagation();
          const current = rank(read(row.list) || []), index = current.findIndex(item => item.id === row.id);
          const target = current[index + (event.key === "ArrowUp" ? -1 : 1)];
          if (target) void move(row.id, target.id, event.key === "ArrowDown");
        });
        button.addEventListener("pointerdown", event => {
          if (event.button !== 0 || saving || !event.isPrimary) return;
          event.preventDefault(); event.stopPropagation(); button.focus({ preventScroll: true });
          cancelDrag(); button.setPointerCapture(event.pointerId);
          dragging = { id: row.id, parentId: row.parentId, account: account(), button, pointerId: event.pointerId, startX: event.clientX,
            startY: event.clientY, x: event.clientX, y: event.clientY, scroller: scrollHost(row.node) };
        });
        button.addEventListener("pointermove", event => {
          if (!dragging || dragging.pointerId !== event.pointerId) return;
          event.preventDefault(); event.stopPropagation(); dragging.x = event.clientX; dragging.y = event.clientY;
          if (!dragging.moved && Math.hypot(dragging.x - dragging.startX, dragging.y - dragging.startY) < 4) return;
          dragging.moved = true; dragTarget(); if (dragging && !scrollFrame) scrollFrame = requestAnimationFrame(autoScroll);
        });
        button.addEventListener("pointerup", event => {
          if (!dragging || dragging.pointerId !== event.pointerId) return;
          event.preventDefault(); event.stopPropagation(); const target = dragging.target; cancelDrag();
          if (target) { if (row.depth) void reparent(row.id, target.id); else void move(row.id, target.id, target.after); }
        });
        for (const type of ["pointercancel", "lostpointercapture"]) button.addEventListener(type, cancelDrag);
        row.line.prepend(button); entry = { button, row: row.node }; handles.set(row.id, entry);
        if (row.depth) {
          const eye = iconButton("Hide from sidebar — Gmail Pro", "M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12Zm10-3a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z", "gmail-pro-label-eye");
          for (const type of ["mousedown", "dblclick"]) eye.addEventListener(type, event => event.stopPropagation());
          eye.addEventListener("click", event => {
            event.stopPropagation();
            void saveSidebarVisibility(row.id, !hidden.some(entry => entry.account === account() && entry.path === row.id));
          });
          button.after(eye); entry.eye = eye;
        }
      }
      entry.button.disabled = saving;
      if (entry.eye) {
        const ancestor = hiddenBy(row, owner), direct = hidden.some(item => item.account === owner && item.path === row.id);
        const inherited = hidden.some(item => item.account === owner && below(row.id, item.path));
        const label = inherited ? "Hidden with its parent — show the parent first" : direct ? "Show in sidebar — Gmail Pro" : "Hide from sidebar — Gmail Pro";
        entry.eye.title = label; entry.eye.setAttribute("aria-label", `${label}: ${row.link.textContent}`);
        entry.eye.setAttribute("aria-pressed", String(!!ancestor)); entry.eye.dataset.inherited = String(inherited);
        entry.eye.disabled = saving || inherited || !owner;
      }
    }
    for (const [id, entry] of handles) if (!seen.has(id)) { entry.button.remove(); entry.eye?.remove(); handles.delete(id); }
  }
  function escape(event) {
    if (event.key !== "Escape") return;
    // A keyboard-opened Gmail editor retains its own Escape behavior.
    if (!operation && event.target.closest?.(`${S.labelEditor}, ${S.labelNativeMenu}`)) return;
    if (operation || event.target.closest?.("[data-gmail-pro-label-ui]")) {
      event.preventDefault(); event.stopPropagation();
    }
    exit();
  }
  function exit() {
    if (!editing) return;
    editing = false; revealHidden = false; generation++;
    // Save is already Gmail's operation. Retire editing immediately, but keep
    // verifying its result and remapping preferences after an accepted save.
    if (!operation?.submitted) {
      operation?.controller.abort(); cancelOwnedEditor(operation); operation = null;
    }
    saving = !!operation || !!visibilitySave;
    observer?.disconnect(); cancelDrag();
    for (const { button, eye } of handles.values()) { button.remove(); eye?.remove(); } handles.clear();
    toolbar?.remove(); toolbar = null; status = null;
    headerButton?.setAttribute("aria-pressed", "false");
    document.removeEventListener("keydown", escape, true);
    if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true }); returnFocus = null;
    apply();
  }
  function edit() {
    if (!active) return false;
    discover();
    if (editing) { toolbar?.querySelector("button")?.focus(); return true; }
    const list = [...states.keys()].find(node => read(node)?.length && visible(node));
    const section = list?.closest(S.labelSection);
    if (!section || !list.getBoundingClientRect().width) return false;
    clearNotice();
    returnFocus = document.activeElement; editing = true; generation++; observer.disconnect();
    toolbar = document.createElement("div"); toolbar.className = "gmail-pro-label-toolbar";
    toolbar.dataset.gmailProLabelUi = "toolbar"; toolbar.setAttribute("role", "region"); toolbar.setAttribute("aria-label", "Gmail Pro label organizer");
    const title = document.createElement("strong"); title.textContent = "Organize labels";
    const done = document.createElement("button"); done.type = "button"; done.textContent = "Done"; done.addEventListener("click", exit);
    const revealLabel = document.createElement("label"), reveal = document.createElement("input"); reveal.type = "checkbox";
    reveal.addEventListener("change", () => { cancelDrag(); revealHidden = reveal.checked; apply(); });
    revealLabel.append(reveal, document.createTextNode("Show hidden sublabels"));
    status = document.createElement("span"); status.setAttribute("role", "status"); status.textContent = help;
    toolbar.append(title, done, revealLabel, status); section.prepend(toolbar);
    headerButton?.setAttribute("aria-pressed", "true"); apply(); document.addEventListener("keydown", escape, true);
    done.focus({ preventScroll: true }); return true;
  }
  function stop() {
    exit(); active = false; generation++; saving = false; observer?.disconnect(); bootstrap?.disconnect(); clearTimeout(bootstrapTimer);
    clearLabelMenu(); clearNotice(); visibilitySave = null;
    operation?.controller.abort(); operation = null;
    window.removeEventListener("hashchange", discover); window.removeEventListener("popstate", discover); document.removeEventListener("DOMContentLoaded", discover);
    for (const type of ["pointerdown", "click", "keydown"]) document.removeEventListener(type, labelMenuTrigger, true);
    for (const state of states.values()) restore(state); states.clear();
    for (const row of hiddenRows) row.removeAttribute("data-gmail-pro-label-hidden"); hiddenRows.clear();
    headerButton?.remove(); headerButton = null;
    if (started) chrome.runtime?.onMessage.removeListener(message); started = false;
  }
  function update(patch = {}) {
    if (Object.hasOwn(patch, "customLabelOrder")) { order = [...patch.customLabelOrder]; orderRevision++; }
    if (Object.hasOwn(patch, "customLabelOrderEnabled")) enabled = !!patch.customLabelOrderEnabled;
    if (Object.hasOwn(patch, "sidebarHiddenSublabels")) { hidden = patch.sidebarHiddenSublabels.map(entry => ({ ...entry })); hiddenRevision++; }
    if (active) apply();
  }
  function message(request, _sender, respond) {
    if (request?.type === "gmail-pro-edit-label-order") respond({ ok: edit() });
  }
  function start(settings) {
    update(settings);
    if (!started) { chrome.runtime?.onMessage.addListener(message); started = true; }
    if (active) return;
    active = true; observer = new MutationObserver(mutations);
    for (const type of ["pointerdown", "click", "keydown"]) document.addEventListener(type, labelMenuTrigger, true);
    window.addEventListener("hashchange", discover); window.addEventListener("popstate", discover);
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", discover, { once: true });
    discover();
  }
  app.labelOrder = Object.freeze({ start, update, stop, edit });
})();
