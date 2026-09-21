/* Test-only resource accounting. Production never loads this adapter. */
(() => {
  const observers = new Set(), listeners = new Map();
  // Browser automation injects unrelated message/beforeunload listeners. Count
  // every event type used by the production modules, on document/window.
  const ownedEvents = new Set(['focusin','pointerdown','mousedown','mouseup','click','keydown','keypress','keyup','beforeinput','input','paste','drop','hashchange','popstate','visibilitychange','blur']);
  const owned = () => /\/content\/(autoBcc|floatingCompose|keyboardShortcuts)\.js/.test(new Error().stack);
  const NativeObserver = window.MutationObserver;
  window.MutationObserver = class extends NativeObserver {
    observe(...args) { if (owned()) observers.add(this); return super.observe(...args); }
    disconnect() { observers.delete(this); return super.disconnect(); }
  };
  for (const target of [window, document]) {
    const add = target.addEventListener.bind(target), remove = target.removeEventListener.bind(target);
    const entries = new Map(); listeners.set(target, entries);
    target.addEventListener = (type, callback, options) => {
      if (!ownedEvents.has(type) || !owned()) return add(type, callback, options);
      const callbacks = entries.get(type) || new Set(); callbacks.add(callback); entries.set(type, callbacks);
      return add(type, callback, options);
    };
    target.removeEventListener = (type, callback, options) => {
      entries.get(type)?.delete(callback); return remove(type, callback, options);
    };
  }
  window.composeLifecycle = { describe: () => JSON.stringify({observers:observers.size,listeners:[...listeners.values()].flatMap(entries => [...entries].flatMap(([type, callbacks]) => [...callbacks].map(callback => type + ':' + callback.name)))}), observersActive: () => observers.size,
    listenersActive: () => [...listeners.values()].reduce((n, entries) => n + [...entries.values()].reduce((m, callbacks) => m + callbacks.size, 0), 0) };
})();
