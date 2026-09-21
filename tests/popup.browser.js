/* Real popup DOM + production settings/popup scripts; synthetic data only. */
(async () => {
  "use strict";
  const store = window.GmailProPopupTest;
  const reports = [];
  const result = document.createElement("pre");
  result.id = "results";
  document.body.append(result);
  const byId = id => document.getElementById(id);
  const form = byId("settings-form");
  const save = byId("save-button");
  const address = byId("bcc-address");
  const bcc = byId("auto-bcc");
  const messageList = byId("apple-mail-list");
  const reverse = byId("newest-first");
  const key = name => `gmailPro.v1.${name}`;
  const settle = () => new Promise(resolve => setTimeout(resolve, 20));
  const assert = (ok, message) => { if (!ok) throw new Error(message); };
  const edit = (control, value) => {
    if (control.type === "checkbox") control.checked = value;
    else control.value = value;
    control.dispatchEvent(new Event("input", { bubbles: true }));
  };
  const submit = async () => { form.requestSubmit(); await settle(); };
  async function test(name, run) {
    try { await run(); reports.push(`PASS ${name}`); }
    catch (error) { reports.push(`FAIL ${name}: ${error.message}`); }
    result.textContent = reports.join("\n");
  }
  await settle();
  await test("initial storage error offers retry without enabling settings", async () => {
    assert(byId("settings-fields").disabled && !byId("retry-button").hidden, "retry state visible");
    assert(byId("save-status").dataset.state === "error", "error announced");
  });
  await test("retry loads safe defaults without writing preferences", async () => {
    store.failRead = false; byId("retry-button").click(); await settle();
    assert(!byId("settings-fields").disabled && save.disabled, "loaded and unchanged");
    assert(!bcc.checked && !reverse.checked && !messageList.checked && address.value === "" && store.writes === 0, "safe defaults");
    assert(store.listeners.size === 1, "one settings listener");
  });
  await test("floating compose settings default on and save independently", async () => {
    for (const id of ["floating-reply", "floating-reply-all", "floating-forward"]) assert(byId(id).checked, "default on");
    edit(byId("floating-reply-all"), false); await submit();
    const saved = await GmailPro.settings.load();
    assert(saved.floatingReplyEnabled && !saved.floatingReplyAllEnabled && saved.floatingForwardEnabled, "independent save");
    store.writes = 0;
  });
  await test("keyboard shortcuts default on, save independently, and follow sync", async () => {
    const archive=byId("archive-shortcut"), send=byId("send-shortcut"), undo=byId("undo-shortcut");
    assert(archive.checked && send.checked && undo.checked, "default on");
    edit(archive, false); await submit();
    assert(!(await GmailPro.settings.load()).archiveShortcutEnabled && send.checked, "independent save");
    store.emit({[key("sendShortcutEnabled")]:false}); assert(!send.checked, "sync applied");
    assert(byId("send-shortcut-hint").textContent.includes("discard"), "native conflict explained");
    edit(undo, false); await submit();
    const saved=await GmailPro.settings.load();
    assert(!saved.undoShortcutEnabled && !saved.archiveShortcutEnabled && !saved.sendShortcutEnabled, "undo saves independently");
    store.emit({[key("undoShortcutEnabled")]:true}); assert(undo.checked, "undo sync applied");
    assert(byId("undo-shortcut-hint").textContent.includes("While editing"), "text undo explained");
    store.writes=0;
  });
  await test("automatic paging defaults off, saves independently, and follows sync", async () => {
    const toggle = byId("auto-paging"); assert(!toggle.checked, "default off");
    edit(toggle, true); await submit(); assert((await GmailPro.settings.load()).autoPagingEnabled, "saved");
    store.emit({ [key("autoPagingEnabled")]: false }); assert(!toggle.checked && save.disabled, "sync applied");
    assert(byId("auto-paging-description").textContent.includes("replaces"), "page replacement explained"); store.writes = 0;
  });
  await test("enabled Auto BCC requires an address", async () => {
    edit(bcc, true); await submit();
    assert(address.getAttribute("aria-invalid") === "true" && store.writes === 0, "missing address rejected");
  });
  await test("invalid address cannot be saved", async () => {
    edit(address, "invalid"); await submit();
    assert(address.getAttribute("aria-invalid") === "true" && store.writes === 0, "invalid address rejected");
  });
  await test("all features and a trimmed address save through the shared adapter", async () => {
    edit(address, " archive@example.com "); edit(reverse, true); edit(messageList, true); await submit();
    const saved = await GmailPro.settings.load();
    assert(saved.autoBccEnabled && saved.newestEmailFirstEnabled && saved.appleMailMessageListEnabled && saved.bccAddress === "archive@example.com", "stored values round trip");
    assert(save.disabled && byId("address-error").hidden, "saved state displayed");
  });
  await test("failed save preserves edits and allows retry", async () => {
    edit(address, "next@example.com"); store.failWrite = true; await submit();
    assert(address.value === "next@example.com" && !save.disabled && !byId("settings-fields").disabled, "edits retained");
    assert(store.values[key("bccAddress")] === "archive@example.com", "failed write does not persist");
  });
  await test("retry persists the edited address", async () => {
    store.failWrite = false; await submit();
    assert(store.values[key("bccAddress")] === "next@example.com" && save.disabled, "retry saved");
  });
  await test("incoming changes preserve unsaved local edits", async () => {
    edit(address, "draft@example.com");
    store.emit({ [key("newestEmailFirstEnabled")]: false, [key("bccAddress")]: "synced@example.com" });
    assert(!reverse.checked && address.value === "draft@example.com" && !save.disabled, "merge respects dirty input");
    await submit();
    assert(store.values[key("bccAddress")] === "draft@example.com" && !store.values[key("newestEmailFirstEnabled")], "only local edit saved");
  });
  await test("disabling Auto BCC allows an empty address", async () => {
    edit(bcc, false); edit(address, ""); await submit();
    assert(!store.values[key("autoBccEnabled")] && store.values[key("bccAddress")] === "", "disabled preferences persisted");
  });
  await test("message-list toggle saves independently and responds to sync", async () => {
    edit(messageList, false); await submit();
    assert(!store.values[key("appleMailMessageListEnabled")] && !store.values[key("autoBccEnabled")], "independent save");
    store.emit({ [key("appleMailMessageListEnabled")]: true });
    assert(messageList.checked && save.disabled, "sync renders new preference");
  });
  await test("label-order switch and reset are independent and sync-safe", async () => {
    edit(byId("custom-label-order"), true); await submit();
    assert(store.values[key("customLabelOrderEnabled")] === true, "label feature enabled");
    store.emit({ [key("customLabelOrder")]: ["label/B", "label/A"] });
    assert(save.disabled, "order metadata does not become an input or dirty edit");
    byId("reset-label-order").click(); await settle();
    assert(store.values[key("customLabelOrder")].length === 0, "reset clears order only");
    assert(store.values[key("customLabelOrderEnabled")] === true, "reset keeps toggle");
    store.failWrite = true; byId("reset-label-order").click(); await settle(); store.failWrite = false;
    assert(byId("save-status").dataset.state === "error" && !byId("settings-fields").disabled, "reset failure recoverable");
  });
  await test("message zoom toggle saves independently", async () => {
    edit(byId("message-zoom"), true); await submit();
    assert(store.values[key("messageZoomEnabled")] === true, "zoom enabled");
    edit(byId("message-zoom"), false); await submit();
    assert(store.values[key("messageZoomEnabled")] === false, "zoom disabled");
    assert(!Object.hasOwn(store.values,key("messageZoom")), "temporary level never stored");
  });
  await test("appearance changes save immediately without saving an invalid BCC edit", async () => {
    edit(address, "invalid-unsaved");
    const mode = byId("apple-mail-mode"), theme = byId("appearance-theme"), accent = byId("accent-color");
    for (const [control, value, name] of [[mode, true, "appleMailModeEnabled"], [theme, "light", "appearanceTheme"], [accent, "yellow", "accentColor"]]) {
      edit(control, value); control.dispatchEvent(new Event("change", { bubbles: true })); await settle();
      assert(store.values[key(name)] === value, "appearance saved immediately");
      assert(address.value === "invalid-unsaved" && store.values[key("bccAddress")] === "", "BCC edit stays local");
    }
    assert(document.documentElement.dataset.gpTheme === "light" && document.documentElement.dataset.gpAccent === "yellow", "preview updated");
    store.failWrite = true; edit(accent, "purple"); accent.dispatchEvent(new Event("change", { bubbles: true })); await settle(); store.failWrite = false;
    assert(accent.value === "yellow" && byId("save-status").dataset.state === "error", "failure rolls back and announces");
    edit(address, "");
    store.emit({ [key("appearanceTheme")]: "system", [key("accentColor")]: "pink" });
    assert(theme.value === "system" && accent.value === "pink", "incoming sync updates appearance");
  });
  await test("popup exit releases its storage subscription", async () => {
    window.dispatchEvent(new Event("pagehide"));
    assert(store.listeners.size === 0, "subscription removed");
  });
  const failures = reports.filter(line => line.startsWith("FAIL")).length;
  result.textContent = `${reports.join("\n")}\n\n${reports.length - failures}/${reports.length} checks passed.`;
  result.dataset.failures = String(failures);
})();
