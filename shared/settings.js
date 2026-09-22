(() => {
  "use strict";

  const app = (globalThis.GmailPro ??= {});
  if (app.settings) return;

  const defaults = Object.freeze({
    appleMailModeEnabled: false,
    headerCollapsed: false,
    appearanceTheme: "dark",
    accentColor: "blue",
    floatingReplyEnabled: true,
    floatingReplyAllEnabled: true,
    floatingForwardEnabled: true,
    archiveShortcutEnabled: true,
    sendShortcutEnabled: true,
    undoShortcutEnabled: true,
    replyAllShortcutEnabled: true,
    forwardShortcutEnabled: true,
    autoBccEnabled: false,
    bccAddress: "",
    newestEmailFirstEnabled: false,
    appleMailMessageListEnabled: false,
    autoPagingEnabled: false,
    messageZoomEnabled: false,
    customLabelOrderEnabled: false,
    customLabelOrder: Object.freeze([])
  });
  // Independent, versioned keys avoid overwriting unrelated preferences when
  // different extension contexts save changes. Same-key conflicts are last-write-wins.
  const keys = Object.freeze({
    appleMailModeEnabled: "gmailPro.v1.appleMailModeEnabled",
    headerCollapsed: "gmailPro.v1.headerCollapsed",
    appearanceTheme: "gmailPro.v1.appearanceTheme",
    accentColor: "gmailPro.v1.accentColor",
    floatingReplyEnabled: "gmailPro.v1.floatingReplyEnabled",
    floatingReplyAllEnabled: "gmailPro.v1.floatingReplyAllEnabled",
    floatingForwardEnabled: "gmailPro.v1.floatingForwardEnabled",
    archiveShortcutEnabled: "gmailPro.v1.archiveShortcutEnabled",
    sendShortcutEnabled: "gmailPro.v1.sendShortcutEnabled",
    undoShortcutEnabled: "gmailPro.v1.undoShortcutEnabled",
    replyAllShortcutEnabled: "gmailPro.v1.replyAllShortcutEnabled",
    forwardShortcutEnabled: "gmailPro.v1.forwardShortcutEnabled",
    autoBccEnabled: "gmailPro.v1.autoBccEnabled",
    bccAddress: "gmailPro.v1.bccAddress",
    newestEmailFirstEnabled: "gmailPro.v1.newestEmailFirstEnabled",
    appleMailMessageListEnabled: "gmailPro.v1.appleMailMessageListEnabled",
    autoPagingEnabled: "gmailPro.v1.autoPagingEnabled",
    messageZoomEnabled: "gmailPro.v1.messageZoomEnabled",
    customLabelOrderEnabled: "gmailPro.v1.customLabelOrderEnabled",
    customLabelOrder: "gmailPro.v1.customLabelOrder"
  });
  const choices = Object.freeze({
    appearanceTheme: Object.freeze(["dark", "light", "system"]),
    accentColor: Object.freeze(["blue", "purple", "pink", "red", "orange", "yellow", "green", "graphite"])
  });
  const subscribers = new Map();
  const emailPattern = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

  function isValidEmail(value) {
    return typeof value === "string" && value.length <= 254 && emailPattern.test(value);
  }

  // Stay below Chrome Sync's per-item quota, including key/JSON overhead.
  function validOrder(value) {
    return Array.isArray(value) && value.length <= 500 &&
      value.every(id => typeof id === "string" && id.startsWith("label/") && id.length <= 1024) &&
      new TextEncoder().encode(JSON.stringify(value)).length <= 7500;
  }

  function normalize(name, value) {
    if (choices[name]) return choices[name].includes(value) ? value : defaults[name];
    if (name === "customLabelOrder") return validOrder(value) ? [...new Set(value)] : [];
    if (name === "bccAddress") {
      const address = typeof value === "string" ? value.trim() : "";
      return address === "" || isValidEmail(address) ? address : "";
    }
    return typeof value === "boolean" ? value : defaults[name];
  }

  async function load() {
    const stored = await chrome.storage.sync.get(Object.values(keys));
    return Object.fromEntries(
      Object.entries(keys).map(([name, key]) => [name, normalize(name, stored[key])])
    );
  }

  async function save(patch) {
    if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
      throw new TypeError("Settings must be an object.");
    }
    const stored = {};
    for (const [name, value] of Object.entries(patch)) {
      if (!Object.hasOwn(keys, name)) throw new TypeError("Unknown setting.");
      if (choices[name]) {
        if (!choices[name].includes(value)) throw new TypeError("Unknown appearance choice.");
      } else if (name === "bccAddress") {
        if (typeof value !== "string" || (value.trim() !== "" && !isValidEmail(value.trim()))) {
          throw new TypeError("Enter one valid email address.");
        }
      } else if (name === "customLabelOrder") {
        if (!validOrder(value)) throw new TypeError("Label order is too large or invalid.");
      } else if (typeof value !== "boolean") {
        throw new TypeError("Setting must be a boolean.");
      }
      stored[keys[name]] = normalize(name, value);
    }
    // No writes on startup or per keystroke. Do not mask storage/quota failures.
    if (Object.keys(stored).length) await chrome.storage.sync.set(stored);
  }

  function onChanged(changes, areaName) {
    if (areaName !== "sync") return;
    const patch = {};
    for (const [name, key] of Object.entries(keys)) {
      if (Object.hasOwn(changes, key)) patch[name] = normalize(name, changes[key].newValue);
    }
    if (!Object.keys(patch).length) return;
    for (const listener of subscribers.keys()) listener(Object.freeze({ ...patch }));
  }

  // A subscriber receives a normalized patch, not a full settings snapshot.
  // Register before load() and merge intervening events to avoid a startup race.
  function subscribe(listener) {
    if (typeof listener !== "function") throw new TypeError("Listener must be a function.");
    if (subscribers.has(listener)) return subscribers.get(listener);
    if (subscribers.size === 0) chrome.storage.onChanged.addListener(onChanged);
    const unsubscribe = () => {
      // An old cleanup must not remove a newer subscription of the same callback.
      if (subscribers.get(listener) !== unsubscribe) return;

      if (subscribers.delete(listener) && subscribers.size === 0) {
        chrome.storage.onChanged.removeListener(onChanged);
      }
    };
    subscribers.set(listener, unsubscribe);
    return unsubscribe;
  }

  app.settings = Object.freeze({ defaults, choices, load, save, subscribe, isValidEmail });
})();
