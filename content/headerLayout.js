(() => {
  "use strict";
  const app = (globalThis.GmailPro ??= {});
  if (app.headerLayout) return;
  const S = app.selectors;
  const GAP = 8, BUTTON = 32, SEARCH_WIDTH = 360;
  let enabled = false, collapsed = false, open = false, saving = false;
  let current, lastContext, controls, searchButton, toggleButton, closeButton, status;
  let compose;
  let observer, resizeObserver, bootstrap, bootstrapTimer, frame = 0, generation = 0;
  let observedSizes = new Set();
  let ancestorSpine = new Set();
  const markedPanels = new Set();
  const visible = node => node?.isConnected && node.getBoundingClientRect().width > 0 &&
    node.getBoundingClientRect().height > 0 && getComputedStyle(node).visibility !== "hidden";

  function discover() {
    const banners = [...document.querySelectorAll(S.headerBanner)];
    if (banners.length !== 1) return null;
    const banner = banners[0], shell = banner.closest(S.headerShell);
    const forms = [...banner.querySelectorAll(S.headerSearch)];
    const bars = [...document.querySelectorAll(S.headerToolbar)].filter(visible);
    if (!shell || shell.querySelector('[role="main"], [role="navigation"]') || forms.length !== 1 || bars.length !== 1) return null;
    const form = forms[0], toolbar = bars[0];
    const input = form.querySelector(S.headerSearchInput);
    const actions = [...toolbar.querySelectorAll('[gh="mtb"]')].filter(visible);
    const pagers = [...toolbar.querySelectorAll(S.pagingPager)].filter(visible);
    if (!input || actions.length !== 1 || pagers.length !== 1) return null;
    const main = toolbar.closest(S.main), viewport = main.closest(S.headerViewport);
    return { banner, shell, form, input, toolbar, main, viewport, actions: actions[0], pager: pagers[0] };
  }

  function geometry(ctx, reserve = 0) {
    const bar = ctx.toolbar.getBoundingClientRect();
    const action = ctx.actions.getBoundingClientRect(), pager = ctx.pager.getBoundingClientRect();
    // Include actual hit targets (including Gmail Pro / third-party actions),
    // not just Gmail's sometimes shorter action-group box.
    const buttons = [...ctx.actions.querySelectorAll('button, [role="button"]')].filter(visible);
    const left = Math.max(bar.left + GAP, action.right, ...buttons.map(node => node.getBoundingClientRect().right)) + GAP + reserve;
    const right = Math.min(bar.right - GAP, pager.left - GAP);
    if (bar.top < 0 || bar.height < 32 || bar.height > 80 || right - left < BUTTON * 2 + GAP) return null;
    // Keep the field stable as selection actions appear/disappear. If the
    // complete field cannot fit, use the existing compact search control.
    const narrow = right - left < SEARCH_WIDTH + BUTTON + GAP;
    const width = narrow ? Math.min(SEARCH_WIDTH, right - bar.left - BUTTON * 2 - GAP * 3) : SEARCH_WIDTH;
    if (width < 180) return null;
    return { narrow, width, right, top: bar.top + (bar.height - 36) / 2 };
  }

  function schedule() {
    if (!enabled || frame) return;
    frame = requestAnimationFrame(() => { frame = 0; if (enabled) refresh(); });
  }

  function button(label, path) {
    const node = document.createElement('button');
    node.type = 'button'; node.title = label; node.setAttribute('aria-label', label);
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true');
    const shape = document.createElementNS(svg.namespaceURI, 'path');
    shape.setAttribute('d', path); svg.append(shape); node.append(svg);
    return node;
  }

  function createControls() {
    controls = document.createElement('div');
    controls.className = 'gmail-pro-header-controls';
    controls.setAttribute('role', 'group'); controls.setAttribute('aria-label', 'Gmail header controls');
    searchButton = button('Open search', 'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0');
    searchButton.dataset.gpHeaderAction = 'search';
    closeButton = button('Close search', 'M6 6l12 12M18 6L6 18');
    closeButton.dataset.gpHeaderAction = 'close';
    toggleButton = button('Collapse Gmail header', 'M6 15l6-6 6 6');
    toggleButton.dataset.gpHeaderAction = 'toggle';
    status = document.createElement('span'); status.className = 'gmail-pro-header-status';
    status.setAttribute('role', 'status');
    controls.append(searchButton, closeButton, toggleButton, status);
    searchButton.addEventListener('click', () => {
      if (!current) return;
      open = true; refresh(); current?.input.focus();
    });
    closeButton.addEventListener('click', closeSearch);
    toggleButton.addEventListener('click', async () => {
      if (!current || saving) return;
      const token = generation, previous = collapsed;
      collapsed = !collapsed; saving = true; status.textContent = ''; refresh();
      try {
        await app.settings.save({ headerCollapsed: collapsed });
      } catch {
        if (enabled && generation === token) {
          collapsed = previous;
          status.textContent = 'Couldn’t save header preference. Please try again.';
        }
      } finally {
        if (enabled && generation === token) { saving = false; refresh(); }
      }
    });
    document.body.append(controls);
  }

  function closeSearch() {
    if (!open || !current) return;
    open = false;
    refresh();
    searchButton.focus();
  }

  function restoreCompose() {
    if (!compose) return;
    compose.shell.removeAttribute('data-gp-compose-relocated');
    compose.button.remove();
    compose = undefined;
    window.dispatchEvent(new Event('resize'));
  }

  function placeCompose(ctx) {
    const sources = [...document.querySelectorAll('[role="navigation"] > .aic > .z0 > [gh="cm"][role="button"]')];
    const selects = [...ctx.actions.querySelectorAll('.G-as3[role="button"]:has([role="checkbox"])')].filter(visible);
    const source = sources.length === 1 ? sources[0] : null;
    const select = selects.length === 1 ? selects[0] : null;
    const shell = source?.closest('.aic');
    // Hide only the dedicated native Compose row, never other sidebar content.
    const safe = shell && shell.children.length === 1 && source.parentElement.children.length === 1 && geometry(ctx, compose ? 0 : 32);
    if (compose && (!safe || !select || compose.source !== source || compose.select !== select || !compose.button.isConnected)) restoreCompose();
    if (!safe || !select || compose) return;
    // Gmail/other extensions may copy toolbar markup without our listeners.
    ctx.actions.querySelectorAll('.gmail-pro-toolbar-compose').forEach(node => node.remove());
    const node = button('Compose', 'M14 4H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-9M17 3l4 4M10 14l1-4L19 2l3 3-8 8-4 1Z');
    node.className = 'gmail-pro-toolbar-compose';
    node.addEventListener('click', () => {
      if (enabled && source.isConnected) source.click();
    });
    select.after(node);
    compose = { source, shell, select, button: node };
    shell.setAttribute('data-gp-compose-relocated', '');
    window.dispatchEvent(new Event('resize'));
  }

  function focusChanged(event) {
    if (!current || !current.form.contains(event.target) || open) return;
    // The compact field stays programmatically focusable offscreen. Gmail's
    // native / shortcut and native tab order reveal it without replacing keys.
    open = true; refresh();
  }

  function keydown(event) {
    if (event.key !== 'Escape' || !open || !current || !controls || controls.dataset.narrow !== 'true') return;
    // Give Gmail first use of Escape for suggestions and advanced filters.
    if (nativePopupOpen()) return;
    event.preventDefault(); closeSearch();
  }

  function nativePopupOpen() {
    return current && ([...current.form.querySelectorAll(S.headerSuggestions)].some(visible) ||
      [...document.querySelectorAll(S.headerAdvancedPanel)].some(panel => visible(panel.querySelector('.ZF-zT'))));
  }

  function outside(event) {
    if (!open || !current || current.form.contains(event.target) || controls.contains(event.target) ||
        event.target.closest(S.headerAdvancedPanel) || nativePopupOpen()) return;
    open = false; schedule();
  }

  function restore() {
    restoreCompose();
    if (!current) return;
    const wasCollapsed = current.shell.hasAttribute('data-gp-header-collapsed');
    current.shell.removeAttribute('data-gp-header-collapsed');
    current.banner.removeAttribute('data-gp-header-collapsed');
    current.form.removeAttribute('data-gp-toolbar-search');
    current.main.removeAttribute('data-gp-header-main');
    current.main.style.removeProperty('--gp-header-main-height');
    for (const panel of markedPanels) {
      panel.removeAttribute('data-gp-search-panel');
      for (const name of ['left', 'top', 'width']) panel.style.removeProperty('--gp-search-panel-' + name);
    }
    markedPanels.clear();
    for (const name of ['left', 'top', 'width']) current.form.style.removeProperty('--gp-search-' + name);
    controls?.remove();
    current = undefined;
    if (wasCollapsed) window.dispatchEvent(new Event('resize'));
  }

  function watch(ctx) {
    if (ctx) lastContext = ctx;
    ctx ||= lastContext;
    // Retain connected shallow ancestors while Gmail removes/replaces a shell.
    // A subsequent invalid discovery must not drop the watch needed to recover.
    const intact = ctx?.form.isConnected && ctx.toolbar.isConnected && ctx.shell.isConnected;
    const spine = new Set(intact ? [] : [...ancestorSpine].filter(node => node.isConnected));
    for (const node of ctx ? [ctx.form, ctx.toolbar, ctx.shell, ...document.querySelectorAll('[role="navigation"] > .aic > .z0 > [gh="cm"]')] : [document.body]) {
      for (let parent = node; parent; parent = parent.parentElement) spine.add(parent);
    }
    for (const node of spine) observer.observe(node, { childList: true, attributes: true,
      attributeFilter: ['class', 'style', 'hidden', 'aria-hidden'] });
    ancestorSpine = spine;
    if (ctx) observer.observe(ctx.toolbar, { childList: true, subtree: true, attributes: true,
      attributeFilter: ['class', 'style', 'hidden', 'aria-hidden'] });
    for (const panel of document.querySelectorAll(S.headerAdvancedPanel)) observer.observe(panel,
      { childList: true, attributes: true, attributeFilter: ['class', 'style', 'hidden'] });
    const sizes = new Set(ctx ? [ctx.toolbar, ctx.actions, ctx.pager, ctx.banner] : []);
    for (const node of observedSizes) if (!sizes.has(node)) resizeObserver.unobserve(node);
    for (const node of sizes) if (!observedSizes.has(node)) resizeObserver.observe(node);
    observedSizes = sizes;
  }

  function refresh() {
    observer.disconnect();
    const next = discover();
    if (!next) { const previous = current; restore(); watch(previous); return; }
    if (current && (current.form !== next.form || current.toolbar !== next.toolbar || current.shell !== next.shell || current.main !== next.main)) {
      restore(); open = false;
    }
    current = next;
    placeCompose(current);
    let layout = geometry(current);
    if (!layout) { restore(); watch(next); return; }
    bootstrap?.disconnect(); bootstrap = undefined; clearTimeout(bootstrapTimer);
    if (!controls) createControls();
    else if (!controls.isConnected) document.body.append(controls);
    const changed = current.shell.hasAttribute('data-gp-header-collapsed') !== collapsed;
    current.shell.toggleAttribute('data-gp-header-collapsed', collapsed);
    current.banner.toggleAttribute('data-gp-header-collapsed', collapsed);
    if (changed) {
      // Gmail owns pane heights. Recalculate once per actual header transition,
      // never on every observer delivery or animation frame.
      window.dispatchEvent(new Event('resize'));
      layout = geometry(current) || layout;
      schedule();
    }
    // Gmail updates the viewport and native pane heights on resize, but its
    // right-split main retains a CSS height with the old 64px header allowance.
    // Fit that one wrapper to Gmail's measured viewport; never set pane widths,
    // scrolling positions, message heights, or a guessed viewport constant.
    if (collapsed && current.viewport && current.main.querySelector(S.headerRightSplit)) {
      const height = current.viewport.getBoundingClientRect().bottom - current.main.getBoundingClientRect().top;
      if (height > 100) {
        current.main.style.setProperty('--gp-header-main-height', `${height}px`);
        current.main.setAttribute('data-gp-header-main', '');
      }
    } else {
      current.main.removeAttribute('data-gp-header-main');
      current.main.style.removeProperty('--gp-header-main-height');
    }
    if (!layout.narrow) open = false;
    const showing = !layout.narrow || open;
    const controlWidth = layout.narrow ? BUTTON * 2 + GAP : BUTTON;
    controls.dataset.narrow = String(layout.narrow);
    controls.style.left = `${layout.right - controlWidth}px`;
    controls.style.top = `${layout.top + 2}px`;
    searchButton.hidden = !layout.narrow || open;
    closeButton.hidden = !layout.narrow || !open;
    searchButton.setAttribute('aria-expanded', String(open));
    toggleButton.setAttribute('aria-expanded', String(!collapsed));
    if (current.banner.id) toggleButton.setAttribute('aria-controls', current.banner.id);
    else toggleButton.removeAttribute('aria-controls');
    if (current.form.id) searchButton.setAttribute('aria-controls', current.form.id);
    else searchButton.removeAttribute('aria-controls');
    const label = collapsed ? 'Expand Gmail header' : 'Collapse Gmail header';
    toggleButton.title = label; toggleButton.setAttribute('aria-label', label);
    toggleButton.dataset.collapsed = String(collapsed);
    toggleButton.disabled = saving;
    current.form.style.setProperty('--gp-search-left', `${layout.right - controlWidth - GAP - layout.width}px`);
    current.form.style.setProperty('--gp-search-top', `${layout.top}px`);
    current.form.style.setProperty('--gp-search-width', `${layout.width}px`);
    current.form.setAttribute('data-gp-toolbar-search', showing ? 'field' : 'icon');
    // Gmail anchors the advanced panel vertically to the form but keeps its
    // original horizontal header offset. Position that native outer shell only;
    // preserve all filter fields, native width, menus, styling and handlers.
    for (const panel of markedPanels) if (!panel.isConnected) markedPanels.delete(panel);
    if (showing) for (const panel of document.querySelectorAll(S.headerAdvancedPanel)) {
      const body = panel.querySelector('.ZF-zT');
      if (!visible(body)) continue;
      const width = Math.min(body.getBoundingClientRect().width, innerWidth - GAP * 2);
      const left = Math.max(GAP, Math.min(current.form.getBoundingClientRect().left, innerWidth - width - GAP));
      panel.style.setProperty('--gp-search-panel-left', `${left}px`);
      panel.style.setProperty('--gp-search-panel-top', `${layout.top + 38}px`);
      panel.style.setProperty('--gp-search-panel-width', `${width}px`);
      panel.setAttribute('data-gp-search-panel', ''); markedPanels.add(panel);
    }
    watch(current);
  }

  function navigate() { open = false; schedule(); }

  function stop() {
    enabled = false; generation++; saving = false; open = false;
    cancelAnimationFrame(frame); frame = 0;
    clearTimeout(bootstrapTimer); bootstrap?.disconnect(); bootstrap = undefined;
    observer?.disconnect(); resizeObserver?.disconnect(); observedSizes.clear();
    ancestorSpine.clear(); lastContext = undefined;
    window.removeEventListener('resize', schedule);
    window.removeEventListener('hashchange', navigate);
    window.removeEventListener('popstate', navigate);
    document.removeEventListener('focusin', focusChanged);
    document.removeEventListener('keydown', keydown);
    document.removeEventListener('pointerdown', outside, true);
    restore(); controls?.remove(); controls = undefined;
  }

  function update(patch = {}) {
    if (Object.hasOwn(patch, 'headerCollapsed')) collapsed = patch.headerCollapsed === true;
    if (Object.hasOwn(patch, 'appleMailModeEnabled') && !patch.appleMailModeEnabled) return stop();
    if (!enabled && patch.appleMailModeEnabled) {
      enabled = true; generation++;
      observer = new MutationObserver(schedule);
      resizeObserver = new ResizeObserver(schedule);
      window.addEventListener('resize', schedule);
      window.addEventListener('hashchange', navigate);
      window.addEventListener('popstate', navigate);
      document.addEventListener('focusin', focusChanged);
      document.addEventListener('keydown', keydown);
      document.addEventListener('pointerdown', outside, true);
      // Bounded initial shell discovery; ongoing watches only cover chrome and
      // shallow ancestor replacement, never messages, editors or mailbox rows.
      bootstrap = new MutationObserver(schedule);
      bootstrap.observe(document, { childList: true, subtree: true });
      bootstrapTimer = setTimeout(() => { bootstrap?.disconnect(); bootstrap = undefined; }, 10000);
    }
    if (enabled) schedule();
  }
  app.headerLayout = Object.freeze({ start: update, update, stop });
})();
