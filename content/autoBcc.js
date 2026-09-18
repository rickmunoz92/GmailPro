(() => {
  "use strict";
  const app = (globalThis.GmailPro ??= {});
  if (app.autoBcc) return;
  const S = app.selectors;
  const seen = new WeakMap();
  const active = new Map();
  // Session-only decisions for Gmail's native data-compose-id. The native
  // pop-out rebuilds forms but retains this identity. Bound detached history;
  // never persist recipient content or match drafts by subject/recipient.
  const identities = new Map();
  function remember(state) {
    state.identity ||= state.form.closest(S.region)?.getAttribute("data-compose-id");
    if (!state.identity) return;
    identities.delete(state.identity);
    identities.set(state.identity, { address: state.address, status: state.status, attempted: state.attempted });
    if (identities.size > 100) identities.delete(identities.keys().next().value);
  }
  let running = false;
  let settings = { ...app.settings.defaults };
  let discovery;
  let main;
  let headerOwner = null;

  // Keep plus tags and dots: different providers assign different meanings.
  function normalizeAddress(value) {
    if (typeof value !== "string") return "";
    const match = value.trim().match(/<([^<>]+)>$/);
    const address = (match ? match[1] : value).trim();
    return app.settings.isValidEmail(address) ? address.toLowerCase() : "";
  }

  function visible(element) {
    return !!element && element.isConnected && element.getClientRects().length > 0;
  }

  function inputs(form) {
    return [...form.querySelectorAll(S.recipientInput)];
  }

  function chipAddresses(input) {
    return [...(input.closest(S.recipientList)?.querySelectorAll(S.chip) || [])]
      .map(chip => normalizeAddress(chip.getAttribute("data-hovercard-id")));
  }

  function hasRecipient(form, address) {
    for (const input of inputs(form)) {
      if (chipAddresses(input).includes(address)) return true;
      // Pending text also counts, so we do not race a user entering a recipient.
      if (input.value.split(/[;,]/).some(value => normalizeAddress(value) === address)) return true;
    }
    return [...form.querySelectorAll(S.summaryRecipient)].some(chip =>
      normalizeAddress(chip.getAttribute("email") || chip.getAttribute("data-hovercard-id")) === address);
  }

  function bccCommitted(state) {
    return [...state.form.querySelectorAll(S.bccInput)].some(input => chipAddresses(input).includes(state.address));
  }

  function release(state) {
    clearTimeout(state.timer);
    clearTimeout(state.deadline);
    state.observer?.disconnect();
    state.form.removeEventListener("input", state.onInput);
    active.delete(state.form);
    restoreHeaderFocus(state);
  }

  function finish(state, status) {
    if (status !== "closed" && status !== "stopped") { state.status = status; remember(state); }
    release(state);
  }

  function captureFocus() {
    const previous = document.activeElement;
    const selection = document.getSelection();
    const range = selection?.rangeCount ? selection.getRangeAt(0).cloneRange() : null;
    return {
      restore() {
        if (previous?.isConnected && document.activeElement !== previous) {
          previous.focus({ preventScroll: true });
          if (range?.startContainer.isConnected && range.endContainer.isConnected) {
            selection.removeAllRanges();
            selection.addRange(range);
          }
        }
      }
    };
  }

  function preserveFocus(action) {
    const focus = captureFocus();
    try { action(); } finally { focus.restore(); }
  }

  function restoreHeaderFocus(state) {
    const focus = state.headerFocus;
    state.headerFocus = null;
    const ownedHeader = headerOwner === state;
    if (ownedHeader) headerOwner = null;
    // A reply header activates on focus, with recipient rendering deferred by
    // Gmail. Restore only while focus is still in our addressing form, and only
    // if no real keyboard/pointer interaction has superseded this saved caret.
    if (focus && state.form.contains(document.activeElement)) focus.restore();
    if (ownedHeader) {
      // Two inline forms can arrive in one mutation batch. Focus-dependent
      // expansion must finish before another header takes that focus away.
      for (const pending of active.values()) if (pending.status === "pending") schedule(pending);
    }
  }

  function onUserInteraction(event) {
    if (!event.isTrusted) return;
    for (const state of active.values()) state.headerFocus = null;
  }

  function step(state) {
    state.timer = null;
    if (!running || !state.form.isConnected) return finish(state, "closed");
    if (!state.identity) {
      const identity = state.form.closest(S.region)?.getAttribute("data-compose-id");
      const prior = identity && identities.get(identity);
      if (identity) state.identity = identity;
      if (prior) Object.assign(state, prior);
      if (!["pending", "inserted"].includes(state.status)) return finish(state, state.status);
    }
    if (state.status === "inserted") {
      if (!bccCommitted(state)) {
        app.debug.log("bcc-user-removal");
        finish(state, "removed");
      }
      return;
    }
    if (!settings.autoBccEnabled || normalizeAddress(settings.bccAddress) !== state.address) {
      return finish(state, "cancelled");
    }
    // Programmatic focus in a different compose can supersede this operation
    // too (without a trusted pointer/key event). Check before taking BCC focus.
    if (state.headerFocus && !state.form.closest(S.region)?.contains(document.activeElement)) {
      state.headerFocus = null;
    }
    try {
      if (state.attempted) {
        if (bccCommitted(state)) {
          state.status = "inserted";
          remember(state);
          clearTimeout(state.deadline);
          state.observer.disconnect();
          state.observer.observe(state.form, { childList: true, subtree: true, attributes: true,
            attributeFilter: ["data-hovercard-id", "email"] });
          // Only recipient changes remain observed, solely to recognize removal.
        }
        return; // Never retry an attempted insertion, even if Gmail rejects it.
      }
      if (!inputs(state.form).length) return;
      if (hasRecipient(state.form, state.address)) {
        app.debug.log("bcc-already-present");
        return finish(state, "present");
      }
      const bcc = [...state.form.querySelectorAll(S.bccInput)].filter(visible);
      if (bcc.length > 1) return finish(state, "ambiguous");
      if (bcc.length === 1) {
        if (bcc[0].value.trim()) return; // Do not overwrite uncommitted user text.
        state.attempted = true; // Set BEFORE Gmail can synchronously mutate the DOM.
        remember(state);
        app.debug.log("bcc-insertion-attempted");
        preserveFocus(() => {
          bcc[0].focus({ preventScroll: true });
          const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
          setter.call(bcc[0], state.address);
          bcc[0].dispatchEvent(new Event("input", { bubbles: true }));
          for (const type of ["keydown", "keyup"]) {
            bcc[0].dispatchEvent(new KeyboardEvent(type, {
              key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true, cancelable: true
            }));
          }
        });
        restoreHeaderFocus(state);
        schedule(state);
        return;
      }
      const reveal = [...state.form.querySelectorAll(S.addBcc)].filter(visible);
      if (reveal.length === 1 && !state.revealed) {
        state.revealed = true;
        if (state.headerFocus) {
          // Gmail may finish its initial editor autofocus after we activate the
          // header. Keep that editor as the return target, then retain BCC focus
          // through insertion: restoring the editor between these steps hides BCC.
          const focused = document.activeElement;
          if (focused.matches(S.editor) && state.form.closest(S.region)?.contains(focused)) {
            state.headerFocus = captureFocus();
          }
          reveal[0].click();
        } else {
          preserveFocus(() => reveal[0].click());
        }
        schedule(state);
        return;
      }
      const summaries = [...state.form.querySelectorAll(S.summary)]
        .filter(node => visible(node) && node.querySelector(S.summaryRecipient));
      if (summaries.length === 1 && !state.expanded) {
        if (headerOwner && headerOwner !== state) return;
        headerOwner = state;
        state.expanded = true;
        state.headerFocus = captureFocus();
        summaries[0].focus({ preventScroll: true });
        summaries[0].click();
        schedule(state);
      }
    } catch {
      app.debug.log("bcc-selector-failure");
      finish(state, "failed");
    }
  }

  function schedule(state) {
    if (state.timer || !active.has(state.form)) return;
    // Let a new compose settle before touching focus. Once we open its header,
    // drain ready recipient work before the next paint instead of displaying
    // each intermediate To/CC/BCC layout for another 80 ms. Gmail's deferred
    // rendering still resumes through the form observer; this is not polling.
    if (state.expanded || state.revealed || state.attempted) {
      const pending = {};
      state.timer = pending;
      queueMicrotask(() => {
        if (state.timer === pending && active.has(state.form)) step(state);
      });
    } else {
      state.timer = setTimeout(() => step(state), 80);
    }
  }

  function discover(form) {
    if (!running || !form?.matches(S.form) || !form.isConnected || seen.has(form) ||
        !form.querySelector(S.composeMarker)) return;
    const identity = form.closest(S.region)?.getAttribute("data-compose-id");
    // Flush a removal before Gmail detaches the old form in the same task.
    for (const previous of active.values()) if (identity && previous.identity === identity && previous.form !== form) {
      if (previous.form.isConnected) return; // Ambiguous identity: never touch another draft.
      if (previous.status === "inserted" && !bccCommitted(previous)) finish(previous, "removed");
      else { remember(previous); release(previous); }
    }
    const prior = identity && identities.get(identity);
    const state = { form, identity, address: normalizeAddress(settings.bccAddress), status: "pending", ...prior };
    remember(state);
    seen.set(form, state);
    watchSpine(form.parentElement);
    // Disabled drafts are remembered too: future means future.
    app.debug.log("compose-detected");
    if (!["pending", "inserted"].includes(state.status)) return;
    if (!settings.autoBccEnabled || !state.address) { state.status = "disabled"; remember(state); return; }
    active.set(form, state);
    state.onInput = event => { if (event.target.matches(S.recipientInput)) schedule(state); };
    form.addEventListener("input", state.onInput);
    state.observer = new MutationObserver(() => schedule(state));
    state.observer.observe(form, { childList: true, subtree: true, attributes: true,
      attributeFilter: ["style", "class", "hidden", "aria-label", "data-hovercard-id", "email"] });
    state.deadline = setTimeout(() => {
      if (state.status !== "inserted") {
        app.debug.log("bcc-selector-failure");
        finish(state, "failed");
      }
    }, 5000);
    schedule(state);
  }

  function scan(node) {
    if (node.nodeType !== 1 || node.closest(S.editor)) return;
    // Mutations within a known form are handled by its own narrow observer.
    const owner = node.closest(S.form);
    if (owner) { discover(owner); return; }
    for (const marker of node.querySelectorAll(S.composeMarker)) discover(marker.closest(S.form));
  }

  function cleanupDetached() {
    for (const state of active.values()) if (!state.form.isConnected) {
      // Detachment itself is not recipient removal. Only compare retained chips
      // while the old form still has its recipient UI.
      if (state.status === "inserted" && inputs(state.form).length && !bccCommitted(state)) finish(state, "removed");
      else { remember(state); finish(state, "closed"); }
    }
  }

  function watchSpine(node) {
    for (; node; node = node.parentElement) {
      discovery.observe(node, { childList: true, subtree: node === main });
    }
  }

  function observeMain(nextMain) {
    main = nextMain;
    discovery.disconnect();
    // Inline compose discovery is confined to the main Gmail pane. Its ancestor
    // spine is watched SHALLOWLY for SPA replacements. Floating compose windows
    // are discovered on focus; no permanent body-subtree observer is necessary.
    if (main) discovery.observe(main, { childList: true, subtree: true });
    watchSpine(main?.parentElement || document.body);
    for (const state of active.values()) watchSpine(state.form.parentElement);
  }

  function onFocus(event) {
    cleanupDetached();
    // Gmail may finish building its shell after document_idle. Recover the main
    // pane on the next focus event without a broad startup observer or polling.
    if (!main?.isConnected) {
      const nextMain = document.querySelector(S.main);
      if (nextMain) observeMain(nextMain);
    }
    const form = event.target.closest(S.form);
    if (form) discover(form);
    else {
      const region = event.target.closest(S.region);
      if (region) scan(region);
    }
  }

  function update(next) {
    settings = { ...settings, ...next };
    for (const state of active.values()) {
      if (state.status !== "inserted" && (!settings.autoBccEnabled ||
          normalizeAddress(settings.bccAddress) !== state.address)) finish(state, "cancelled");
    }
  }

  function start(initial) {
    update(initial);
    if (running) return;
    running = true;
    discovery = new MutationObserver(records => {
      cleanupDetached();
      let replacement;
      for (const record of records) for (const node of record.addedNodes) {
        if (node.nodeType !== 1 || node.closest(S.editor)) continue;
        if (!main?.isConnected) replacement ||= node.matches(S.main) ? node : node.querySelector(S.main);
        scan(node);
      }
      if (replacement) observeMain(replacement);
    });
    observeMain(document.querySelector(S.main));
    document.addEventListener("focusin", onFocus, true);
    document.addEventListener("pointerdown", onUserInteraction, true);
    document.addEventListener("keydown", onUserInteraction, true);
    scan(document.body); // One initial scan; subsequent scans use added subtrees.
  }

  function stop() {
    if (!running) return;
    running = false;
    discovery.disconnect();
    document.removeEventListener("focusin", onFocus, true);
    document.removeEventListener("pointerdown", onUserInteraction, true);
    document.removeEventListener("keydown", onUserInteraction, true);
    for (const state of active.values()) finish(state, "stopped");
  }

  app.autoBcc = Object.freeze({ implemented: true, start, update, stop, normalizeAddress });
})();
