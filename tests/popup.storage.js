/* Synthetic storage only. Loaded by serve-tests.py, never by the extension. */
(() => {
  "use strict";
  if (location.hostname !== "127.0.0.1") throw new Error("Local fixture only");
  const listeners = new Set();
  const state = { values: {}, writes: 0, failRead: true, failWrite: false, listeners };
  state.emit = patch => {
    const changes = Object.fromEntries(Object.entries(patch).map(([key, newValue]) =>
      [key, { oldValue: state.values[key], newValue }]));
    Object.assign(state.values, patch);
    for (const listener of listeners) listener(changes, "sync");
  };
  window.chrome ??= {};
  if (window.chrome.storage) throw new Error("Refusing to replace real Chrome storage");
  window.chrome.storage = {
    sync: {
      async get(keys) {
        if (state.failRead) throw new Error("Synthetic read failure");
        return Object.fromEntries(keys.filter(key => key in state.values).map(key => [key, state.values[key]]));
      },
      async set(patch) {
        if (state.failWrite) throw new Error("Synthetic write failure");
        state.writes++;
        state.emit(patch);
      }
    },
    onChanged: { addListener: fn => listeners.add(fn), removeListener: fn => listeners.delete(fn) }
  };
  window.GmailProPopupTest = state;
})();
