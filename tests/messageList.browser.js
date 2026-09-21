/* Synthetic content only. Tests production formatting, CSS and lifecycle. */
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
  let observerDeliveries = 0;
  const activeObservers = new Set();
  const NativeObserver = window.MutationObserver;
  window.MutationObserver = class extends NativeObserver {
    constructor(callback) {
      const owned = /content\/messageList\.js/.test(new Error().stack);
      super(records => {
        // Other installed extensions can add nodes outside the fixture. Measure
        // deliveries inside the list, where our writes must never feed back.
        if (owned && records.some(record => record.target instanceof Element && record.target.closest('#workspace'))) observerDeliveries++;
        callback(records);
      });
      this.owned = owned;
      if (owned) observerCreations++;
    }
    observe(...args) { if (this.owned) activeObservers.add(this); super.observe(...args); }
    disconnect() { activeObservers.delete(this); super.disconnect(); }
  };

  const NativeDate = window.Date;
  let now = new NativeDate(2026, 8, 21, 13, 45).getTime();
  window.Date = class extends NativeDate {
    constructor(...args) { super(...(args.length ? args : [now])); }
    static now() { return now; }
  };
  const nativeSetTimeout = window.setTimeout, nativeClearTimeout = window.clearTimeout;
  const timers = new Map();
  let timerId = -1;
  window.setTimeout = (fn, delay, ...args) => {
    if (!/content\/messageList\.js/.test(new Error().stack)) return nativeSetTimeout(fn, delay, ...args);
    const id = timerId--; timers.set(id, { fn, delay }); return id;
  };
  window.clearTimeout = id => { if (!timers.delete(id)) nativeClearTimeout(id); };
  const clock = (...args) => { now = new NativeDate(...args).getTime(); };
  const formatted = node => node.querySelector('.xW > span').getAttribute('data-gmail-pro-date');

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
    document.documentElement.classList.remove("gmail-pro-apple-mail-mode");
    clock(2026, 8, 21, 13, 45);
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
    assert(rect(node.querySelector(".y6")).right < rect(node.querySelector(".yi")).left, "label follows subject with a gap");
    assert(Math.abs(rect(node.querySelector(".at")).right - rect(node.querySelector(".xT")).right) < 1, "label right aligned");
    assert(node.querySelector(".sender").textContent === "Alex, Morgan 3", "native conversation sender string retained");
  });
  await test("long labels leave space for subject in a narrow pane", () => {
    workspace().style.width = "380px";
    const node = row({ label: "Projects/A very long user-created label ".repeat(5) }); enable();
    assert(rect(node.querySelector(".yi")).width <= rect(node.querySelector(".xT")).width * 0.45 + 1, "label width bounded");
    assert(rect(node.querySelector(".bog")).width > 80, "subject remains readable");
    assert(Math.abs(rect(node.querySelector(".yi")).right - rect(node.querySelector(".xT")).right) < 1, "long label right aligned");
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
  await test("SPA insertion, staged rendering, removal, main replacement and Back/Forward", async () => {
    enable(); const node = row(); await frame(); geometry(node);
    assert(formatted(node) === 'Mon, 9/14/26, 1:31 PM', 'inserted row formatted');
    const subject = node.querySelector("[data-thread-id]"); subject.removeAttribute("data-thread-id");
    assert(css(node).display === "flex", "incomplete structural gate fails closed");
    await frame(); assert(formatted(node) === null, 'incomplete row restored');
    subject.setAttribute("data-thread-id", "synthetic"); await frame(); geometry(node);
    assert(formatted(node), 'late thread metadata formats row');
    const pane = document.createElement("div"); pane.id = "workspace"; pane.setAttribute("role", "main"); workspace().replaceWith(pane);
    const next = row(); window.dispatchEvent(new PopStateEvent("popstate")); window.dispatchEvent(new HashChangeEvent("hashchange"));
    await frame(); geometry(next); assert(formatted(next), 'replacement main formatted');
    next.remove(); pane.append(node.closest("table")); await frame(); geometry(node);
    assert(formatted(node), 'cached row reinserted and formatted');
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
  await test("bounded mutation work, no feedback loop, idempotent enable and complete cleanup", async () => {
    const node = row();
    enable(); enable(); feature.update({ autoBccEnabled: true, newestEmailFirstEnabled: true });
    const count = observerCreations;
    enable(); assert(observerCreations === count, 'repeat enable does not add observers');
    for (let i = 0; i < 100; i++) {
      const next = row({ subject: `Synthetic ${i}` });
      const table = next.closest('table'); node.parentElement.append(next); table.remove();
    }
    await frame(); await frame();
    assert(node.parentElement.querySelectorAll('[data-gmail-pro-date]').length === 101, 'all loaded rows formatted');
    assert(activeObservers.size === 3, 'two discovery observers and one loaded grid observer');
    const delivered = observerDeliveries;
    await frame(); await frame();
    assert(observerDeliveries === delivered, 'idle list and owned attributes do not feed observers');
    assert(css(node).display === "grid", "unrelated preferences leave layout enabled");
    feature.stop(); feature.stop(); assert(css(node).display === "flex", "idempotent cleanup");
    assert(activeObservers.size === 0 && timers.size === 0, 'all observers and timers released');
    assert(!workspace().querySelector('[data-gmail-pro-date]'), 'all owned date attributes removed');
  });
  for (const [name, current, title, expected] of [
    ['today', [2026,8,21,13,45], 'Mon, Sep 21, 2026, 1:31\u202fPM', 'Today, 1:31 PM'],
    ['yesterday', [2026,8,21,0,1], 'Sun, Sep 20, 2026, 11:59 PM', 'Yesterday, 11:59 PM'],
    ['September eighth', [2026,8,21], 'Tue, Sep 8, 2026, 1:31 PM', 'Tue, 9/8/26, 1:31 PM'],
    ['older date without month/day padding', [2026,8,21], 'Tue, Sep 1, 2026, 01:06 AM', 'Tue, 9/1/26, 1:06 AM'],
    ['midnight', [2026,8,21,13], 'Mon, Sep 21, 2026, 12:00 AM', 'Today, 12:00 AM'],
    ['noon', [2026,8,21,13], 'Mon, Sep 21, 2026, 12:00 PM', 'Today, 12:00 PM'],
    ['year boundary', [2027,0,1,1], 'Thu, Dec 31, 2026, 11:59 PM', 'Yesterday, 11:59 PM'],
    ['leap day', [2024,2,1,1], 'Thu, Feb 29, 2024, 4:05 AM', 'Yesterday, 4:05 AM'],
    ['month boundary', [2026,8,1], 'Mon, Aug 31, 2026, 6:47 PM', 'Yesterday, 6:47 PM'],
    ['spring DST calendar yesterday', [2026,2,9,0,30], 'Sun, Mar 8, 2026, 12:01 AM', 'Yesterday, 12:01 AM'],
    ['fall DST calendar today', [2026,10,1,23,30], 'Sun, Nov 1, 2026, 12:01 AM', 'Today, 12:01 AM'],
    ['fall DST calendar yesterday', [2026,10,2,0,30], 'Sun, Nov 1, 2026, 12:01 AM', 'Yesterday, 12:01 AM'],
    ['future date', [2026,8,21], 'Tue, Sep 22, 2026, 1:31 PM', 'Tue, 9/22/26, 1:31 PM']
  ]) await test(`date format: ${name}`, () => {
    clock(...current); const node = row({dateTitle:title}); const date = node.querySelector('.xW > span');
    enable();
    assert(formatted(node) === expected, `expected ${expected}, got ${formatted(node)}`);
    assert(getComputedStyle(date, '::after').content === JSON.stringify(expected), 'visible pseudo-element has exact date');
    assert(date.title === title && date.getAttribute('aria-label') === title && date.firstElementChild.textContent === 'Sep 14', 'native tooltip, accessible name and text unchanged');
    assert(css(date.firstElementChild).display === 'none', 'only native display hidden');
  });
  await test('malformed, unsupported and missing dates retain native display', () => {
    for (const title of ['', 'Synthetic date', 'Mon, Sep 31, 2026, 1:31 PM', 'Mon, Feb 29, 2026, 1:31 PM',
      'Mon, Sep 21, 2026, 0:31 PM', 'Mon, Sep 21, 2026, 13:31 PM', 'Mon, Sep 21, 2026, 1:60 PM',
      'Tue, Sep 21, 2026, 1:31 PM', 'Lun, Sep 21, 2026, 1:31 PM', 'Mon, Sep 21, 2026, 13:31']) {
      const node = row({dateTitle:title}); enable();
      window.dispatchEvent(new HashChangeEvent('hashchange'));
      assert(formatted(node) === null && css(node.querySelector('.xW > span > span')).display !== 'none', 'unknown input stays native');
    }
    const direct = row(); direct.querySelector('.xW > span').textContent = 'Sep 14';
    const missing = row(); missing.querySelector('.xW > span').removeAttribute('title');
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    assert(formatted(direct) === null && formatted(missing) === null, 'unknown structure and missing title stay native');
  });
  await test('either mode formats dates and disabling both reveals the latest native text', async () => {
    const node = row(); const date = node.querySelector('.xW > span');
    feature.start({appleMailModeEnabled:true});
    assert(formatted(node) && !document.documentElement.classList.contains('gmail-pro-message-list'), 'Apple Mail alone formats without changing standalone preference');
    feature.update({appleMailMessageListEnabled:true}); feature.update({appleMailModeEnabled:false});
    assert(formatted(node), 'standalone stays active');
    date.firstElementChild.textContent = 'New Gmail text';
    date.title = 'Mon, Sep 21, 2026, 2:08 PM';
    node.querySelector('[data-thread-id]').setAttribute('data-thread-id', 'reused-thread');
    await frame(); assert(formatted(node) === 'Today, 2:08 PM', 'reused row reads new title');
    feature.update({appleMailMessageListEnabled:false});
    assert(formatted(node) === null && date.textContent === 'New Gmail text', 'latest native text revealed');
  });
  await test('invalidated metadata and replaced spans never leave stale formatted dates', async () => {
    const node = row(); enable(); const old = node.querySelector('.xW > span');
    old.title = 'Unsupported'; await frame(); assert(formatted(node) === null, 'invalid title clears old overlay');
    old.title = 'Sun, Sep 20, 2026, 2:08 AM'; await frame(); assert(formatted(node) === 'Yesterday, 2:08 AM', 'valid metadata recovered');
    const next = old.cloneNode(true); next.removeAttribute('data-gmail-pro-date'); next.title = 'Mon, Sep 21, 2026, 3:09 PM'; old.replaceWith(next);
    await frame(); assert(formatted(node) === 'Today, 3:09 PM' && !old.hasAttribute('data-gmail-pro-date'), 'replaced span released');
    node.closest('table').remove(); await frame(); assert(!next.hasAttribute('data-gmail-pro-date'), 'detached row released');
  });
  await test('deeply staged main replacement works without a navigation event', async () => {
    const first = row(); enable(); const original = workspace(); original.remove();
    await frame(); assert(formatted(first) === null, 'old page dates restored');
    const wrapper = document.createElement('div'); document.body.append(wrapper); await frame();
    const inner = document.createElement('div'); wrapper.append(inner); await frame();
    const main = document.createElement('div'); main.id = 'workspace'; inner.append(main); await frame();
    main.setAttribute('role', 'main'); await frame();
    const next = row(); await frame(); assert(formatted(next), 'late main and table discovered');
    document.body.append(main); wrapper.remove(); await frame();
  });
  await test('removed title and staged native grid roles clear and recover the overlay', async () => {
    const node = row(); const table = node.closest('table'), date = node.querySelector('.xW > span'); enable();
    date.removeAttribute('title'); await frame(); assert(formatted(node) === null, 'removed source restores native text');
    date.title = 'Mon, Sep 14, 2026, 1:31 PM'; await frame(); assert(formatted(node), 'restored title recovers');
    table.removeAttribute('role'); await frame(); assert(formatted(node) === null, 'invalidated grid restored');
    table.setAttribute('role', 'grid'); await frame(); assert(formatted(node), 'restored grid rediscovered');
    node.querySelector('.yX').classList.remove('yX'); await frame(); assert(formatted(node) === null, 'unknown cell structure restored');
    node.querySelector('td:has(.yW)').classList.add('yX'); await frame(); assert(formatted(node), 'late sender class recovers');
  });
  await test('midnight timer and return-to-tab refresh use the current local calendar', () => {
    clock(2026,8,21,23,59,59); const node = row({dateTitle:'Mon, Sep 21, 2026, 1:31 PM'}); enable();
    assert(timers.size === 1, 'one midnight timer');
    const [id, timer] = [...timers][0]; assert(timer.delay === 1050, 'scheduled just after next local midnight');
    clock(2026,8,22,0,0,0,50); timers.delete(id); timer.fn();
    assert(formatted(node) === 'Yesterday, 1:31 PM' && timers.size === 1, 'midnight refresh and single rearm');
    clock(2026,8,23,9); window.dispatchEvent(new Event('focus'));
    assert(formatted(node) === 'Mon, 9/21/26, 1:31 PM', 'wake from sleep refreshes');
    clock(2026,8,21,15); document.dispatchEvent(new Event('visibilitychange'));
    assert(formatted(node) === 'Today, 1:31 PM', 'visibility return refreshes current date');
    feature.stop(); clock(2026,8,22); window.dispatchEvent(new Event('focus'));
    assert(formatted(node) === null && timers.size === 0, 'stopped feature stays stopped');
  });
  await test('normal dates use exact gray while selected dates retain native color', () => {
    const node = row(); const date = node.querySelector('.xW > span');
    node.classList.add('aps'); const original = css(date).color; node.classList.remove('aps'); enable();
    assert(css(date).color === 'rgb(156, 158, 160)', 'requested gray');
    node.classList.add('aps'); assert(css(date).color === original, 'native open-row foreground');
    node.classList.remove('aps'); node.querySelector('[role="checkbox"]').setAttribute('aria-checked','true');
    assert(css(date).color === original, 'native checked-row foreground');
  });
  window.MutationObserver = NativeObserver;
  window.Date = NativeDate; window.setTimeout = nativeSetTimeout; window.clearTimeout = nativeClearTimeout;
  const failures = reports.filter(line => line.startsWith("FAIL")).length;
  result.textContent = `${reports.join("\n")}\n\n${reports.length - failures}/${reports.length} checks passed.`;
  result.dataset.failures = String(failures);
})();
