/* Real browser DOM, MutationObserver, focus, and keyboard events; no dependencies.
   This synthetic Gmail adapter is deliberately small. Live Gmail testing is still
   required because a fixture cannot establish that Gmail accepts these events. */
(async () => {
  "use strict";
  const app = GmailPro;
  app.messageList.start({ appleMailMessageListEnabled: true });
  const address = "archive@example.com";
  const nextAddress = "next@example.com";
  const result = document.getElementById("results");
  const log = [];
  const settle = () => new Promise(resolve => setTimeout(resolve, 360));
  function assert(condition, message) { if (!condition) throw new Error(message); }
  function element(tag, attributes = {}) {
    const node = document.createElement(tag);
    for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
    return node;
  }
  function compose({ mode = "new", initial = {}, floating = false, delayed = false, reject = false, focus = true, identity, onExpand } = {}) {
    const region = element("section", { role: "region" });
    if (identity) region.setAttribute("data-compose-id", identity);
    const form = element("form");
    const marker = element("input", { name: "composeid", type: "hidden" });
    const editor = element("div", { contenteditable: "true", role: "textbox" });
    editor.textContent = "Synthetic body must remain unchanged";
    const fields = element("div");
    const summary = element("div", { tabindex: "1" });
    const summaryChip = element("span", { "data-hovercard-id": "sender@example.com" });
    summary.append(summaryChip);
    let attempts = 0;
    let reveals = 0;
    let expansions = 0;
    const rows = {};
    const boxes = {};
    function addChip(kind, email) {
      const chip = element("div", { role: "option", "data-hovercard-id": email });
      chip.textContent = "Contact display name";
      rows[kind].prepend(chip);
      return chip;
    }
    for (const kind of ["To", "CC", "BCC"]) {
      const list = element("div", { role: "listbox" });
      const input = element("input", { role: "combobox", "aria-label": `${kind} recipients` });
      list.append(input); fields.append(list); rows[kind] = list; boxes[kind] = input;
      for (const email of initial[kind] || []) addChip(kind, email);
      input.addEventListener("keydown", event => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        attempts++;
        if (reject) return;
        const value = input.value;
        const commit = () => { addChip(kind, value); input.value = ""; };
        if (delayed) setTimeout(commit, 120); else commit();
      });
    }
    rows.CC.hidden = !initial.CC;
    rows.BCC.hidden = !initial.BCC;
    const reveal = element("span", { role: "link", "aria-label": "Add Bcc recipients" });
    reveal.textContent = "Bcc";
    reveal.addEventListener("click", () => {
      reveals++; rows.BCC.hidden = false; reveal.hidden = true; boxes.BCC.focus();
    });
    fields.append(reveal);
    // Live Gmail's inline header needs focus; .click() alone does nothing.
    // Render in a later task to catch premature focus restoration regressions.
    summary.addEventListener("focus", () => {
      setTimeout(() => {
        if (!summary.isConnected || document.activeElement !== summary) return;
        expansions++; fields.hidden = false; summary.hidden = true; boxes.To.focus();
        onExpand?.();
        // Gmail's delayed initial editor autofocus can land between expansion
        // and BCC reveal. Returning to it after reveal collapses the addressing UI.
        setTimeout(() => {
          if (editor.isConnected && region.contains(document.activeElement)) editor.focus();
        }, 20);
      }, 0);
    });
    const inline = mode !== "new";
    editor.addEventListener("focus", () => {
      if (inline && !rows.BCC.hidden) { fields.hidden = true; summary.hidden = false; }
    });
    fields.hidden = inline;
    summary.hidden = !inline;
    form.append(marker, fields, summary);
    region.append(form, editor);
    document.getElementById(floating ? "floating" : "workspace").append(region);
    if (focus) (inline ? editor : boxes.To).focus();
    return { form, region, editor, boxes, fields, addChip,
      get attempts() { return attempts; }, get reveals() { return reveals; }, get expansions() { return expansions; },
      chips: () => [...rows.BCC.querySelectorAll('[role="option"]')],
      close: () => region.remove() };
  }
  async function test(name, run) {
    try { await run(); log.push(`PASS ${name}`); }
    catch (error) { log.push(`FAIL ${name}: ${error.message}`); }
    result.textContent = log.join("\n");
    document.getElementById("workspace").replaceChildren();
    document.getElementById("floating").replaceChildren();
    await settle();
    app.autoBcc.update({ autoBccEnabled: true, bccAddress: address });
  }
  app.autoBcc.start({ autoBccEnabled: true, bccAddress: address });
  for (const mode of ["new", "reply", "reply all", "forward"]) {
    await test(mode, async () => {
      const draft = compose({ mode, floating: mode === "new" });
      await settle();
      assert(draft.chips().length === 1, "one committed BCC");
      assert(draft.attempts === 1, "one insertion attempt");
      if (mode !== "new") assert(draft.expansions === 1, "one focus-based header activation");
      assert(draft.editor.textContent === "Synthetic body must remain unchanged", "body preserved");
      assert(document.activeElement === (mode === "new" ? draft.boxes.To : draft.editor), "focus restored");
    });
  }
  await test("reply recipient setup finishes before an intermediate header paints", async () => {
    const draft = compose({ mode: "reply" });
    let sampledFrames = 0;
    let intermediateFrames = 0;
    let frame;
    const sample = () => {
      sampledFrames++;
      if (!draft.fields.hidden && !draft.chips().length) intermediateFrames++;
      frame = requestAnimationFrame(sample);
    };
    frame = requestAnimationFrame(sample);
    try {
      await settle();
      assert(draft.chips().length === 1, "BCC committed");
      assert(sampledFrames > 0, "browser rendered frames during setup");
      assert(intermediateFrames === 0, "no expanded-but-unfinished header frames");
      assert(draft.fields.hidden && document.activeElement === draft.editor, "compact header and editor focus restored");
    } finally { cancelAnimationFrame(frame); }
  });
  for (const count of [2, 3]) await test(`${count} simultaneous compose windows`, async () => {
    const drafts = Array.from({ length: count }, () => compose({ floating: true }));
    await settle();
    assert(drafts.every(d => d.chips().length === 1 && d.attempts === 1), "each draft exactly once");
  });
  for (const [name, patch] of [
    ["disabled", { autoBccEnabled: false }], ["missing address", { bccAddress: "" }],
    ["invalid address", { bccAddress: "not-an-address" }]
  ]) await test(name, async () => {
    app.autoBcc.update(patch); const draft = compose(); await settle();
    assert(draft.attempts === 0 && draft.reveals === 0, "leave draft untouched");
  });
  for (const kind of ["To", "CC", "BCC"]) await test(`already in ${kind}, contact chip and case folding`, async () => {
    const draft = compose({ initial: { [kind]: ["Archive@EXAMPLE.com"] } }); await settle();
    assert(draft.attempts === 0 && draft.reveals === 0, "no duplicate");
  });
  await test("uncommitted To address prevents duplication", async () => {
    const draft = compose(); draft.boxes.To.value = address; await settle();
    assert(draft.attempts === 0, "pending recipient recognized");
  });
  await test("manual removal stays removed; reopening is a new composition", async () => {
    const draft = compose(); await settle(); draft.chips()[0].remove(); await settle();
    draft.boxes.To.focus(); draft.form.append(element("span")); await settle();
    assert(draft.attempts === 1 && draft.chips().length === 0, "no re-add");
    draft.close(); const fresh = compose(); await settle(); assert(fresh.chips().length === 1, "new draft inserted");
  });
  for (const removed of [false, true]) await test(`native pop-out replacement preserves ${removed ? "manual removal" : "one BCC"}`, async () => {
    const identity = `transition-${removed}`;
    const old = compose({ identity }); await settle();
    if (removed) old.chips()[0].remove();
    old.close();
    const next = compose({ identity, floating: true, initial: { BCC: removed ? [] : [address] } });
    await settle();
    assert(next.attempts === 0 && next.chips().length === (removed ? 0 : 1), "replacement never reinserts");
    next.region.hidden = true; await settle(); next.region.hidden = false; next.editor.focus(); await settle();
    assert(next.attempts === 0, "minimize/restore never reinserts");
  });
  await test("pop-out before initial insertion initializes only the replacement", async () => {
    const old = compose({ identity: "early-transition" }); old.close();
    const next = compose({ identity: "early-transition", floating: true }); await settle();
    assert(old.attempts === 0 && next.attempts === 1 && next.chips().length === 1, "only replacement inserted");
  });
  await test("late native compose identity preserves removal through replacement", async () => {
    const old = compose(); old.region.setAttribute("data-compose-id", "late-identity"); await settle();
    old.chips()[0].remove(); await settle(); old.close();
    const next = compose({ floating:true }); next.region.setAttribute("data-compose-id", "late-identity"); await settle();
    assert(next.attempts === 0 && next.chips().length === 0, "late identity recovers existing decision");
  });
  await test("address change affects future compositions", async () => {
    const old = compose(); await settle(); app.autoBcc.update({ bccAddress: nextAddress });
    const fresh = compose(); await settle();
    assert(old.chips()[0].getAttribute("data-hovercard-id") === address, "old recipient retained");
    assert(fresh.chips()[0].getAttribute("data-hovercard-id") === nextAddress, "future recipient updated");
    assert(old.attempts === 1, "no duplicate in old draft");
  });
  await test("off/on leaves existing and disabled compositions alone", async () => {
    const old = compose(); await settle(); app.autoBcc.update({ autoBccEnabled: false });
    const off = compose(); await settle(); app.autoBcc.update({ autoBccEnabled: true });
    off.boxes.To.focus(); const fresh = compose(); await settle();
    assert(old.attempts === 1 && off.attempts === 0 && fresh.attempts === 1, "only future drafts change");
  });
  await test("disable or address change cancels pending work", async () => {
    const first = compose(); app.autoBcc.update({ autoBccEnabled: false }); await settle();
    app.autoBcc.update({ autoBccEnabled: true }); const second = compose();
    app.autoBcc.update({ bccAddress: nextAddress }); await settle();
    assert(first.attempts === 0 && second.attempts === 0, "stale work cancelled");
  });
  await test("delayed Gmail commit and mutation burst never duplicate", async () => {
    const draft = compose({ delayed: true });
    for (let i = 0; i < 100; i++) draft.form.append(element("span"));
    await settle(); await settle(); assert(draft.chips().length === 1 && draft.attempts === 1, "one asynchronous commit");
  });
  await test("rejected commit is never retried", async () => {
    const draft = compose({ reject: true }); await settle();
    draft.form.append(element("span")); await settle(); assert(draft.attempts === 1, "bounded attempt");
  });
  await test("SPA replaces main pane; reply and forward discovered without focus", async () => {
    const next = element("div", { role: "main", id: "workspace" });
    document.getElementById("workspace").replaceWith(next); await settle();
    const reply = compose({ mode: "reply", focus: false }); const forward = compose({ mode: "forward", focus: false }); await settle(); await settle();
    assert(reply.attempts === 1 && forward.attempts === 1, "replacement pane observed");
  });
  await test("closing before insertion cancels work", async () => {
    const draft = compose(); draft.close(); await settle(); assert(draft.attempts === 0, "no detached mutation");
  });
  await test("start/stop are idempotent and preserve removal decisions", async () => {
    const draft = compose(); await settle(); app.autoBcc.start(); app.autoBcc.start();
    draft.chips()[0].remove(); await settle(); app.autoBcc.stop(); app.autoBcc.stop();
    app.autoBcc.start({ autoBccEnabled: true, bccAddress: address }); await settle();
    assert(draft.attempts === 1 && draft.chips().length === 0, "no reinitialization duplicate");
  });
  await test("existing unfinished BCC text is never overwritten", async () => {
    const draft = compose({ initial: { BCC: [] } });
    draft.boxes.BCC.value = "unfinished-user-input"; await settle();
    assert(draft.attempts === 0 && draft.boxes.BCC.value === "unfinished-user-input", "user input preserved");
    draft.boxes.BCC.value = "";
    draft.boxes.BCC.dispatchEvent(new Event("input", { bubbles: true })); await settle();
    assert(draft.attempts === 1, "insertion resumes on recipient input event");
  });
  await test("unknown recipient labels fail closed", async () => {
    const draft = compose();
    for (const input of Object.values(draft.boxes)) input.setAttribute("aria-label", "Unknown locale");
    await settle(); assert(draft.attempts === 0 && draft.reveals === 0, "no guessed recipient control");
  });
  await test("reply expansion never restores focus into another compose", async () => {
    let other;
    const reply = compose({ mode: "reply", onExpand: () => { other = compose(); } });
    await settle();
    assert(reply.attempts === 1 && other.attempts === 1, "both drafts handled");
    assert(document.activeElement === other.boxes.To, "later compose keeps focus");
  });
  await test("disabling during header expansion cancels and restores focus", async () => {
    const reply = compose({ mode: "reply", onExpand: () => {
      app.autoBcc.update({ autoBccEnabled: false });
    } });
    await settle();
    assert(reply.attempts === 0, "pending insertion cancelled");
    assert(document.activeElement === reply.editor, "original caret restored");
  });
  await test("late-built Gmail shell recovers on focus", async () => {
    app.autoBcc.stop();
    document.getElementById("workspace").remove();
    const wrapper = element("section");
    document.body.append(wrapper);
    app.autoBcc.start({ autoBccEnabled: true, bccAddress: address });
    const next = element("div", { role: "main", id: "workspace" });
    wrapper.append(next);
    const draft = compose(); await settle();
    assert(draft.attempts === 1, "late pane found without polling");
  });
  app.autoBcc.stop();
  app.messageList.stop();
  const failures = log.filter(line => line.startsWith("FAIL")).length;
  result.dataset.failures = String(failures);
  result.dataset.complete = "true";
  result.textContent += `\n\n${log.length - failures}/${log.length} checks passed.`;
})();
