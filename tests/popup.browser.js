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
    assert(!bcc.checked && !reverse.checked && address.value === "" && store.writes === 0, "safe defaults");
    assert(store.listeners.size === 1, "one settings listener");
  });
  await test("enabled Auto BCC requires an address", async () => {
    edit(bcc, true); await submit();
    assert(address.getAttribute("aria-invalid") === "true" && store.writes === 0, "missing address rejected");
  });
  await test("invalid address cannot be saved", async () => {
    edit(address, "invalid"); await submit();
    assert(address.getAttribute("aria-invalid") === "true" && store.writes === 0, "invalid address rejected");
  });
  await test("both features and a trimmed address save through the shared adapter", async () => {
    edit(address, " archive@example.com "); edit(reverse, true); await submit();
    const saved = await GmailPro.settings.load();
    assert(saved.autoBccEnabled && saved.newestEmailFirstEnabled && saved.bccAddress === "archive@example.com", "stored values round trip");
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
  await test("popup exit releases its storage subscription", async () => {
    window.dispatchEvent(new Event("pagehide"));
    assert(store.listeners.size === 0, "subscription removed");
  });
  const failures = reports.filter(line => line.startsWith("FAIL")).length;
  result.textContent = `${reports.join("\n")}\n\n${reports.length - failures}/${reports.length} checks passed.`;
  result.dataset.failures = String(failures);
})();
