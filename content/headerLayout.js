(() => {
  "use strict";
  const app = (globalThis.GmailPro ??= {});
  if (app.headerLayout) return;
  const S = app.selectors;
  const GAP = 8, BUTTON = 32, SEARCH_WIDTH = 360, TRANSITION_TIMEOUT = 3000;
  const NATIVE_SORT = 'button[data-idom-class="hsirxb"]', NATIVE_SORT_ANCHOR = '.tB5Jxf-M-X-ql-Jf';
  let enabled = false, collapsed = false, open = false, saving = false;
  let current, lastContext, controls, searchButton, toggleButton, closeButton, status, layoutTransition;
  let compose, mailboxCaption, captionList, countSnapshot, sidebar, mailboxLoading, searchSort, sortSlot;
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
    // Labels/search add a refinement row above the native mail actions. Use
    // their shared row, rather than the height of the whole toolbar wrapper.
    let actionRow = actions[0].parentElement;
    while (actionRow !== toolbar && !actionRow.contains(pagers[0])) actionRow = actionRow.parentElement;
    const main = toolbar.closest(S.main), viewport = main.closest(S.headerViewport);
    const lists = [...main.querySelectorAll(S.pagingList)].filter(visible);
    return { banner, shell, form, input, toolbar, actionRow, main, viewport,
      list: lists.length === 1 ? lists[0] : null, actions: actions[0], pager: pagers[0], pathname: location.pathname };
  }

  const decodeHash = value => {
    try { return decodeURIComponent(value.replace(/\+/g, ' ')); }
    catch { return value; }
  };
  const mailboxKey = hash => decodeHash(hash.split('?')[0].replace(/\/p[1-9]\d*$/, ''));

  const mailboxNames = { inbox: 'Inbox', sent: 'Sent', starred: 'Starred', snoozed: 'Snoozed',
    scheduled: 'Scheduled', drafts: 'Drafts', all: 'All Mail', important: 'Important',
    spam: 'Spam', trash: 'Trash' };

  function mailbox() {
    // Gmail appends ?compose=... when a floating draft finishes opening/saving.
    // Strip URL parameters before decoding so encoded '?' in labels/searches
    // stays part of the mailbox identity. Native links use literal slashes
    // while Gmail's SPA route may encode the same nested label path as %2F.
    const hash = mailboxKey(location.hash);
    const selected = [...document.querySelectorAll('[role="navigation"] .TO.nZ .n0[href]')];
    for (const link of selected) {
      const key = decodeHash(new URL(link.href, location.href).hash);
      if (hash !== key && !hash.startsWith(key + '/')) continue;
      let name = link.textContent.trim();
      if (key.startsWith('#label/')) name = key.slice(7).split('/').pop() || name;
      if (name) return { key, name, link };
    }
    const route = hash.slice(1).split('/')[0];
    if (mailboxNames[route]) return { key: '#' + route, name: mailboxNames[route] };
    if (route === 'search') return { key: hash, name: 'Search results' };
    return null;
  }

  const loadingMarker = 'data-gp-mailbox-loading';
  const mailboxExcluded = '.ii, .a3s, [contenteditable], form, [role="region"], [role="dialog"], [role="menu"], [role="listbox"], [data-gmail-pro-label-ui]';

  function loadingTarget(row) {
    if (!row?.isConnected || !row.closest('[role="navigation"]') || row.closest(mailboxExcluded)) return null;
    const line = row.querySelector(':scope > .TO > .TN');
    const links = line?.querySelectorAll('a.n0[href]');
    const slot = line?.querySelector(':scope > .nL'), menu = line?.querySelector(S.labelMenu);
    if (links?.length !== 1 || !slot) return null;
    const link = links[0];
    let url;
    try { url = new URL(link.href, location.href); } catch { return null; }
    const key = mailboxKey(url.hash);
    if (url.origin !== location.origin || url.pathname !== location.pathname || (link.target && !['_self', '_top'].includes(link.target))) return null;
    if (key.startsWith('#label/')) {
      if (menu?.parentElement !== slot || menu.getAttribute('data-label-name') !== key.slice(7)) return null;
    } else if (!Object.hasOwn(mailboxNames, key.slice(1)) || menu) return null;
    return { row, line, link, slot, key };
  }

  function restoreLoadingSlot(state) {
    state.spinner?.remove();
    if (state.slot?.getAttribute(loadingMarker) !== '') return;
    if (state.slotBefore === null) state.slot.removeAttribute(loadingMarker);
    else state.slot.setAttribute(loadingMarker, state.slotBefore);
  }

  function clearMailboxLoading() {
    if (!mailboxLoading) return;
    clearTimeout(mailboxLoading.timer);
    restoreLoadingSlot(mailboxLoading);
    mailboxLoading = undefined;
  }

  function placeLoadingSlot(state, target) {
    restoreLoadingSlot(state);
    Object.assign(state, target);
    // Native sidebar clones may inherit presentation but not our ownership.
    state.slotBefore = target.slot.getAttribute(loadingMarker) || null;
    target.slot.querySelectorAll(':scope > .gmail-pro-mailbox-spinner').forEach(node => node.remove());
    const spinner = document.createElement('span');
    spinner.className = 'gmail-pro-mailbox-spinner';
    spinner.setAttribute('role', 'status');
    const text = document.createElement('span'); text.textContent = 'Loading mailbox'; spinner.append(text);
    state.spinner = spinner;
    target.slot.setAttribute(loadingMarker, '');
    target.slot.append(spinner);
  }

  function listSnapshot(ctx) {
    const list = ctx.list, content = list?.querySelector(':scope > .ae4');
    const grid = content?.querySelector('table[role="grid"]');
    const first = grid?.querySelector('tbody > tr[role="row"]');
    const last = grid?.querySelector('tbody > tr[role="row"]:last-child');
    const identity = row => row?.querySelector(S.pagingIdentity)?.getAttribute('data-thread-id');
    return { list, content, grid, first, last, firstID: identity(first), lastID: identity(last),
      range: ctx.pager.querySelector(S.pagingRange), empty: content?.querySelector('.TC') };
  }

  function loadingNodes(list) {
    return [list?.querySelector(':scope > .zchc9b'),
      document.querySelector('.vY > .vX:has(.vZ.L4XNt > .v1)')].filter(Boolean);
  }

  function nativeMailboxBusy(list) {
    // Read Gmail's own inline visibility, because Apple Mail Mode hides the
    // top loading banner in CSS. Do not infer completion from that hidden paint.
    return list?.getAttribute('aria-busy') === 'true' || loadingNodes(list).some(node =>
      !node.hidden && node.getAttribute('aria-hidden') !== 'true' && !node.classList.contains('UC') &&
      node.style.display !== 'none' && node.style.visibility !== 'hidden');
  }

  function watchMailboxLoading(ctx) {
    if (!mailboxLoading || !ctx?.list) return;
    observer.observe(ctx.list, { childList: true, subtree: true, characterData: true, attributes: true,
      attributeOldValue: true, attributeFilter: ['class', 'style', 'hidden', 'aria-hidden', 'aria-busy', 'role', 'data-thread-id', 'data-legacy-thread-id'] });
    for (const node of loadingNodes(ctx.list)) observer.observe(node, { childList: true, subtree: true, attributes: true,
      attributeOldValue: true, attributeFilter: ['class', 'style', 'hidden', 'aria-hidden'] });
    observer.observe(mailboxLoading.row, { childList: true, subtree: true, attributes: true,
      attributeFilter: ['href', 'data-label-name'] });
  }

  function mailboxClicked(event) {
    if (!enabled || !current?.list || event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey ||
        !(event.target instanceof Element) || event.target.closest(mailboxExcluded + ', .nL')) return;
    const clickedLink = event.target.closest('a');
    if (clickedLink && !clickedLink.matches('a.n0')) return; // Native expand/disclose controls.
    const target = loadingTarget(event.target.closest('.aim'));
    if (!target || target.key === mailboxLoading?.key) return;
    clearMailboxLoading();
    if (target.key === mailboxKey(location.hash)) return;
    // Capture native list references before Gmail handles the click. No layout
    // measurement, route interception, fetching, or cached mailbox data.
    const state = { key: target.key, pathname: location.pathname, before: listSnapshot(current), sawBusy: nativeMailboxBusy(current.list), committed: false };
    mailboxLoading = state;
    placeLoadingSlot(state, target); // Synchronous feedback, before native navigation.
    state.timer = setTimeout(() => {
      if (mailboxLoading !== state) return;
      clearMailboxLoading(); schedule(); // Failed/ignored navigation must not leave a stuck spinner.
    }, 15000);
    watchMailboxLoading(current);
  }

  function reconcileMailboxLoading(ctx) {
    const state = mailboxLoading;
    if (!state) return;
    if (location.pathname !== state.pathname) { clearMailboxLoading(); return; }
    const target = loadingTarget(state.row);
    if (!target || target.key !== state.key || target.slot !== state.slot || !state.spinner.isConnected) {
      const replacement = [...document.querySelectorAll('[role="navigation"] .aim')].map(loadingTarget).find(candidate => candidate?.key === state.key);
      if (!replacement) { clearMailboxLoading(); return; }
      placeLoadingSlot(state, replacement);
    }
    if (mailboxKey(location.hash) !== state.key || !ctx?.list) return;
    const busy = nativeMailboxBusy(ctx.list); state.sawBusy ||= busy;
    if (busy) return;
    const next = listSnapshot(ctx), before = state.before;
    const ready = next.firstID || (next.empty && !next.first && visible(next.empty));
    const changed = ['list', 'content', 'grid', 'first', 'last', 'firstID', 'lastID', 'range', 'empty'].some(key => before[key] !== next[key]);
    if (ready && (changed || state.committed || state.sawBusy)) clearMailboxLoading();
  }

  function removeCaption() {
    captionList?.removeAttribute('data-gp-mailbox-caption'); captionList = undefined;
    mailboxCaption?.remove(); mailboxCaption = undefined;
  }

  function updateCaption(ctx) {
    const view = mailbox();
    ctx.mailboxLink = view?.link;
    if (!view || !ctx.list) { removeCaption(); return; }
    const range = ctx.pager.querySelector(S.pagingRange);
    const empty = ctx.list.querySelector('.ae4 .TC');
    const text = range?.textContent || '';
    // Gmail can change the route before replacing the previous view's count.
    // Only attach a total after native pagination/empty-state evidence changes.
    if (!countSnapshot || countSnapshot.range !== range || countSnapshot.text !== text || countSnapshot.empty !== empty) {
      countSnapshot = { key: view.key, range, text, empty };
    }
    let total;
    if (countSnapshot.key === view.key) {
      const numbers = [...(range?.querySelectorAll(S.pagingRangeNumber) || [])];
      const numeric = node => {
        const value = node?.textContent.replace(/[,\s\u200e\u200f]/g, '');
        return value && /^\d+$/.test(value) && Number.isSafeInteger(Number(value)) ? Number(value) : null;
      };
      const [first, last, count] = numbers.map(numeric);
      if (numbers.length === 3 && first > 0 && last >= first && count >= last) {
        total = (/\babout\b/i.test(text) ? 'about ' : '') + count.toLocaleString() + (count === 1 ? ' message' : ' messages');
      } else if (!range && visible(empty) && !ctx.list.querySelector('tr[role="row"]')) {
        total = '0 messages';
      }
    }
    // Read layout before caption/list mutations to avoid forcing another layout.
    const width = `${ctx.list.getBoundingClientRect().width}px`;
    if (!mailboxCaption) {
      mailboxCaption = document.createElement('div');
      mailboxCaption.className = 'gmail-pro-mailbox-caption';
    }
    // The toolbar owns caption position. Never derive its screen coordinates
    // from a scrolling pane, including during transient scroll/compositor shifts.
    if (captionList !== ctx.list) {
      captionList?.removeAttribute('data-gp-mailbox-caption'); captionList = ctx.list;
    }
    if (!ctx.list.hasAttribute('data-gp-mailbox-caption')) ctx.list.setAttribute('data-gp-mailbox-caption', '');
    ctx.toolbar.querySelectorAll(':scope > .gmail-pro-mailbox-caption').forEach(node => { if (node !== mailboxCaption) node.remove(); });
    if (mailboxCaption.parentElement !== ctx.toolbar) ctx.toolbar.append(mailboxCaption);
    if (mailboxCaption.style.getPropertyValue('--gp-caption-width') !== width) mailboxCaption.style.setProperty('--gp-caption-width', width);
    const caption = view.name + (total ? ' • ' + total : '');
    if (mailboxCaption.textContent !== caption) mailboxCaption.textContent = caption;
    if (mailboxCaption.title !== caption) mailboxCaption.title = caption;
    ctx.captionRange = range; ctx.captionEmpty = empty;
  }

  function geometry(ctx, reserve = 0) {
    const bar = ctx.toolbar.getBoundingClientRect();
    const row = ctx.actionRow.getBoundingClientRect();
    const action = ctx.actions.getBoundingClientRect(), pager = ctx.pager.getBoundingClientRect();
    // Include actual hit targets (including Gmail Pro / third-party actions),
    // not just Gmail's sometimes shorter action-group box.
    const buttons = [...ctx.actions.querySelectorAll('button, [role="button"]')].filter(visible);
    const left = Math.max(bar.left + GAP, action.right, ...buttons.map(node => node.getBoundingClientRect().right)) + GAP + reserve;
    // Gmail's search-order selector is outside both actions and pagination.
    // Reserve all native controls on the right, including unsupported ones.
    const rightControls = [...ctx.actionRow.querySelectorAll('button, [role="button"]')]
      .filter(node => visible(node) && !ctx.actions.contains(node) && !ctx.pager.contains(node) &&
        node !== searchSort?.node && !(document.documentElement.hasAttribute('data-gp-search-sort-active') && node.matches(NATIVE_SORT)))
      .map(node => node.getBoundingClientRect()).filter(box => box.left >= action.right);
    const toggleLeft = Math.min(bar.right, document.documentElement.clientWidth) - GAP - BUTTON;
    if (ctx.toolbar.hasAttribute('data-gp-header-toolbar') &&
        Math.max(pager.right, ...rightControls.map(box => box.right)) > toggleLeft - GAP + .5) return null;
    const right = Math.min(toggleLeft - GAP, pager.left - GAP, ...rightControls.map(box => box.left - GAP));
    if (row.top < 0 || row.height < 20 || row.height > 80 || right - left < BUTTON * 2 + GAP) return null;
    // Keep the field stable as selection actions appear/disappear. If the
    // complete field cannot fit, use the existing compact search control.
    const sortWidth = document.documentElement.hasAttribute('data-gp-search-sort-active') ? BUTTON : 0;
    const narrow = right - left < SEARCH_WIDTH + GAP + sortWidth;
    const width = narrow ? Math.min(SEARCH_WIDTH, right - bar.left - BUTTON - GAP * 2 - sortWidth - (sortWidth ? GAP : 0)) : SEARCH_WIDTH;
    if (width < 180) return null;
    return { narrow, width, right, sortWidth, toggleLeft, top: row.top + (row.height - 36) / 2 };
  }

  function placeToolbar(ctx) {
    if (ctx.toolbar.hasAttribute('data-gp-header-toolbar')) return;
    // Keep native paging/split-pane controls in their own row with a reserved
    // trailing slot for the header arrow. Native padding restores on mode OFF.
    const padding = getComputedStyle(ctx.toolbar).paddingRight;
    ctx.toolbar.style.setProperty('--gp-header-toolbar-padding-right', padding);
    ctx.toolbar.setAttribute('data-gp-header-toolbar', '');
  }

  function restoreToolbar(toolbar) {
    toolbar.removeAttribute('data-gp-header-toolbar');
    toolbar.style.removeProperty('--gp-header-toolbar-padding-right');
  }

  function schedule() {
    if (!enabled || frame) return;
    frame = requestAnimationFrame(() => { frame = 0; if (enabled) refresh(); });
  }

  function icon(path) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true');
    const shape = document.createElementNS(svg.namespaceURI, 'path');
    shape.setAttribute('d', path); svg.append(shape);
    return svg;
  }

  function button(label, path) {
    const node = document.createElement('button');
    node.type = 'button'; node.title = label; node.setAttribute('aria-label', label);
    node.append(icon(path));
    return node;
  }

  function releaseSearchSort() {
    if (!searchSort) return;
    for (const [name, value] of searchSort.labels) {
      if (searchSort.node.getAttribute(name) === value) searchSort.node.removeAttribute(name);
    }
    searchSort.node.removeAttribute('data-gp-search-sort');
    searchSort.anchor.removeAttribute('data-gp-search-sort-anchor');
    searchSort = undefined;
  }

  function restoreSearchSort() {
    releaseSearchSort();
    document.documentElement.removeAttribute('data-gp-search-sort-active');
    for (const name of ['left', 'top']) document.documentElement.style.removeProperty('--gp-search-sort-' + name);
    if (sortSlot) sortSlot.hidden = true;
  }

  function searchSortLabel(node) {
    // Current Gmail says "Showing most ..."; older toolbars omit "Showing".
    const match = /^(?:Showing )?most (relevant|recent)$/i.exec(node.textContent.trim());
    return match ? 'Most ' + match[1].toLowerCase() : null;
  }

  function updateSortSlot() {
    if (!sortSlot) return;
    const order = document.documentElement.getAttribute('data-gp-search-sort-active');
    sortSlot.hidden = !order;
    const path = order === 'recent' ? 'M17 10a7 7 0 1 1-7-7 7 7 0 0 1 7 7M10 6v4l3 2M19 18l2 2 2-2' :
      'M9 2l2.2 5.8L17 10l-5.8 2.2L9 18l-2.2-5.8L1 10l5.8-2.2L9 2M18 2v4M16 4h4M19 18l2 2 2-2';
    const shape = sortSlot.firstElementChild.firstElementChild;
    if (shape.getAttribute('d') !== path) shape.setAttribute('d', path);
  }

  function placeSearchSort(ctx) {
    const searching = mailboxKey(location.hash).startsWith('#search/');
    const buttons = [...ctx.actionRow.querySelectorAll('button, [role="button"]')]
      .filter(node => visible(node) && !ctx.actions.contains(node));
    const candidates = searching ? buttons.filter(searchSortLabel) : [];
    const node = candidates.length === 1 ? candidates[0] : null;
    if (!searching || candidates.length > 1 || buttons.some(button => button.matches(NATIVE_SORT) && !searchSortLabel(button))) {
      restoreSearchSort(); return;
    }
    if (searchSort?.node !== node) releaseSearchSort();
    // The persistent slot survives a briefly absent native button. Rebuilt
    // buttons are transparent and anchored by CSS before discovery is ready.
    if (!node) { updateSortSlot(); return; }
    if (!searchSort) {
      const owner = node.closest(NATIVE_SORT_ANCHOR);
      const anchor = owner && ctx.actionRow.contains(owner) && !owner.contains(ctx.pager) && !owner.contains(ctx.actions) ? owner : node;
      searchSort = { node, anchor, labels: new Map() };
    }
    const label = searchSortLabel(node), order = label === 'Most recent' ? 'recent' : 'relevant';
    for (const name of ['aria-label', 'title']) {
      if (!node.hasAttribute(name) || node.getAttribute(name) === searchSort.labels.get(name)) {
        const value = name === 'title' ? 'Search order: ' + label : label;
        if (node.getAttribute(name) !== value) node.setAttribute(name, value);
        searchSort.labels.set(name, value);
      }
    }
    if (node.getAttribute('data-gp-search-sort') !== order) node.setAttribute('data-gp-search-sort', order);
    if (!searchSort.anchor.hasAttribute('data-gp-search-sort-anchor')) searchSort.anchor.setAttribute('data-gp-search-sort-anchor', '');
    // Discard only old presentation clones. Gmail keeps its native children,
    // focus, click handlers and menu; the visible SVG belongs to the header.
    node.querySelectorAll('.gmail-pro-search-sort-icon').forEach(svg => svg.remove());
    if (document.documentElement.getAttribute('data-gp-search-sort-active') !== order)
      document.documentElement.setAttribute('data-gp-search-sort-active', order);
    updateSortSlot();
  }

  function createControls() {
    controls = document.createElement('div');
    controls.className = 'gmail-pro-header-controls';
    controls.dataset.gpSearchTransition = 'mail-view'; // Content-free loaded-source diagnostic.
    controls.setAttribute('role', 'group'); controls.setAttribute('aria-label', 'Gmail header controls');
    searchButton = button('Open search', 'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0');
    searchButton.dataset.gpHeaderAction = 'search';
    closeButton = button('Close search', 'M6 6l12 12M18 6L6 18');
    closeButton.dataset.gpHeaderAction = 'close';
    toggleButton = button('Collapse Gmail header', 'M6 15l6-6 6 6');
    toggleButton.dataset.gpHeaderAction = 'toggle';
    sortSlot = document.createElement('span'); sortSlot.className = 'gmail-pro-search-sort-slot';
    sortSlot.setAttribute('aria-hidden', 'true');
    const sortIcon = icon(''); sortIcon.classList.add('gmail-pro-search-sort-icon'); sortSlot.append(sortIcon);
    updateSortSlot();
    status = document.createElement('span'); status.className = 'gmail-pro-header-status';
    status.setAttribute('role', 'status');
    controls.append(searchButton, closeButton, sortSlot, toggleButton, status);
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

  function sidebarSections() {
    const nav = compose?.shell.parentElement;
    if (!nav || compose.brand.hasAttribute('data-compact')) return null;
    const roots = [...nav.querySelectorAll('.nM')];
    if (roots.length !== 1) return null;
    const root = roots[0], sections = [...root.children].filter(node => node.matches('.yJ'));
    if (sections.length !== 2) return null;
    const system = sections.find(node => node.querySelector('.byl > .TK > .aim a[href$="#inbox"]'));
    const labels = sections.find(node => node.querySelector('[gh="cl"] > .TK'));
    const header = root.querySelector(':scope > .aAw'), title = header?.querySelector(':scope > [role="heading"]');
    if (!system || !labels || system === labels || !title || !/^(Labels|Mailboxes)$/.test(title.textContent) || !header.querySelector(S.labelCreate)) return null;
    const boxes = [system, labels].map(section => section.querySelector(':scope > .ajl > .wT'));
    if (boxes.some(box => !box || box.children.length !== 3 || !box.children[0].matches('.n3') ||
        !box.children[1].matches('.n6') || !box.children[1].querySelector('[gh="mll"][role="button"]'))) return null;
    const toggles = boxes.map(box => box.children[1].querySelector('[gh="mll"]'));
    if (toggles.some(toggle => !/^(More|Less) labels$/.test(toggle.getAttribute('aria-label') || ''))) return null;
    return { root, system, labels, header, title, toggles,
      inbox: system.querySelector('.byl > .TK > .aim:has(a[href$="#inbox"])') };
  }

  function restoreSidebar(restoreDisclosure = true) {
    if (!sidebar) return;
    const previous = sidebar; sidebar = undefined;
    previous.more.remove();
    for (const [node, attribute] of [[previous.root, 'data-gp-mailboxes'], [previous.system, 'data-gp-system-section'],
      [previous.labels, 'data-gp-label-section'], [previous.inbox, 'data-gp-inbox']]) node.removeAttribute(attribute);
    previous.root.removeAttribute('data-gp-mailboxes-open');
    for (const [node, text] of previous.titles) if (node.textContent === 'Mailboxes') node.textContent = text;
    // Undo only native disclosure changes made by this presentation layer.
    if (restoreDisclosure) for (const [index, toggle] of previous.toggles.entries()) {
      const name = toggle.getAttribute('aria-label');
      if (toggle.isConnected && /^(More|Less) labels$/.test(name || '') &&
          (name === 'Less labels') !== previous.disclosures[index]) toggle.click();
    }
  }

  function discloseSidebar() {
    if (!sidebar?.open) return;
    for (const toggle of sidebar.toggles) if (!sidebar.attempted.has(toggle) && toggle.getAttribute('aria-label') === 'More labels') {
      sidebar.attempted.add(toggle);
      toggle.click();
    }
  }

  function placeSidebar() {
    const next = sidebarSections();
    let previousState;
    if (sidebar && (!next || ['root', 'system', 'labels', 'header', 'title', 'inbox'].some(key => sidebar[key] !== next[key]) ||
        sidebar.toggles.some((node, index) => node !== next.toggles[index]) || !sidebar.more.isConnected)) {
      // Gmail can rebuild native rows after a disclosure. Rebind their owners
      // without closing More or repeatedly toggling Gmail's new controls.
      if (next && sidebar.nav === compose.shell.parentElement) previousState = {
        open: sidebar.open, disclosures: sidebar.disclosures, focused: sidebar.more === document.activeElement
      };
      restoreSidebar(!previousState);
    }
    if (!next) return;
    if (!sidebar) {
      // Flatten only validated section wrappers in CSS. Gmail retains every
      // native row/parent, including the flat label sequence used by labelOrder.
      next.root.querySelectorAll(':scope > .gmail-pro-mailboxes-more').forEach(node => node.remove());
      const more = button('More mailboxes', 'M6 9l6 6 6-6');
      more.className = 'gmail-pro-mailboxes-more';
      const caption = document.createElement('span'); caption.textContent = 'More'; more.append(caption);
      more.setAttribute('aria-expanded', 'false');
      next.root.append(more);
      sidebar = { ...next, more, nav: compose.shell.parentElement, open: previousState?.open || false,
        disclosures: previousState?.disclosures || next.toggles.map(toggle => toggle.getAttribute('aria-label') === 'Less labels'),
        attempted: new Set(), titles: new Map() };
      for (const node of [next.title, ...next.root.querySelectorAll(':scope > .yJ > .ajl > h2')]) {
        sidebar.titles.set(node, node.textContent === 'Mailboxes' ? 'Labels' : node.textContent);
      }
      more.addEventListener('click', () => {
        if (!enabled || sidebar?.more !== more) return;
        sidebar.open = !sidebar.open;
        if (sidebar.open) for (const toggle of sidebar.attempted) {
          if (toggle.getAttribute('aria-label') === 'More labels') sidebar.attempted.delete(toggle);
        }
        placeSidebar(); schedule();
      });
      for (const [node, attribute] of [[next.root, 'data-gp-mailboxes'], [next.system, 'data-gp-system-section'],
        [next.labels, 'data-gp-label-section'], [next.inbox, 'data-gp-inbox']]) node.setAttribute(attribute, '');
      if (previousState?.focused) more.focus({ preventScroll: true });
    }
    for (const node of [sidebar.title, ...sidebar.root.querySelectorAll(':scope > .yJ > .ajl > h2')]) {
      if (node.textContent === 'Mailboxes') continue;
      if (!sidebar.titles.has(node)) sidebar.titles.set(node, node.textContent);
      node.textContent = 'Mailboxes';
    }
    sidebar.root.toggleAttribute('data-gp-mailboxes-open', sidebar.open);
    const caption = sidebar.open ? 'Less' : 'More';
    const name = caption + ' mailboxes';
    if (sidebar.more.lastElementChild.textContent !== caption) sidebar.more.lastElementChild.textContent = caption;
    if (sidebar.more.getAttribute('aria-label') !== name) {
      sidebar.more.setAttribute('aria-label', name); sidebar.more.title = name;
      sidebar.more.setAttribute('aria-expanded', String(sidebar.open));
    }
    discloseSidebar();
  }

  function restoreCompose() {
    restoreSidebar();
    if (!compose) return;
    compose.shell.removeAttribute('data-gp-compose-relocated');
    compose.button.remove();
    compose.brand.remove();
    compose = undefined;
    window.dispatchEvent(new Event('resize'));
  }

  function placeCompose(ctx) {
    const sources = [...document.querySelectorAll('[role="navigation"] > .aic > .z0 > [gh="cm"][role="button"]')];
    const selects = [...ctx.actions.querySelectorAll('.G-as3[role="button"]:has([role="checkbox"])')].filter(visible);
    const source = sources.length === 1 ? sources[0] : null;
    const select = selects.length === 1 ? selects[0] : null;
    const shell = source?.closest('.aic');
    shell?.querySelectorAll('.gmail-pro-sidebar-brand').forEach(node => { if (node !== compose?.brand) node.remove(); });
    // Hide only the dedicated native Compose row, never other sidebar content.
    const safe = shell && [...shell.children].filter(node => node !== compose?.brand).length === 1 && source.parentElement.children.length === 1 && geometry(ctx, compose ? 0 : 32);
    if (compose && (!safe || !select || compose.source !== source || !compose.brand.isConnected)) restoreCompose();
    if (compose && (compose.select !== select || !compose.button.isConnected)) {
      // Toolbar rebuilds replace selection controls, not the sidebar owner.
      // Move the live button rather than restoring/recreating the whole sidebar.
      ctx.actions.querySelectorAll('.gmail-pro-toolbar-compose').forEach(node => { if (node !== compose.button) node.remove(); });
      compose.select = select; select.after(compose.button);
    }
    if (compose) compose.brand.toggleAttribute('data-compact', shell.parentElement.getBoundingClientRect().width < 140);
    if (!safe || !select || compose) return;
    // Gmail/other extensions may copy toolbar markup without our listeners.
    ctx.actions.querySelectorAll('.gmail-pro-toolbar-compose').forEach(node => node.remove());
    const node = button('Compose', 'M14 4H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-9M17 3l4 4M10 14l1-4L19 2l3 3-8 8-4 1Z');
    node.className = 'gmail-pro-toolbar-compose';
    node.addEventListener('click', () => {
      if (enabled && source.isConnected) source.click();
    });
    select.after(node);
    const brand = document.createElement('button');
    brand.type = 'button'; brand.className = 'gmail-pro-sidebar-brand';
    brand.toggleAttribute('data-compact', shell.parentElement.getBoundingClientRect().width < 140);
    brand.title = 'Open Gmail Pro settings'; brand.setAttribute('aria-label', brand.title);
    brand.append(document.createTextNode('Gmail '));
    const pro = document.createElement('span'); pro.textContent = 'Pro'; brand.append(pro);
    brand.addEventListener('click', async () => {
      if (!enabled || brand.disabled) return;
      brand.disabled = true;
      try {
        const result = await chrome.runtime.sendMessage({ type: 'gmail-pro-open-settings' });
        if (!result?.ok) throw new Error('Settings unavailable');
        brand.title = 'Open Gmail Pro settings';
      } catch {
        brand.title = 'Could not open settings. Click to try again or use the extension icon.';
      } finally { brand.disabled = false; }
    });
    shell.append(brand);
    compose = { source, shell, select, button: node, brand };
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
    // Gmail may hide its menu before Escape bubbles to this handler.
    // Keep that same Escape from also dismissing the compact search field.
    if (event.defaultPrevented || event.target.closest('[role="menu"]') || nativePopupOpen()) return;
    event.preventDefault(); closeSearch();
  }

  function nativePopupOpen() {
    return current && ([...current.form.querySelectorAll(S.headerSuggestions)].some(visible) ||
      [...document.querySelectorAll(S.headerAdvancedPanel)].some(panel => visible(panel.querySelector('.ZF-zT'))) ||
      [...document.querySelectorAll('[role="menu"]')].some(visible));
  }

  function outside(event) {
    if (!open || !current || current.form.contains(event.target) || controls.contains(event.target) || searchSort?.node.contains(event.target) ||
        event.target.closest(S.headerAdvancedPanel) || nativePopupOpen()) return;
    open = false; schedule();
  }

  function clearLayoutTransition() {
    clearTimeout(layoutTransition?.timer);
    layoutTransition = undefined;
  }

  function retainLayout(next) {
    // Search removes the entire native mail view before installing its new
    // toolbar/actions. The header/search/sidebar owners persist independently.
    // Keep their last validated layout while the native mail view is absent.
    if (!current || layoutTransition?.expired || !current.form.hasAttribute('data-gp-toolbar-search') ||
        !current.shell.isConnected || !current.form.isConnected ||
        location.pathname !== current.pathname) return false;
    const banners = [...document.querySelectorAll(S.headerBanner)];
    const forms = [...current.banner.querySelectorAll(S.headerSearch)];
    const bars = [...document.querySelectorAll(S.headerToolbar)].filter(visible);
    const mains = [...document.querySelectorAll(S.main)].filter(visible);
    if (banners.length !== 1 || banners[0] !== current.banner || current.banner.closest(S.headerShell) !== current.shell ||
        forms.length !== 1 || forms[0] !== current.form || current.form.querySelector(S.headerSearchInput) !== current.input ||
        mains.length > 1 || bars.length > 1 || (bars.length === 1 && bars[0].closest(S.main) !== mains[0])) return false;
    if (bars.length === 1 && ([...bars[0].querySelectorAll('[gh="mtb"]')].filter(visible).length > 1 ||
        [...bars[0].querySelectorAll(S.pagingPager)].filter(visible).length > 1)) return false;
    if (next) {
      if (next.form !== current.form || next.shell !== current.shell) return false;
      const row = next.actionRow.getBoundingClientRect();
      // Positive but unsupported geometry (e.g. too little space) still falls
      // back immediately. Only a temporarily collapsed row gets a grace period.
      if (row.width > 0 && row.height > 0) return false;
    }
    if (!layoutTransition) {
      const pending = { expired: false };
      layoutTransition = pending;
      pending.timer = setTimeout(() => {
        if (!enabled || layoutTransition !== pending) return;
        pending.expired = true; schedule();
      }, TRANSITION_TIMEOUT);
    }
    // Watch a partially rebuilt mail view/toolbar as soon as it appears.
    // Waiting on the detached old toolbar would miss native action readiness.
    watch(next || { ...current, main: mains[0] || current.main, toolbar: bars[0] || current.toolbar });
    return true;
  }

  function restore() {
    clearLayoutTransition();
    restoreSearchSort();
    removeCaption();
    restoreCompose();
    // Gmail may clone a marked toolbar before discovery can adopt it.
    document.querySelectorAll('[gh="tm"][data-gp-header-toolbar]').forEach(restoreToolbar);
    if (!current) return;
    const wasCollapsed = current.shell.hasAttribute('data-gp-header-collapsed');
    current.shell.removeAttribute('data-gp-header-collapsed');
    current.banner.removeAttribute('data-gp-header-collapsed');
    current.form.removeAttribute('data-gp-toolbar-search');
    restoreToolbar(current.toolbar);
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
    for (const node of ctx ? [ctx.form, ctx.toolbar, ctx.shell, ctx.list, ctx.mailboxLink,
      ...document.querySelectorAll('[role="navigation"] .nM'),
      ...document.querySelectorAll('[role="navigation"] > .aic > .z0 > [gh="cm"]')].filter(Boolean) : [document.body]) {
      for (let parent = node; parent; parent = parent.parentElement) spine.add(parent);
    }
    for (const node of spine) observer.observe(node, { childList: true, attributes: true,
      attributeFilter: ['class', 'style', 'hidden', 'aria-hidden'] });
    ancestorSpine = spine;
    watchMailboxLoading(ctx);
    if (ctx) observer.observe(ctx.toolbar, { childList: true, subtree: true, characterData: true, attributes: true,
      attributeFilter: ['class', 'style', 'hidden', 'aria-hidden'] });
    if (ctx?.captionEmpty) observer.observe(ctx.captionEmpty, { childList: true, characterData: true, subtree: true });
    // Section replacement/disclosure only; never observe label rows or counts.
    if (sidebar) {
      for (const section of [sidebar.system, sidebar.labels]) {
        const inner = section.querySelector(':scope > .ajl'), box = inner?.querySelector(':scope > .wT');
        for (const node of [section, inner, box, ...(box?.children || []),
          ...(box?.querySelectorAll(':scope > .n3 > .byl, :scope > .n3 > .byl > .TK') || [])].filter(Boolean)) observer.observe(node, { childList: true });
      }
      for (const toggle of sidebar.toggles) observer.observe(toggle, { attributes: true, attributeFilter: ['aria-label'] });
      observer.observe(sidebar.header, { childList: true });
      observer.observe(sidebar.title, { childList: true, characterData: true, subtree: true });
    }
    for (const panel of document.querySelectorAll(S.headerAdvancedPanel)) observer.observe(panel,
      { childList: true, attributes: true, attributeFilter: ['class', 'style', 'hidden'] });
    const sizes = new Set(ctx ? [ctx.toolbar, ctx.actionRow, ctx.actions, ctx.pager, ctx.banner, ctx.list].filter(Boolean) : []);
    for (const node of observedSizes) if (!sizes.has(node)) resizeObserver.unobserve(node);
    for (const node of sizes) if (!observedSizes.has(node)) resizeObserver.observe(node);
    observedSizes = sizes;
  }

  function refresh() {
    observer.disconnect();
    const next = discover();
    if (!next) {
      if (retainLayout()) return;
      const previous = lastContext || current; restore(); watch(previous); return;
    }
    if (current && (current.form !== next.form || current.shell !== next.shell || current.pathname !== next.pathname)) {
      restore(); open = false;
    }
    // Validate native geometry before Compose/sidebar changes. A zero-sized
    // replacement must not tear down otherwise stable presentation owners.
    placeSearchSort(next);
    let layout = geometry(next);
    if (!layout) {
      if (retainLayout(next)) return;
      restore(); watch(next); return;
    }
    clearLayoutTransition();
    if (current && current.main !== next.main) {
      // Release only the replaced mail view's height override. Persistent
      // header/search/sidebar controls survive and rebind to the new toolbar.
      current.main.removeAttribute('data-gp-header-main');
      current.main.style.removeProperty('--gp-header-main-height');
    }
    if (current && current.toolbar !== next.toolbar) restoreToolbar(current.toolbar);
    current = next;
    placeToolbar(current);
    placeCompose(current);
    layout = geometry(current);
    if (!layout) { restore(); watch(next); return; }
    placeSidebar();
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
    const controlWidth = (layout.narrow ? BUTTON : 0) + layout.sortWidth + (layout.narrow && layout.sortWidth ? GAP : 0);
    updateSortSlot();
    if (layout.sortWidth) {
      document.documentElement.style.setProperty('--gp-search-sort-left', `${layout.right - BUTTON}px`);
      document.documentElement.style.setProperty('--gp-search-sort-top', `${layout.top + 2}px`);
    }
    controls.dataset.narrow = String(layout.narrow);
    controls.style.left = `${layout.right - controlWidth}px`;
    controls.style.top = `${layout.top + 2}px`;
    controls.style.setProperty('--gp-header-toggle-left', `${layout.toggleLeft}px`);
    controls.style.setProperty('--gp-header-toggle-top', `${layout.top + 2}px`);
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
    updateCaption(current);
    reconcileMailboxLoading(current);
    watch(current);
  }

  function navigate() {
    if (mailboxLoading && mailboxKey(location.hash) !== mailboxLoading.key) clearMailboxLoading();
    open = false; schedule();
  }

  function stop() {
    enabled = false; generation++; saving = false; open = false;
    clearMailboxLoading();
    cancelAnimationFrame(frame); frame = 0;
    clearTimeout(bootstrapTimer); bootstrap?.disconnect(); bootstrap = undefined;
    observer?.disconnect(); resizeObserver?.disconnect(); observedSizes.clear();
    ancestorSpine.clear(); lastContext = undefined; countSnapshot = undefined;
    window.removeEventListener('resize', schedule);
    window.removeEventListener('hashchange', navigate);
    window.removeEventListener('popstate', navigate);
    document.removeEventListener('focusin', focusChanged);
    document.removeEventListener('keydown', keydown);
    document.removeEventListener('pointerdown', outside, true);
    document.removeEventListener('click', mailboxClicked, true);
    restore(); controls?.remove(); controls = undefined; sortSlot = undefined;
  }

  function update(patch = {}) {
    if (Object.hasOwn(patch, 'headerCollapsed')) collapsed = patch.headerCollapsed === true;
    if (Object.hasOwn(patch, 'appleMailModeEnabled') && !patch.appleMailModeEnabled) return stop();
    if (!enabled && patch.appleMailModeEnabled) {
      enabled = true; generation++;
      observer = new MutationObserver(records => {
        if (mailboxLoading) {
          const state = mailboxLoading;
          state.sawBusy ||= nativeMailboxBusy(current?.list);
          for (const record of records) {
            if (['childList', 'characterData'].includes(record.type) &&
                [state.before.range, state.before.empty, current?.captionRange, current?.captionEmpty].some(node => node?.contains(record.target))) state.committed = true;
            // Cached views can start and end native loading within one batch.
            if (record.attributeName === 'style' && record.target.matches('.zchc9b') && record.oldValue !== null &&
                !/display\s*:\s*none/.test(record.oldValue)) state.sawBusy = true;
          }
        }
        if (records.some(record => current?.captionRange?.contains(record.target) || current?.captionEmpty?.contains(record.target))) countSnapshot = undefined;
        schedule();
      });
      resizeObserver = new ResizeObserver(schedule);
      window.addEventListener('resize', schedule);
      window.addEventListener('hashchange', navigate);
      window.addEventListener('popstate', navigate);
      document.addEventListener('focusin', focusChanged);
      document.addEventListener('keydown', keydown);
      document.addEventListener('pointerdown', outside, true);
      document.addEventListener('click', mailboxClicked, true);
      // Bounded initial shell discovery; ongoing watches only cover chrome and
      // shallow ancestor/section replacement. During a pending mailbox switch,
      // temporarily observe native list readiness without inspecting email HTML.
      bootstrap = new MutationObserver(schedule);
      bootstrap.observe(document, { childList: true, subtree: true });
      bootstrapTimer = setTimeout(() => { bootstrap?.disconnect(); bootstrap = undefined; }, 10000);
    }
    if (enabled) schedule();
  }
  app.headerLayout = Object.freeze({ start: update, update, stop });
})();
