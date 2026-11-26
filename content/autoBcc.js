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
  let focusOwner = null;
  // Focus can precede Gmail's addressing form. These short-lived watches belong
  // to this recipient owner; they neither control nor wait for a pop-out.
  const incompleteHosts = new Map(), watchedHosts = new WeakSet();

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

  function recipientSummary(form) {
    const summaries = [...form.querySelectorAll(S.summary)]
      .filter(node => visible(node) && node.querySelector(S.summaryRecipient));
    return summaries.length === 1 ? summaries[0] : null;
  }

  function observeRemoval(state) {
    state.observer.disconnect();
    state.observer.observe(state.form, { childList: true, subtree: true, attributes: true,
      attributeFilter: ["data-hovercard-id", "email"] });
  }

  function releaseHeaderLayout(state) {
    const restore = state.restoreLayout;
    if (!restore) return;
    state.restoreLayout = null;
    restore();
    if (state.status === "inserted" && active.get(state.form) === state) observeRemoval(state);
  }

  function holdHeaderLayout(state) {
    const { form } = state;
    if (form.querySelector(S.editor) || inputs(form).some(visible)) return;
    const height = getComputedStyle(form).height;
    if (!(parseFloat(height) > 0)) return;

    // Native rows remain focusable for insertion, but their extra height
    // stays inside the compact header until Gmail collapses them again.
    const style = form.style;
    const properties = [["height", height], ["overflow-x", "clip"], ["overflow-y", "clip"]];
    const previous = properties.map(([property]) => [style.getPropertyValue(property), style.getPropertyPriority(property)]);
    for (const [property, value] of properties) style.setProperty(property, value);
    const deadline = setTimeout(() => releaseHeaderLayout(state), 1500);
    state.restoreLayout = () => {
      clearTimeout(deadline);
      for (const [index, [property, value]] of properties.entries()) {
        if (style.getPropertyValue(property) === value && !style.getPropertyPriority(property)) {
          style.setProperty(property, ...previous[index]);
        }
      }
    };
  }

  function releaseIfCompact(state) {
    if (!inputs(state.form).some(visible) && recipientSummary(state.form)) releaseHeaderLayout(state);
  }

  function release(state) {
    clearTimeout(state.deadline);
    state.observer?.disconnect();
    state.form.removeEventListener("input", state.onInput);
    active.delete(state.form);
    releaseHeaderLayout(state);
    restoreHeaderFocus(state);
  }

  function finish(state, status) {
    if (status !== "closed" && status !== "stopped") { state.status = status; remember(state); }
    release(state);
  }

  function captureFocus() {
    const previous = document.activeElement;
    const inputSelection = previous instanceof HTMLInputElement && previous.selectionStart !== null
      ? [previous.selectionStart, previous.selectionEnd, previous.selectionDirection]
      : null;
    const selection = document.getSelection();
    const range = selection?.rangeCount ? selection.getRangeAt(0).cloneRange() : null;
    return {
      restore() {
        if (previous?.isConnected && document.activeElement !== previous) {
          previous.focus({ preventScroll: true });
          if (inputSelection && document.activeElement === previous && previous.selectionStart !== null) {
            previous.setSelectionRange(...inputSelection);
          } else if (range?.startContainer.isConnected && range.endContainer.isConnected) {
            selection.removeAllRanges();
            selection.addRange(range);
          }
        }
      }
    };
  }

  function restoreHeaderFocus(state) {
    const focus = state.headerFocus;
    state.headerFocus = null;
    const ownedFocus = focusOwner === state;
    if (ownedFocus) focusOwner = null;
    // A reply header activates on focus, with recipient rendering deferred by
    // Gmail. Restore only while focus is still in our addressing form, and only
    // if no real keyboard/pointer interaction has superseded this saved caret.
    const focused = document.activeElement;
    if (focus && (state.form.contains(focused) || focused === document.body)) focus.restore();
    if (ownedFocus) {
      // Drafts can become ready in the same mutation batch. Finish this
      // focus handoff before another draft starts its own.
      for (const pending of active.values()) if (pending.status === "pending") schedule(pending);
    }
  }

  function holdHeaderFocus(state) {
    focusOwner = state;
    const focused = document.activeElement;
    // Gmail may finish its initial editor autofocus after we expand a reply.
    if (!state.headerFocus || (focused?.matches(S.editor) && state.form.closest(S.region)?.contains(focused))) {
      state.headerFocus = captureFocus();
    }
  }

  function onUserInteraction(event) {
    if (!event.isTrusted) return;
    const form = event.target.closest?.(S.form);
    const state = active.get(form);
    if (state?.restoreLayout) releaseHeaderLayout(state);
    if (!focusOwner) return;
    focusOwner.headerFocus = null;
    restoreHeaderFocus(focusOwner);
  }

  function step(state) {
    state.scheduled = false;
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
      } else if (state.restoreLayout) {
        releaseIfCompact(state);
      }
      return;
    }
    if (!settings.autoBccEnabled || normalizeAddress(settings.bccAddress) !== state.address) {
      return finish(state, "cancelled");
    }
    try {
      if (state.attempted) {
        if (bccCommitted(state)) {
          state.status = "inserted";
          remember(state);
          clearTimeout(state.deadline);
          if (state.restoreLayout) releaseIfCompact(state);
          else observeRemoval(state);
        }
        return; // Never retry an attempted insertion, even if Gmail rejects it.
      }
      const recipientInputs = inputs(state.form);
      if (!recipientInputs.length) {
        if (state.revealed) restoreHeaderFocus(state);
        return;
      }
      if (hasRecipient(state.form, state.address)) {
        app.debug.log("bcc-already-present");
        return finish(state, "present");
      }
      if (focusOwner && focusOwner !== state) return;
      const bcc = [...state.form.querySelectorAll(S.bccInput)].filter(visible);
      if (bcc.length > 1) return finish(state, "ambiguous");
      if (bcc.length === 1) {
        // Do not overwrite uncommitted user text or hold focus while waiting for it.
        if (bcc[0].value.trim()) return restoreHeaderFocus(state);
        holdHeaderFocus(state);
        state.attempted = true; // Set BEFORE Gmail can synchronously mutate the DOM.
        remember(state);
        app.debug.log("bcc-insertion-attempted");
        if (document.activeElement !== bcc[0]) bcc[0].focus({ preventScroll: true });
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
        setter.call(bcc[0], state.address);
        bcc[0].dispatchEvent(new Event("input", { bubbles: true }));
        for (const type of ["keydown", "keyup"]) {
          bcc[0].dispatchEvent(new KeyboardEvent(type, {
            key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true, cancelable: true
          }));
        }
        restoreHeaderFocus(state);
        schedule(state);
        return;
      }
      const reveal = [...state.form.querySelectorAll(S.addBcc)].filter(visible);
      if (reveal.length === 1 && !state.revealed && recipientInputs.some(visible)) {
        holdHeaderFocus(state);
        state.revealed = true;
        // Keep the same return caret through both reveal and commit.
        reveal[0].click();
        schedule(state);
        return;
      }
      if (state.revealed) {
        // Gmail can render BCC later. Return focus now and let the observer
        // resume insertion when the input arrives.
        return restoreHeaderFocus(state);
      }
      const summary = !state.expanded && recipientSummary(state.form);
      if (summary) {
        holdHeaderFocus(state);
        holdHeaderLayout(state);
        state.expanded = true;
        summary.focus({ preventScroll: true });
        summary.click();
        schedule(state);
      }
    } catch {
      app.debug.log("bcc-selector-failure");
      finish(state, "failed");
    }
  }

  function schedule(state) {
    if (state.scheduled || active.get(state.form) !== state) return;
    // Finish ready controls before paint. The form observer resumes work if
    // Gmail creates the recipient UI in a later task.
    state.scheduled = true;
    queueMicrotask(() => {
      if (active.get(state.form) === state) step(state);
    });
  }

  function discover(form) {
    if (!running || !form?.matches(S.form) || !form.isConnected || seen.has(form) ||
        !form.querySelector(S.composeMarker)) return;
    for (const host of incompleteHosts.keys()) if (host.contains(form)) releaseHost(host);
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
    for (const host of incompleteHosts.keys()) if (!host.isConnected) releaseHost(host);
    for (const state of active.values()) if (!state.form.isConnected) {
      // Detachment itself is not recipient removal. Only compare retained chips
      // while the old form still has its recipient UI.
      if (state.status === "inserted" && inputs(state.form).length && !bccCommitted(state)) finish(state, "removed");
      else { remember(state); finish(state, "closed"); }
    }
  }

  function releaseHost(host) {
    const watch = incompleteHosts.get(host);
    if (!watch) return;
    watch.observer.disconnect();
    clearTimeout(watch.deadline);
    incompleteHosts.delete(host);
  }

  function watchIncompleteHost(host) {
    if (!host.matches('[role="dialog"]') || watchedHosts.has(host) || host.querySelector(S.composeForm)) return;
    watchedHosts.add(host);
    const observer = new MutationObserver(() => {
      if (!host.isConnected) return releaseHost(host);
      scan(host);
    });
    incompleteHosts.set(host, { observer, deadline: setTimeout(() => releaseHost(host), 5000) });
    observer.observe(host, { childList: true, subtree: true, attributes: true, attributeFilter: ['name'] });
    // Detect removal without observing unrelated document subtrees.
    for (let parent = host.parentElement; parent; parent = parent.parentElement) observer.observe(parent, { childList: true });
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
    if (focusOwner && !focusOwner.form.contains(event.target) &&
        !focusOwner.form.closest(S.region)?.contains(event.target)) {
      focusOwner.headerFocus = null;
      restoreHeaderFocus(focusOwner);
    }
    // Gmail may finish building its shell after document_idle. Recover the main
    // pane on the next focus event without a broad startup observer or polling.
    if (!main?.isConnected) {
      const nextMain = document.querySelector(S.main);
      if (nextMain) observeMain(nextMain);
    }
    const form = event.target.closest(S.form);
    const region = event.target.closest(S.region);
    if (form) discover(form);
    else if (region) scan(region);
    if (region) watchIncompleteHost(region.closest('[role="dialog"]') || region);
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
    for (const host of incompleteHosts.keys()) releaseHost(host);
    discovery.disconnect();
    document.removeEventListener("focusin", onFocus, true);
    document.removeEventListener("pointerdown", onUserInteraction, true);
    document.removeEventListener("keydown", onUserInteraction, true);
    for (const state of active.values()) finish(state, "stopped");
  }

  app.autoBcc = Object.freeze({ implemented: true, start, update, stop, normalizeAddress });
})();
