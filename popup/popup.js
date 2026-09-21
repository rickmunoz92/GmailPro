(() => {
  "use strict";

  const app = globalThis.GmailPro;
  if (app.popupInitialized) return;
  app.popupInitialized = true;

  const form = document.getElementById("settings-form");
  const fields = document.getElementById("settings-fields");
  const address = document.getElementById("bcc-address");
  const error = document.getElementById("address-error");
  const status = document.getElementById("save-status");
  const saveButton = document.getElementById("save-button");
  const retryButton = document.getElementById("retry-button");
  const appearanceNames = new Set(["appleMailModeEnabled", "appearanceTheme", "accentColor"]);
  const systemTheme = matchMedia("(prefers-color-scheme: dark)");
  const controls = {
    appleMailModeEnabled: document.getElementById("apple-mail-mode"),
    appearanceTheme: document.getElementById("appearance-theme"),
    accentColor: document.getElementById("accent-color"),
    floatingReplyEnabled: document.getElementById("floating-reply"),
    floatingReplyAllEnabled: document.getElementById("floating-reply-all"),
    floatingForwardEnabled: document.getElementById("floating-forward"),
    archiveShortcutEnabled: document.getElementById("archive-shortcut"),
    sendShortcutEnabled: document.getElementById("send-shortcut"),
    undoShortcutEnabled: document.getElementById("undo-shortcut"),
    autoBccEnabled: document.getElementById("auto-bcc"),
    bccAddress: address,
    newestEmailFirstEnabled: document.getElementById("newest-first"),
    appleMailMessageListEnabled: document.getElementById("apple-mail-list"),
    messageZoomEnabled: document.getElementById("message-zoom"),
    customLabelOrderEnabled: document.getElementById("custom-label-order")
  };
  let saved = { ...app.settings.defaults };
  let loadingChanges = {};
  let loaded = false;
  let saving = false;
  const dirty = new Set();

  function values() {
    return {
      appleMailModeEnabled: controls.appleMailModeEnabled.checked,
      appearanceTheme: controls.appearanceTheme.value,
      accentColor: controls.accentColor.value,
      floatingReplyEnabled: controls.floatingReplyEnabled.checked,
      floatingReplyAllEnabled: controls.floatingReplyAllEnabled.checked,
      floatingForwardEnabled: controls.floatingForwardEnabled.checked,
      archiveShortcutEnabled: controls.archiveShortcutEnabled.checked,
      sendShortcutEnabled: controls.sendShortcutEnabled.checked,
      undoShortcutEnabled: controls.undoShortcutEnabled.checked,
      autoBccEnabled: controls.autoBccEnabled.checked,
      bccAddress: address.value.trim(),
      newestEmailFirstEnabled: controls.newestEmailFirstEnabled.checked,
      appleMailMessageListEnabled: controls.appleMailMessageListEnabled.checked,
      messageZoomEnabled: controls.messageZoomEnabled.checked,
      customLabelOrderEnabled: controls.customLabelOrderEnabled.checked
    };
  }

  function render(names = Object.keys(controls)) {
    for (const name of names) {
      if (!controls[name]) continue;
      if (controls[name].type !== "checkbox") controls[name].value = saved[name];
      else controls[name].checked = saved[name];
    }
    address.required = controls.autoBccEnabled.checked;
    renderAppearance();
  }

  function renderAppearance() {
    document.documentElement.dataset.gpTheme = saved.appearanceTheme === "system"
      ? (systemTheme.matches ? "dark" : "light") : saved.appearanceTheme;
    document.documentElement.dataset.gpAccent = saved.accentColor;
  }
  systemTheme.addEventListener("change", renderAppearance);

  function setStatus(message, state = "ready") {
    status.textContent = message;
    status.dataset.state = state;
  }

  function updateDirty() {
    dirty.clear();
    for (const [name, value] of Object.entries(values())) {
      if (value !== saved[name]) dirty.add(name);
    }
    saveButton.disabled = !loaded || saving || dirty.size === 0;
  }

  function clearError() {
    error.hidden = true;
    error.textContent = "";
    address.removeAttribute("aria-invalid");
  }

  function validate() {
    const current = values();
    const invalid = (current.autoBccEnabled && !current.bccAddress) ||
      (current.bccAddress !== "" && !app.settings.isValidEmail(current.bccAddress));
    if (!invalid) return true;
    error.textContent = current.bccAddress ? "Enter one valid email address." : "Add a BCC address to save Auto BCC as enabled.";
    error.hidden = false;
    address.setAttribute("aria-invalid", "true");
    address.focus();
    return false;
  }

  // Keep local edits when Chrome Sync changes another preference. Merge any
  // events received during the initial read, so an older read cannot win.
  const unsubscribe = app.settings.subscribe((patch) => {
    if (!loaded) {
      Object.assign(loadingChanges, patch);
      return;
    }
    Object.assign(saved, patch);
    render(Object.keys(patch).filter((name) => !dirty.has(name)));
    updateDirty();
    if (!saving) setStatus(dirty.size ? "Unsaved preferences" : "Preferences up to date");
  });

  async function load() {
    retryButton.hidden = true;
    saveButton.hidden = false;
    setStatus("Loading preferences…");
    try {
      saved = { ...await app.settings.load(), ...loadingChanges };
      loadingChanges = {};
      render();
      loaded = true;
      fields.disabled = false;
      updateDirty();
      setStatus("Preferences ready");
    } catch {
      app.debug.log("settings-load-failed");
      setStatus("Couldn’t load preferences.", "error");
      saveButton.hidden = true;
      retryButton.hidden = false;
    }
  }

  form.addEventListener("input", () => {
    clearError();
    address.required = controls.autoBccEnabled.checked;
    updateDirty();
    setStatus(dirty.size ? "Unsaved preferences" : "Preferences up to date");
  });

  // Immediate writes use the existing adapter, one setting at a time. Unrelated
  // unsaved tools (including an invalid BCC edit) never block appearance changes.
  for (const name of appearanceNames) controls[name].addEventListener("change", async () => {
    if (!loaded || saving) return;
    const patch = { [name]: values()[name] };
    saving = true;
    fields.disabled = true;
    updateDirty();
    try {
      await app.settings.save(patch);
      Object.assign(saved, patch);
      render([name]);
      setStatus("Appearance saved");
    } catch {
      render([name]);
      setStatus("Couldn’t save appearance. Please try again.", "error");
    } finally {
      saving = false;
      fields.disabled = false;
      updateDirty();
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!loaded || saving || dirty.size === 0) return;
    clearError();
    if (!validate()) return;
    const current = values();
    const patch = Object.fromEntries([...dirty].map((name) => [name, current[name]]));
    saving = true;
    fields.disabled = true;
    updateDirty();
    saveButton.textContent = "Saving…";
    setStatus("Saving preferences…");
    try {
      await app.settings.save(patch);
      Object.assign(saved, patch);
      render();
      setStatus("Preferences saved");
    } catch {
      app.debug.log("settings-save-failed");
      setStatus("Couldn’t save. Please try again.", "error");
    } finally {
      saving = false;
      fields.disabled = false;
      saveButton.textContent = "Save preferences";
      updateDirty();
    }
  });

  document.getElementById("edit-label-order").addEventListener("click", async () => {
    if (!loaded || saving) return;
    if (dirty.has("customLabelOrderEnabled") || !saved.customLabelOrderEnabled) {
      setStatus("Turn on Custom label order and save preferences first.", "error");
      return;
    }
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const response = await chrome.tabs.sendMessage(tab.id, { type: "gmail-pro-edit-label-order" });
      if (!response?.ok) throw new Error();
      window.close();
    } catch {
      setStatus("Open Gmail with its sidebar expanded, refresh it, then try again.", "error");
    }
  });
  document.getElementById("reset-label-order").addEventListener("click", async () => {
    if (!loaded || saving) return;
    saving = true;
    fields.disabled = true;
    updateDirty();
    try {
      await app.settings.save({ customLabelOrder: [] });
      saved.customLabelOrder = [];
      setStatus("Label order reset to Gmail’s order.");
    } catch {
      setStatus("Couldn’t reset label order. Please try again.", "error");
    } finally {
      saving = false;
      fields.disabled = false;
      updateDirty();
    }
  });

  retryButton.addEventListener("click", load);
  window.addEventListener("pagehide", () => {
    unsubscribe();
    systemTheme.removeEventListener("change", renderAppearance);
  }, { once: true });
  void load();
})();
