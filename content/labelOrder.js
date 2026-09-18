(() => {
  "use strict";
  const app = (globalThis.GmailPro ??= {});
  if (app.labelOrder) return;
  const S = app.selectors;
  const states = new Map();
  let enabled = false, order = [], observer, bootstrap, bootstrapTimer;
  let editing = false, toolbar, status, returnFocus, openedMore;
  let dragging, saving = false, started = false;
  const handles = new Map();

  function identity(link) {
    try {
      const url = new URL(link.getAttribute("href"), location.href);
      if (!url.hash.startsWith("#label/")) return null;
      return "label/" + decodeURIComponent(url.hash.slice(7).replace(/\+/g, " "));
    } catch { return null; }
  }

  function read(list) {
    const rows = [];
    for (const node of list.children) {
      if (!node.matches(S.labelRow)) return null;
      const links = node.querySelectorAll(S.labelLink);
      const line = node.querySelector(S.labelLine);
      const menu = node.querySelector(S.labelMenu);
      const id = links.length === 1 && identity(links[0]);
      const indent = line?.style.marginLeft;
      if (!id || !menu || menu.getAttribute("data-label-name") !== id.slice(6) ||
          !/^\d+px$/.test(indent || "")) return null;
      rows.push({ node, line, link: links[0], id, depth: Number.parseInt(indent, 10) });
    }
    if (new Set(rows.map(row => row.id)).size !== rows.length) return null;
    const groups = rows.filter(row => row.depth === 0).map(row => ({ ...row, rows: [] }));
    for (const row of rows) {
      const group = row.depth === 0 ? groups.find(item => item.id === row.id) :
        groups.filter(item => row.id.startsWith(item.id + "/")).sort((a, b) => b.id.length - a.id.length)[0];
      // A missing/ambiguous parent must never make a nested label draggable.
      if (!group) return null;
      group.rows.push(row);
    }
    if (groups.some(group => group.rows[0].id !== group.id)) return null;
    return groups;
  }

  function rank(groups) {
    const ranks = new Map(order.map((id, index) => [id, index]));
    return groups.slice().sort((a, b) => (ranks.get(a.id) ?? Infinity) - (ranks.get(b.id) ?? Infinity));
  }

  function style(state, node, property, value) {
    let properties = state.styles.get(node);
    if (!properties) { properties = new Map(); state.styles.set(node, properties); }
    if (!properties.has(property)) properties.set(property, {
      value: node.style.getPropertyValue(property), priority: node.style.getPropertyPriority(property)
    });
    const entry = properties.get(property);
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

  function restore(state) {
    for (const node of state.styles.keys()) restoreNode(state, node);
  }

  function observe() {
    if (!enabled) return;
    observer.disconnect();
    const ancestors = new Set();
    for (const state of states.values()) {
      const section = state.list.closest(S.labelSection);
      observer.observe(section || state.list, {
        childList: true, subtree: true, attributes: true,
        attributeFilter: ["href", "data-label-name", "style"]
      });
      for (let node = (section || state.list).parentElement; node; node = node.parentElement) {
        if (ancestors.has(node)) break;
        ancestors.add(node);
        observer.observe(node, { childList: true });
      }
    }
    if (!states.size && document.documentElement) observer.observe(document.documentElement, { childList: true });
  }

  function apply() {
    if (!enabled) return;
    observer.disconnect();
    try {
      for (const [list, state] of states) {
        if (!list.isConnected) { restore(state); states.delete(list); continue; }
        for (const node of state.styles.keys()) {
          if (node !== list && node.parentElement !== list) restoreNode(state, node);
        }
        const groups = read(list);
        if (!groups) { restore(state); continue; }
        if (!order.length) restore(state);
        else {
          // Gmail indexes its own flat child sequence during incremental render.
          // CSS order changes presentation without moving, wrapping or cloning rows.
          style(state, list, "display", "flex");
          style(state, list, "flex-direction", "column");
          rank(groups).flatMap(group => group.rows).forEach((row, index) => {
            style(state, row.node, "order", String(index));
          });
        }
      }
      if (editing) renderHandles();
    } finally { observe(); }
  }

  function register(root) {
    if (!(root instanceof Element)) return;
    const enclosing = root.closest(S.labelContainer);
    const containers = enclosing ? [enclosing] : [...root.querySelectorAll(S.labelContainer)];
    for (const container of containers) {
      if (container.closest(S.main) || container.closest(S.editor)) continue;
      const list = container.querySelector(S.labelList);
      if (list && !states.has(list) && read(list)) states.set(list, { list, styles: new Map() });
    }
  }

  function mutations(records) {
    if (!enabled) return;
    let changed = false;
    for (const record of records) {
      if (record.type === "attributes") {
        if (record.attributeName !== "style" || record.target.matches(S.labelLine)) {
          register(record.target);
          changed = true;
        }
        continue;
      }
      for (const node of [...record.addedNodes, ...record.removedNodes]) {
        if (!(node instanceof Element) || node.closest("[data-gmail-pro-label-ui]")) continue;
        if (node.matches(`${S.labelRow}, ${S.labelContainer}, ${S.labelLink}, ${S.labelMenu}, ${S.labelLine}`) || node.querySelector(S.labelContainer) || node.querySelector(S.labelLink)) {
          if (node.isConnected) register(node);
          changed = true;
        }
      }
    }
    if (changed) {
      if (states.size) { bootstrap?.disconnect(); clearTimeout(bootstrapTimer); }
      if (editing && !toolbar?.isConnected) exit();
      apply();
      if (!states.size) discover();
    }
  }

  function discover() {
    if (!enabled || !document.documentElement) return;
    // A single targeted discovery on enable/navigation, never a polling scan.
    const connected = [...states.keys()].filter(list => list.isConnected);
    if (connected.length) {
      for (const list of connected) register(list.closest(S.labelSection) || list.parentElement);
    } else register(document.documentElement);
    apply();
    bootstrap?.disconnect();
    clearTimeout(bootstrapTimer);
    if (!states.size) {
      // Gmail's initial shell can arrive asynchronously. Retire the temporary
      // observer once a sidebar exists; idle tabs never keep a document subtree watch.
      bootstrap = new MutationObserver(mutations);
      bootstrap.observe(document.documentElement, { childList: true, subtree: true });
      bootstrapTimer = setTimeout(() => bootstrap.disconnect(), 10000);
    }
  }

  function announce(message) { if (status) status.textContent = message; }

  async function move(id, targetId, after = false) {
    if (!editing || saving) return;
    let groups;
    for (const { list } of states.values()) {
      const items = read(list);
      if (items?.some(group => group.id === id)) { groups = rank(items); break; }
    }
    if (!groups?.some(group => group.id === targetId) || id === targetId) return;
    const visible = groups.map(group => group.id);
    // Keep entries for currently unavailable labels; editing one More section
    // or a partial render must never erase the other section's saved positions.
    const next = [...order, ...visible.filter(key => !order.includes(key))];
    next.splice(next.indexOf(id), 1);
    next.splice(next.indexOf(targetId) + (after ? 1 : 0), 0, id);
    saving = true;
    announce("Saving label order…");
    try {
      await app.settings.save({ customLabelOrder: next });
      if (enabled) { order = next; apply(); }
      announce("Order saved. Drag a handle or use ↑ / ↓. Done or Escape exits.");
    } catch {
      announce("Couldn’t save this move. Please try again; the previous order is unchanged.");
    } finally {
      saving = false;
      handles.get(id)?.button.focus({ preventScroll: true });
    }
  }

  function clearDrop() {
    for (const { row } of handles.values()) row.classList.remove("gmail-pro-label-before", "gmail-pro-label-after", "gmail-pro-label-dragging");
  }

  function renderHandles() {
    const seen = new Set();
    for (const { list } of states.values()) {
      const groups = read(list);
      if (!groups) continue;
      for (const group of groups) {
        seen.add(group.id);
        const old = handles.get(group.id);
        if (old?.row === group.node) continue;
        old?.button.remove();
        const button = document.createElement("button");
        button.type = "button";
        button.className = "gmail-pro-label-handle";
        button.dataset.gmailProLabelUi = "handle";
        button.textContent = "⠿";
        button.draggable = false;
        button.setAttribute("aria-label", `Reorder ${group.link.textContent}. Use up or down arrow keys.`);
        button.title = "Drag to reorder, or use ↑ / ↓";
        for (const type of ["mousedown", "click", "dblclick"]) {
          button.addEventListener(type, event => event.stopPropagation());
        }
        button.addEventListener("keydown", event => {
          if (!["ArrowUp", "ArrowDown"].includes(event.key)) return;
          event.preventDefault(); event.stopPropagation();
          const current = rank(read(list) || []);
          const index = current.findIndex(item => item.id === group.id);
          const target = current[index + (event.key === "ArrowUp" ? -1 : 1)];
          if (target) void move(group.id, target.id, event.key === "ArrowDown");
        });
        button.addEventListener("pointerdown", event => {
          if (event.button !== 0 || saving || !event.isPrimary) return;
          event.preventDefault(); event.stopPropagation();
          button.focus({ preventScroll: true });
          button.setPointerCapture(event.pointerId);
          const targets = new Map();
          for (const item of read(list) || []) for (const row of item.rows) targets.set(row.node, item);
          dragging = { id: group.id, targets, pointerId: event.pointerId,
            x: event.clientX, y: event.clientY, target: null };
        });
        button.addEventListener("pointermove", event => {
          if (!dragging || dragging.pointerId !== event.pointerId) return;
          event.preventDefault(); event.stopPropagation();
          if (Math.hypot(event.clientX - dragging.x, event.clientY - dragging.y) < 4) return;
          const hit = document.elementFromPoint(event.clientX, event.clientY);
          const target = dragging.targets.get(hit?.closest(S.labelRow));
          clearDrop();
          group.node.classList.add("gmail-pro-label-dragging");
          dragging.target = null;
          if (!target || target.id === group.id) return;
          const bounds = target.node.getBoundingClientRect();
          const after = event.clientY > bounds.top + bounds.height / 2;
          target.node.classList.add(after ? "gmail-pro-label-after" : "gmail-pro-label-before");
          dragging.target = { id: target.id, after };
        });
        button.addEventListener("pointerup", event => {
          if (!dragging || dragging.pointerId !== event.pointerId) return;
          event.preventDefault(); event.stopPropagation();
          const target = dragging.target;
          dragging = null; clearDrop();
          if (button.hasPointerCapture(event.pointerId)) button.releasePointerCapture(event.pointerId);
          if (target) void move(group.id, target.id, target.after);
        });
        for (const type of ["pointercancel", "lostpointercapture"]) {
          button.addEventListener(type, () => { dragging = null; clearDrop(); });
        }
        group.line.prepend(button);
        handles.set(group.id, { button, row: group.node });
      }
    }
    for (const [id, entry] of handles) {
      if (!seen.has(id)) { entry.button.remove(); handles.delete(id); }
    }
  }

  function escape(event) {
    if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); exit(); }
  }

  function exit() {
    if (!editing) return;
    editing = false;
    observer?.disconnect();
    clearDrop(); dragging = null;
    for (const { button } of handles.values()) button.remove();
    handles.clear();
    toolbar?.remove(); toolbar = null; status = null;
    document.removeEventListener("keydown", escape, true);
    // Only undo the More expansion we performed, never change label hierarchy.
    if (openedMore?.isConnected && openedMore.getAttribute("aria-label") === "Less labels") openedMore.click();
    openedMore = null;
    if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
    returnFocus = null;
    observe();
  }

  function edit() {
    if (!enabled) return false;
    discover();
    if (editing) { toolbar?.querySelector("button")?.focus(); return true; }
    const list = [...states.keys()].find(node => node.isConnected && read(node)?.length && node.getClientRects().length);
    const section = list?.closest(S.labelSection);
    if (!section || !list.getBoundingClientRect().width) return false;
    returnFocus = document.activeElement;
    editing = true;
    observer.disconnect();
    toolbar = document.createElement("div");
    toolbar.className = "gmail-pro-label-toolbar";
    toolbar.dataset.gmailProLabelUi = "toolbar";
    toolbar.setAttribute("role", "region");
    toolbar.setAttribute("aria-label", "Gmail Pro label reorder mode");
    const title = document.createElement("strong"); title.textContent = "Edit label order";
    status = document.createElement("span"); status.setAttribute("role", "status");
    status.textContent = "Drag a handle or use ↑ / ↓. Moves save automatically. More labels stay in their section.";
    const done = document.createElement("button"); done.type = "button"; done.textContent = "Done";
    done.addEventListener("click", exit);
    toolbar.append(title, done, status);
    section.prepend(toolbar);
    const more = section.querySelector(S.labelMoreCollapsed);
    if (more) { openedMore = more; more.click(); }
    register(section);
    apply();
    document.addEventListener("keydown", escape, true);
    done.focus({ preventScroll: true });
    return true;
  }

  function deactivate() {
    exit();
    enabled = false;
    observer?.disconnect(); bootstrap?.disconnect(); clearTimeout(bootstrapTimer);
    window.removeEventListener("hashchange", discover);
    window.removeEventListener("popstate", discover);
    document.removeEventListener("DOMContentLoaded", discover);
    for (const state of states.values()) restore(state);
    states.clear();
  }

  function update(patch = {}) {
    if (Object.hasOwn(patch, "customLabelOrder")) {
      order = [...patch.customLabelOrder];
      if (!order.length) exit();
    }
    if (Object.hasOwn(patch, "customLabelOrderEnabled") && !!patch.customLabelOrderEnabled !== enabled) {
      if (!patch.customLabelOrderEnabled) { deactivate(); return; }
      enabled = true;
      observer = new MutationObserver(mutations);
      window.addEventListener("hashchange", discover);
      window.addEventListener("popstate", discover);
      if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", discover, { once: true });
      discover();
    } else if (enabled && Object.hasOwn(patch, "customLabelOrder")) apply();
  }

  function message(request, _sender, respond) {
    if (request?.type !== "gmail-pro-edit-label-order") return;
    respond({ ok: edit() });
  }
  function start(settings) {
    if (!started) { chrome.runtime?.onMessage.addListener(message); started = true; }
    update(settings);
  }
  function stop() {
    deactivate();
    if (started) chrome.runtime?.onMessage.removeListener(message);
    started = false;
  }
  app.labelOrder = Object.freeze({ start, update, stop, edit });
})();
