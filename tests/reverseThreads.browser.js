/* Real DOM/layout tests. All content and addresses below are synthetic. */
(async () => {
  "use strict";
  const app = GmailPro;
  app.messageList.start({ appleMailMessageListEnabled: true });
  const result = document.getElementById("results");
  const reports = [];
  const events = [];
  const NativeObserver = window.MutationObserver;
  const observers = new Set();
  let deliveries = 0;
  window.MutationObserver = class extends NativeObserver {
    constructor(callback) {
      // Browser tooling can create its own page observers. Count only observers
      // constructed by the extension modules under test, not the test driver.
      const owned = /content\/(reverseThreads|autoBcc)\.js/.test(new Error().stack);
      super((...args) => { if (owned) deliveries++; callback(...args); });
      this.owned = owned;
    }
    observe(...args) { if (this.owned) observers.add(this); return super.observe(...args); }
    disconnect() { observers.delete(this); return super.disconnect(); }
  };
  app.debug = Object.freeze({ log: code => events.push(code) });
  const settle = () => new Promise(resolve => setTimeout(resolve, 300));
  const assert = (ok, message) => { if (!ok) throw new Error(message); };
  const el = (tag, attrs = {}) => {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
    return node;
  };
  const main = () => document.getElementById("workspace");
  function item(index, placeholder = false) {
    const node = el("div", { tabindex: "-1", jsaction: "syntheticAction:.CLIENT" });
    if (!placeholder) {
      node.setAttribute("role", "listitem"); node.setAttribute("aria-expanded", "false");
    }
    node.dataset.testIndex = String(index);
    const envelope = el("div");
    const body = el("div", { "data-message-id": `synthetic-${index}`, "data-legacy-message-id": `legacy-${index}` });
    body.textContent = `Synthetic message ${index}`;
    envelope.append(body); node.append(envelope);
    return node;
  }
  function thread(count = 3, placeholders = [], mount = main()) {
    const shell = el("section");
    const heading = el("h2", { "data-thread-perm-id": "synthetic-thread", "data-legacy-thread-id": "legacy-thread" });
    heading.textContent = "Synthetic subject";
    const toolbar = el("div", { role: "toolbar" }); toolbar.textContent = "Synthetic toolbar";
    const holder = el("div");
    const list = el("div", { role: "list" });
    const nodes = Array.from({ length: count }, (_, i) => item(i, placeholders.includes(i)));
    list.append(...nodes); holder.append(list); shell.append(heading, toolbar, holder); mount.append(shell);
    return { shell, heading, toolbar, holder, list, nodes };
  }
  const isReversed = node => node.hasAttribute("data-gmail-pro-thread-order");
  const enable = () => app.reverseThreads.start({ newestEmailFirstEnabled: true });
  const reverseCount = () => events.filter(code => code === "thread-reordered").length;
  const visual = list => [...list.children].filter(n => n.getBoundingClientRect().height > 0)
    .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
  const matches = (actual, expected) => actual.length === expected.length && actual.every((n, i) => n === expected[i]);
  async function test(name, run) {
    try { await run(); reports.push(`PASS ${name}`); }
    catch (error) { reports.push(`FAIL ${name}: ${error.message}`); }
    app.reverseThreads.stop(); app.autoBcc.stop();
    if (observers.size) reports.push(`FAIL ${name}: observers remain after stop`);
    main().replaceChildren(); events.length = 0;
    result.textContent = reports.join("\n");
  }

  await test("disabled performs no observation or writes", async () => {
    const t = thread(); app.reverseThreads.start({ newestEmailFirstEnabled: false }); await settle();
    assert(observers.size === 0 && !isReversed(t.list), "disabled stays inert");
  });
  for (const count of [1, 2, 3, 25, 500]) await test(`${count} message conversation`, async () => {
    const t = thread(count); const subjectParent = t.heading.parentNode; enable(); await settle();
    assert(matches([...t.list.children], t.nodes), "native DOM order unchanged");
    assert(matches(visual(t.list), t.nodes.slice().reverse()), "visual order newest first");
    assert(t.heading.parentNode === subjectParent && !t.heading.hasAttribute("style") && !t.toolbar.hasAttribute("style"), "header and toolbar untouched");
    if (count === 1) assert(!isReversed(t.list), "one message needs no layout change");
  });
  await test("off restores exact original inline styles and DOM sequence", async () => {
    const t = thread(); t.list.style.margin = "3px"; t.nodes[0].style.color = "red";
    const before = [t.list, ...t.nodes].map(n => n.getAttribute("style"));
    enable(); await settle(); app.reverseThreads.update({ newestEmailFirstEnabled: false });
    assert(matches([...t.list.children], t.nodes), "same nodes in original order");
    assert([t.list, ...t.nodes].every((n, i) => n.getAttribute("style") === before[i]), "original styles restored");
    assert(matches(visual(t.list), t.nodes), "normal visual order restored immediately");
    enable(); await settle(); assert(matches(visual(t.list), t.nodes.slice().reverse()), "on again");
  });
  await test("fixed controls retain their original slots", async () => {
    const t = thread(); const control = el("button"); control.textContent = "Thread action";
    t.nodes[1].before(control); enable(); await settle();
    assert(matches(visual(t.list), [t.nodes[2], control, t.nodes[1], t.nodes[0]]), "only message slots reversed");
    assert(control.nextSibling === t.nodes[1], "control never moved in DOM");
  });
  await test("collapsed older slots expand without order changes or loops", async () => {
    const t = thread(10, [1, 2, 3, 4, 5, 6, 7]);
    for (const i of [1, 3, 4, 5, 6, 7]) t.nodes[i].style.display = "none";
    enable(); await settle(); assert(matches(visual(t.list), [t.nodes[9], t.nodes[8], t.nodes[2], t.nodes[0]]), "group stays between newer and older messages");
    const count = reverseCount();
    for (const n of t.nodes) { n.style.removeProperty("display"); n.setAttribute("role", "listitem"); }
    await settle(); assert(matches(visual(t.list), t.nodes.slice().reverse()), "revealed summaries without aria-expanded stay newest first");
    assert(matches([...t.list.children], t.nodes), "revealing never moves Gmail DOM nodes");
    for (const n of t.nodes) n.setAttribute("aria-expanded", "true");
    await settle(); assert(matches(visual(t.list), t.nodes.slice().reverse()), "expanded slots in correct order");
    assert(reverseCount() === count, "expansion needs no second reorder");
  });
  await test("already revealed summaries validate without weakening unknown-state checks", async () => {
    const t = thread(); t.nodes[0].removeAttribute('aria-expanded'); enable(); await settle();
    assert(matches(visual(t.list), t.nodes.slice().reverse()), 'reload with revealed summaries');
    t.nodes[0].setAttribute('aria-expanded','unknown'); await settle();
    assert(!isReversed(t.list), 'invalid explicit state still fails closed');
    t.nodes[0].removeAttribute('aria-expanded'); await settle();
    assert(matches(visual(t.list), t.nodes.slice().reverse()), 'valid summaries recover');
    t.nodes.forEach(n=>n.removeAttribute('aria-expanded')); await settle();
    assert(!isReversed(t.list), 'unknown list without identified message stays native');
  });
  await test("expand/collapse handlers and attachment ownership survive", async () => {
    const t = thread(); let clicked = 0;
    const button = el("button"); button.textContent = "Expand";
    button.addEventListener("click", () => { clicked++; t.nodes[1].setAttribute("aria-expanded", String(clicked % 2 === 1)); });
    const attachment = el("a", { href: "#synthetic-attachment" }); attachment.textContent = "Synthetic attachment";
    t.nodes[1].firstElementChild.append(button, attachment); enable(); await settle();
    button.click(); await settle(); button.click(); await settle();
    assert(clicked === 2 && t.nodes[1].contains(attachment), "controls and attachment remain with their message");
    assert(reverseCount() === 1, "no unnecessary reorders");
  });
  await test("dynamic appended and removed messages reconcile native order", async () => {
    const t = thread(); enable(); await settle(); const next = item(3); t.list.append(next); await settle();
    assert(visual(t.list)[0] === next, "newly appended native message on top");
    t.nodes[1].remove(); await settle();
    assert(!t.nodes[1].hasAttribute("style"), "detached message styles released");
    assert(matches(visual(t.list), [next, t.nodes[2], t.nodes[0]]), "removed message absent");
    app.reverseThreads.stop(); assert(matches(visual(t.list), [t.nodes[0], t.nodes[2], next]), "updated native order restored");
  });
  await test("empty list rendered in stages is discovered", async () => {
    const t = thread(0); enable(); await settle(); t.list.append(item(0), item(1)); await settle();
    assert(visual(t.list)[0].dataset.testIndex === "1", "late list items handled");
  });
  await test("Gmail replacing an expanded message wrapper is handled", async () => {
    const t = thread(); enable(); await settle(); const replacement = item(2); t.nodes[2].replaceWith(replacement); await settle();
    assert(visual(t.list)[0] === replacement && !t.nodes[2].hasAttribute("style"), "new wrapper ordered; old wrapper released");
  });
  await test("unknown child fails closed and can recover", async () => {
    const t = thread(); enable(); await settle(); const unknown = el("div"); t.list.append(unknown); await settle();
    assert(!isReversed(t.list), "unknown layout restored, not guessed");
    unknown.remove(); await settle(); assert(visual(t.list)[0] === t.nodes[2], "known layout recovers");
  });
  await test("unrelated lists and body-embedded lookalikes remain untouched", async () => {
    const t = thread(); const nested = el("div", { role: "list" }); nested.append(item(5), item(6));
    t.nodes[0].querySelector('[data-message-id]').append(nested);
    const outside = el("div", { role: "list" }); outside.append(item(7), item(8)); document.body.append(outside);
    enable(); await settle(); assert(!isReversed(nested) && !isReversed(outside), "only actual conversation list styled"); outside.remove();
  });
  await test("message body mutation bursts do not wake ordering observer", async () => {
    const t = thread(); enable(); await settle(); const before = deliveries; const count = reverseCount();
    const body = t.nodes[2].querySelector('[data-message-id]');
    for (let i = 0; i < 200; i++) body.append(el("span"));
    await settle(); assert(deliveries === before && reverseCount() === count, "no body observer or repeated work");
  });
  await test("idle produces no observer callbacks or style mutations", async () => {
    thread(); enable(); await settle(); const before = deliveries; await settle();
    assert(deliveries === before, "no self-triggered observer cycle");
  });
  await test("start/stop and unrelated settings updates are idempotent", async () => {
    const t = thread(); enable(); enable(); await settle(); const count = observers.size;
    app.reverseThreads.update({ autoBccEnabled: false }); enable(); await settle();
    assert(observers.size === count && reverseCount() === 1, "one observer owner");
    app.reverseThreads.stop(); app.reverseThreads.stop(); assert(!isReversed(t.list) && !observers.size, "complete cleanup");
  });
  await test("Gmail style changes are preserved instead of fought", async () => {
    const t = thread(); enable(); await settle(); t.nodes[0].style.color = "blue"; await settle();
    assert(reverseCount() === 1, "unrelated style changes do not reorder");
    t.nodes[0].style.setProperty("order", "99"); await settle();
    assert(t.nodes[0].style.order === "99" && !isReversed(t.list), "conflicting owner retained and reversal released");
    assert(t.nodes[0].style.color === "blue", "unrelated styles retained");
  });
  await test("already reordered external layout is left alone", async () => {
    const t = thread(); t.list.style.display = "flex"; t.list.style.flexDirection = "column-reverse";
    enable(); await settle(); assert(reverseCount() === 0 && t.list.style.flexDirection === "column-reverse", "no competing reversal");
  });
  await test("switch thread, Inbox removal, same thread reopening", async () => {
    const t = thread(); enable(); await settle(); t.shell.remove(); const next = thread(2); await settle();
    assert(!isReversed(t.list) && visual(next.list)[0] === next.nodes[1], "switch reconciles old/new lists");
    next.shell.remove(); await settle(); assert(!isReversed(next.list), "Inbox cleanup");
    main().append(t.shell); await settle(); assert(visual(t.list)[0] === t.nodes[2], "cached thread rediscovered");
  });
  await test("hash/popstate navigation and replacement main pane", async () => {
    thread(); enable(); await settle();
    const next = el("div", { role: "main", id: "workspace" }); main().replaceWith(next);
    const t = thread(2); window.dispatchEvent(new PopStateEvent("popstate")); await settle();
    assert(visual(t.list)[0] === t.nodes[1], "Back/Forward navigation event discovers replacement");
    window.dispatchEvent(new HashChangeEvent("hashchange")); await settle(); assert(reverseCount() === 2, "hash navigation does not repeat styles");
  });
  await test("disabling before pending work cancels all writes", async () => {
    const t = thread(); enable(); app.reverseThreads.stop(); await settle(); assert(!isReversed(t.list) && !observers.size, "pending work cancelled");
  });
  function composeIn(node) {
    const region = el("section", { role: "region" }); const form = el("form"); form.addEventListener("submit", e => e.preventDefault());
    const marker = el("input", { type: "hidden", name: "composeid" }); const recipients = el("div", { role: "listbox" });
    const input = el("input", { role: "combobox", "aria-label": "BCC recipients" }); recipients.append(input); form.append(marker, recipients);
    const editor = el("div", { contenteditable: "true" }); editor.textContent = "Synthetic reply"; region.append(form, editor); node.firstElementChild.append(region);
    let attempts = 0;
    input.addEventListener("keydown", event => {
      if (event.key !== "Enter") return; event.preventDefault(); attempts++;
      const chip = el("div", { role: "option", "data-hovercard-id": input.value }); recipients.prepend(chip); input.value = "";
    });
    editor.focus();
    return { region, editor, recipients, get attempts() { return attempts; } };
  }
  for (const mode of ["Reply", "Reply all", "Forward"]) await test(`${mode} with Auto BCC enabled simultaneously`, async () => {
    const t = thread(); enable(); app.autoBcc.start({ autoBccEnabled: true, bccAddress: "archive@example.com" }); await settle();
    const composer = composeIn(t.nodes[2]); await settle();
    assert(composer.attempts === 1 && composer.recipients.querySelectorAll('[role="option"]').length === 1, "one BCC inserted");
    app.reverseThreads.update({ newestEmailFirstEnabled: false }); enable(); await settle();
    assert(composer.attempts === 1 && t.nodes[2].contains(composer.region), "composer identity and BCC preserved across toggles");
    assert(document.activeElement === composer.editor, "editor focus preserved");
  });
  await test("Auto BCC disabled while thread ordering stays enabled", async () => {
    const t = thread(); enable(); app.autoBcc.start({ autoBccEnabled: false }); await settle();
    const composer = composeIn(t.nodes[2]); await settle();
    assert(composer.attempts === 0 && visual(t.list)[0] === t.nodes[2], "independent settings");
  });
  const frame = () => new Promise(resolve => requestAnimationFrame(resolve));
  await test("fully read conversation keeps newest first through collapse and setting changes", async () => {
    const t = thread();
    // Read/collapsed Gmail headers have no loaded message body or message IDs.
    for (const node of t.nodes.slice(0, 2)) node.firstElementChild.textContent = "Read message header";
    t.nodes[2].setAttribute("aria-expanded", "true");
    const unsubscribe = app.reverseThreads.subscribeConversation(() => {});
    try {
      enable(); await frame();
      assert(matches(visual(t.list), t.nodes.slice().reverse()), "latest expanded read email on top");
      t.nodes[2].setAttribute("aria-expanded", "false"); await frame();
      assert(matches(visual(t.list), t.nodes.slice().reverse()), "all collapsed still newest first");
      app.reverseThreads.update({ newestEmailFirstEnabled: false });
      assert(matches(visual(t.list), t.nodes), "off restores native order while zoom discovery stays subscribed");
      t.nodes[0].setAttribute("aria-expanded", "true"); await frame();
      assert(matches(visual(t.list), t.nodes), "expanding while off does not reorder");
      enable(); await frame();
      assert(matches(visual(t.list), t.nodes.slice().reverse()), "on again reverses exactly once");
    } finally { unsubscribe(); }
  });
  await test("late heading metadata discovers an already populated read conversation", async () => {
    enable(); const t = thread();
    t.heading.removeAttribute("data-thread-perm-id"); t.heading.removeAttribute("data-legacy-thread-id");
    await frame(); assert(!isReversed(t.list), "incomplete heading is not trusted");
    t.heading.setAttribute("data-thread-perm-id", "synthetic-late");
    t.heading.setAttribute("data-legacy-thread-id", "legacy-late"); await frame();
    assert(matches(visual(t.list), t.nodes.slice().reverse()), "heading attributes complete discovery");
  });
  await test("late list role discovers an already populated read conversation", async () => {
    enable(); const t = thread(); t.list.removeAttribute("role"); await frame();
    assert(!isReversed(t.list), "incomplete list is not trusted");
    t.list.setAttribute("role", "list"); await frame();
    assert(matches(visual(t.list), t.nodes.slice().reverse()), "list role completes discovery");
  });
  await test("slow reading pane construction is discovered after five seconds", async () => {
    enable(); const outer = el("section"), inner = el("div"); outer.append(inner); main().append(outer);
    await new Promise(resolve => setTimeout(resolve, 5100));
    const t = thread(3, [], inner); await frame();
    assert(matches(visual(t.list), t.nodes.slice().reverse()), "late nested pane is ordered without another navigation");
  });
  await test("pane replacement without navigation re-arms discovery", async () => {
    const outer = el("section"), inner = el("div"); outer.append(inner); main().append(outer);
    const first = thread(3, [], inner); enable(); await frame();
    first.shell.remove(); await frame();
    const next = thread(3, [], inner); await frame();
    assert(matches(visual(next.list), next.nodes.slice().reverse()), "deep replacement is discovered without click or hash change");
  });
  await test("disabling during staged discovery prevents late ordering", async () => {
    enable(); const t = thread(); t.heading.removeAttribute("data-thread-perm-id"); await frame();
    app.reverseThreads.stop(); t.heading.setAttribute("data-thread-perm-id", "synthetic-late"); await frame();
    assert(matches(visual(t.list), t.nodes) && !isReversed(t.list), "late metadata cannot reactivate disabled ordering");
    assert(!observers.size, "pending discovery fully disconnected");
  });
  await test("reused list recovers when its replacement heading gets metadata later", async () => {
    const t = thread(); enable(); await frame();
    const heading = el("h2"); heading.textContent = "Replacement subject";
    t.heading.replaceWith(heading); await frame();
    assert(!isReversed(t.list), "missing heading metadata releases ordering");
    heading.setAttribute("data-thread-perm-id", "replacement-thread");
    heading.setAttribute("data-legacy-thread-id", "replacement-legacy"); await frame();
    assert(matches(visual(t.list), t.nodes.slice().reverse()), "reused list revalidated on late metadata");
  });
  await test("first rendered frame of a newly inserted thread is newest-first", async () => {
    enable(); await settle();
    const t = thread(3);
    const start = performance.now();
    let wrongFrames = 0;
    for (let i = 0; i < 15; i++) {
      await frame();
      if (visual(t.list)[0] !== t.nodes[2]) wrongFrames++;
    }
    result.dataset.firstPaint = JSON.stringify({ wrongFrames, sampledFrames: 15, sampleMs: Math.round(performance.now() - start) });
    assert(wrongFrames === 0, `${wrongFrames} frames showed native ordering before reversal`);
  });
  await test("pure message lists use one CSS marker and no per-message style writes", async () => {
    const t = thread(25); enable(); await frame();
    assert(t.list.getAttribute("data-gmail-pro-thread-order") === "reverse", "CSS reverse mode selected");
    assert(getComputedStyle(t.list).flexDirection === "column-reverse", "manifest stylesheet active");
    assert(t.nodes.every(node => !node.hasAttribute("style")), "message nodes untouched");
    const next = item(25); t.list.append(next);
    assert(visual(t.list)[0] === next, "CSS orders a new message even before observer delivery");
    await frame(); assert(reverseCount() === 1, "no new ordering pass for appended message");
  });
  await test("first frame handles repeated short/long thread switches and navigation events", async () => {
    enable(); await frame();
    for (const count of [2, 25, 3, 500, 10, 2]) {
      main().replaceChildren();
      window.dispatchEvent(new PopStateEvent("popstate"));
      const t = thread(count); await frame();
      assert(visual(t.list)[0] === t.nodes[count - 1], `first frame correct for ${count} messages`);
      main().replaceChildren(); await frame();
      assert(!isReversed(t.list), "detached marker removed");
    }
  });
  await test("late heading and staged envelope structure are correct at first supported frame", async () => {
    enable(); const t = thread(0); t.heading.remove(); await frame();
    t.list.append(item(0), item(1)); await frame();
    assert(!isReversed(t.list), "unverified list left alone");
    t.shell.prepend(t.heading); await frame();
    assert(visual(t.list)[0] === t.list.lastElementChild, "late heading discovers list pre-paint");
    const next = item(2); const envelope = next.firstElementChild; envelope.remove(); t.list.append(next); await frame();
    assert(!isReversed(t.list), "incomplete wrapper fails closed");
    next.append(envelope); await frame();
    assert(visual(t.list)[0] === next, "direct wrapper construction observed before paint");
  });
  await test("replacement main discovers a deeply staged thread before paint", async () => {
    enable(); await frame();
    const replacement = el("div", { role: "main", id: "workspace" }); main().replaceWith(replacement); await frame();
    const nested = el("div"); replacement.append(nested); await frame();
    const t = thread(3); nested.append(t.shell); await frame();
    assert(visual(t.list)[0] === t.nodes[2], "new main's staged content discovered");
  });
  await test("fixed controls appearing or disappearing switch CSS modes without a wrong frame", async () => {
    const t = thread(); enable(); await frame();
    const fixed = el("button"); fixed.textContent = "Fixed action"; t.nodes[1].before(fixed); await frame();
    assert(matches(visual(t.list), [t.nodes[2], fixed, t.nodes[1], t.nodes[0]]), "mixed slots preserved");
    fixed.remove(); await frame();
    assert(matches(visual(t.list), t.nodes.slice().reverse()), "pure reversal restored");
    assert(t.nodes.every(node => !node.hasAttribute("style")), "fallback styles released");
  });
  await test("toggle is synchronous and body expansion causes no layout writes", async () => {
    const t = thread(); enable(); assert(visual(t.list)[0] === t.nodes[2], "enable is synchronous");
    const mutations = []; const watch = new NativeObserver(records => mutations.push(...records));
    watch.observe(t.list, { subtree: true, attributes: true, attributeFilter: ["style", "data-gmail-pro-thread-order"] });
    t.nodes[1].setAttribute("aria-expanded", "true"); await frame();
    assert(mutations.length === 0, "no redundant layout writes on expansion"); watch.disconnect();
    app.reverseThreads.stop(); assert(visual(t.list)[0] === t.nodes[0], "disable is synchronous");
  });
  window.MutationObserver = NativeObserver;
  app.messageList.stop();
  const failures = reports.filter(line => line.startsWith("FAIL")).length;
  result.textContent = `${reports.join("\n")}\n\n${reports.length - failures}/${reports.length} checks passed.`;
  result.dataset.failures = String(failures);
})();
