(() => {
  'use strict';
  const app = globalThis.GmailPro, R = app.labelRecency;
  const key = 'gmailPro.labelReminders.v1', origin = 'https://gmail.googleapis.com';
  const scope = 'https://www.googleapis.com/auth/gmail.readonly';
  const maxAge = 24 * 60 * 60 * 1000, failedAge = 5 * 60 * 1000, batchSize = 20;
  const ready = chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });
  let cached, loading, queue = Promise.resolve(), batch, controller, revision = 0, nextRequestAt = 0, scanTab;
  let options = { ...app.settings.defaults }, optionsRevision = 0;
  const optionChanges = new Map();
  const reviews = new Map(), clients = new Set();
  const empty = () => ({ account: '', labels: [], records: [], dismissed: [], catalogAt: 0, refreshAt: 0 });
  const configured = () => /^[\w-]+\.apps\.googleusercontent\.com$/.test(chrome.runtime.getManifest().oauth2?.client_id || '');
  const popup = sender => sender.id === chrome.runtime.id && sender.url === chrome.runtime.getURL('popup/popup.html');
  const gmail = sender => {
    try { return sender.id === chrome.runtime.id && sender.frameId === 0 && Number.isInteger(sender.tab?.id) &&
      new URL(sender.url).origin === 'https://mail.google.com'; } catch { return false; }
  };
  function cancel() { revision++; controller?.abort(); reviews.clear(); }
  const serial = work => { const pending = queue.then(work); queue = pending.catch(() => {}); return pending; };
  function validState(value) {
    if (!value || !app.settings.isValidEmail(value.account) || !Array.isArray(value.labels) || value.labels.length > 10003 ||
        !Array.isArray(value.records) || value.records.length > 10003 || !Array.isArray(value.dismissed) || value.dismissed.length > 10003) return false;
    const ids = new Set(value.labels.map(label => label?.id));
    return ids.size === value.labels.length && value.labels.every(label => label && typeof label.id === 'string' &&
      typeof label.name === 'string' && R.validPath(label.path) && ['user', 'system', 'view'].includes(label.type) &&
      (label.parentId === null || ids.has(label.parentId))) &&
      value.records.every(record => record && ids.has(record.id) && typeof record.known === 'boolean' &&
        (record.latestAt === null || (Number.isFinite(record.latestAt) && record.latestAt > 0)) &&
        (!record.known || (record.latestAt === null ? record.messageId === undefined : /^[a-zA-Z0-9_-]{1,200}$/.test(record.messageId || ''))) &&
        Number.isFinite(record.checkedAt) && record.checkedAt > 0) &&
      value.dismissed.every(record => record && ids.has(record.id) && typeof record.empty === 'boolean' &&
        [0, 3, 6, 12].includes(record.through) && (record.empty ? record.latestAt === null : Number.isFinite(record.latestAt)));
  }
  async function load() {
    await ready;
    if (cached) return cached;
    if (!loading) loading = chrome.storage.local.get(key).then(data => {
      const value = data[key];
      cached = validState(value) ? value : empty();
      return cached;
    }).finally(() => { loading = null; });
    return loading;
  }
  async function save(value) {
    if (new TextEncoder().encode(JSON.stringify(value)).length > 7 * 1024 * 1024) throw new Error('Label cache is too large.');
    await chrome.storage.local.set({ [key]: value }); cached = value;
  }
  function wait(ms, signal) {
    if (signal?.aborted) return Promise.reject(new DOMException('Cancelled', 'AbortError'));
    return new Promise((resolve, reject) => {
      const abort = () => { clearTimeout(timer); reject(new DOMException('Cancelled', 'AbortError')); };
      const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve(); }, ms);
      signal?.addEventListener('abort', abort, { once: true });
    });
  }
  async function raw(path, params, token, signal) {
    // Current Gmail quotas charge 20 units for metadata get, 5 for list, and
    // 1 for profile/labels. Reserve headroom below the 6,000 units/user/minute
    // limit instead of treating every HTTP request as equally cheap.
    const units = path.startsWith('messages/') ? 20 : path === 'messages' ? 5 : 1;
    const scheduled = Math.max(nextRequestAt, Date.now()); nextRequestAt = scheduled + units * 1000 / 80;
    await wait(Math.max(0, scheduled - Date.now()), signal);
    const url = new URL('/gmail/v1/users/me/' + path, origin);
    for (const [name, value] of Object.entries(params)) url.searchParams.set(name, String(value));
    const response = await fetch(url.href, { headers: { Authorization: 'Bearer ' + token }, credentials: 'omit',
      cache: 'no-store', redirect: 'error', signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]) });
    if (!response.ok) {
      const error = new Error(response.status === 401 ? 'Reconnect Google to continue.' : 'Could not check labels. Please try again.');
      error.status = response.status;
      const seconds = Number(response.headers.get('Retry-After'));
      error.retryAfter = Number.isFinite(seconds) ? Math.max(0, seconds * 1000) : 0;
      throw error;
    }
    const body = await response.text();
    try {
      const data = JSON.parse(body);
      if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Invalid response shape.');
      return data;
    } catch {
      const action = path === 'profile' ? 'verifying the Google account' : path === 'labels' ? 'reading labels' : 'checking label dates';
      throw Object.assign(new Error(`Google returned an unreadable response while ${action}. Please try again.`),
        { labelOnly: path === 'messages' || path.startsWith('messages/') });
    }
  }
  async function session(expected, interactive, signal) {
    if (!configured()) throw new Error('Google connection setup is required.');
    let result = await chrome.identity.getAuthToken({ interactive, scopes: [scope], enableGranularPermissions: true });
    let token = typeof result === 'string' ? result : result.token;
    if (!token || (result.grantedScopes && !result.grantedScopes.includes(scope))) throw new Error('Allow read-only Gmail access to check label dates.');
    let profile;
    try { profile = await raw('profile', { fields: 'emailAddress' }, token, signal); }
    catch (error) {
      if (error.status !== 401) throw error;
      await chrome.identity.removeCachedAuthToken({ token });
      result = await chrome.identity.getAuthToken({ interactive: false, scopes: [scope] });
      token = typeof result === 'string' ? result : result.token;
      profile = await raw('profile', { fields: 'emailAddress' }, token, signal);
    }
    const account = profile.emailAddress?.toLowerCase();
    if (!app.settings.isValidEmail(account)) throw new Error('Google did not return the connected account address. Please try again.');
    if (expected && account !== expected) throw new Error('The Google connection belongs to a different Gmail account.');
    return { account, token };
  }
  async function request(path, params, context, signal) {
    let renewed = false;
    for (let attempt = 0; ; attempt++) {
      try { return await raw(path, params, context.token, signal); }
      catch (error) {
        if (signal.aborted || error.name === 'AbortError') throw error;
        if (error.status === 401 && !renewed) {
          renewed = true; await chrome.identity.removeCachedAuthToken({ token: context.token });
          Object.assign(context, await session(context.account, false, signal)); continue;
        }
        const transient = !error.labelOnly && (!error.status || error.status === 429 || error.status >= 500);
        if (!transient || attempt >= 2 || error.retryAfter > 2000) throw error;
        await wait(Math.max(error.retryAfter || 0, 1000 * 2 ** attempt), signal);
      }
    }
  }
  async function refreshCatalog(state, context, signal) {
    const data = await request('labels', { fields: 'labels(id,name,type)' }, context, signal);
    if (!Array.isArray(data.labels)) throw new Error('Google did not return the label list. Please try again.');
    const labels = R.catalog(data.labels), ids = new Set(labels.map(label => label.id));
    return { ...state, labels, catalogAt: Date.now(), records: state.records.filter(record => ids.has(record.id)),
      dismissed: state.dismissed.filter(record => ids.has(record.id)) };
  }
  const recordsOf = state => new Map(state.records.filter(record => record && typeof record.id === 'string').map(record => [record.id, record]));
  const stale = (record, state, now) => !record || record.checkedAt < (state.refreshAt || 0) ||
    now - record.checkedAt >= (record.known ? maxAge : failedAge);
  function snapshot(state, message = {}) {
    const dismissed = new Map(state.dismissed.map(record => [record.id, record]));
    const records = recordsOf(state), rolled = R.rollup(state.labels, records), now = Date.now();
    const paths = Array.isArray(message.paths) ? new Set(message.paths.filter(R.validPath)) : null;
    const results = [];
    if (paths) for (const label of rolled.values()) {
      if (!paths.has(label.path)) continue;
      const candidate = R.suggestion(label, options, dismissed.get(label.id), now);
      if (candidate) results.push({ id: label.id, path: label.path, name: label.name, children: label.children,
        checkedAt: label.checkedAt, ...candidate });
    }
    const retryAt = Number.isFinite(state.retryAt) ? state.retryAt : 0;
    const nextCheckAt = Math.max(retryAt, Math.min(state.catalogAt ? state.catalogAt + maxAge : now,
      ...state.records.map(record => record.checkedAt + (record.known ? maxAge : failedAge))));
    return { configured: configured(), connected: !!state.account, account: state.account, enabled: R.enabled(options), nextCheckAt, retryAt,
      catalogAt: state.catalogAt, pending: R.enabled(options) ? state.labels.filter(label => stale(records.get(label.id), state, now)).length : 0,
      total: state.labels.length, results };
  }
  function branch(state, path) {
    const root = state.labels.find(label => label.path === path);
    if (!root) throw new Error('This label changed. Refresh Gmail and try again.');
    const ids = new Set([root.id]);
    // API hierarchy is built once; descendants sort after their parents.
    for (const label of [...state.labels].sort((a, b) => a.name.length - b.name.length)) {
      if (ids.has(label.parentId)) ids.add(label.id);
    }
    return ids;
  }
  async function scan(message, sender, review, expectedRevision) {
    let state = await load();
    if (expectedRevision !== revision) throw new DOMException('Cancelled', 'AbortError');
    if (!state.account || !R.enabled(options)) return snapshot(state, message);
    scanTab = gmail(sender) ? sender.tab.id : null;
    const epoch = revision, signal = (controller = new AbortController()).signal;
    const context = await session(state.account, false, signal);
    if (message.force || (review && !message.reviewId) || !state.catalogAt || Date.now() - state.catalogAt >= maxAge) {
      state = await refreshCatalog(state, context, signal);
      if (message.force) state = { ...state, refreshAt: Date.now() };
    }
    let verification;
    if (review) {
      if (message.reviewId) {
        verification = reviews.get(message.reviewId);
        if (!verification || verification.tab !== sender.tab.id || verification.path !== message.path || verification.revision !== epoch) {
          throw new Error('This check expired. Open the label suggestion again.');
        }
        // Refresh the catalog only when starting the check, not for every chunk.
      } else {
        const id = crypto.randomUUID();
        verification = { id, path: message.path, tab: sender.tab.id, at: Date.now(), revision: epoch };
        reviews.set(id, verification);
        while (reviews.size > 20) reviews.delete(reviews.keys().next().value);
      }
    }
    const records = recordsOf(state), ids = verification ? branch(state, message.path) : null;
    const needed = state.labels.filter(label => (!ids || ids.has(label.id)) && (verification ?
      !records.get(label.id)?.known || records.get(label.id).checkedAt < verification.at : stale(records.get(label.id), state, Date.now())));
    const priorities = new Set(Array.isArray(message.paths) ? message.paths.filter(R.validPath) : []);
    needed.sort((a, b) => Number(priorities.has(b.path)) - Number(priorities.has(a.path)));
    const chunk = needed.slice(0, batchSize), metadata = new Map();
    for (const record of records.values()) if (record.known && record.messageId && Number.isFinite(record.latestAt)) {
      metadata.set(record.messageId, Promise.resolve({ internalDate: record.latestAt }));
    }
    let cursor = 0, failed = false;
    const worker = async () => {
      while (cursor < chunk.length) {
        const label = chunk[cursor++], previous = records.get(label.id);
        try {
          const params = { maxResults: 1, fields: 'messages(id),resultSizeEstimate', includeSpamTrash: label.type === 'view' ? label.includeSpamTrash : true };
          if (label.type === 'view') { if (label.query) params.q = label.query; }
          else params.labelIds = label.id;
          const data = await request('messages', params, context, signal);
          if (data.messages !== undefined && (!Array.isArray(data.messages) || data.messages.length > 1 ||
              (data.messages.length && typeof data.messages[0]?.id !== 'string'))) throw Object.assign(new Error('Invalid message metadata.'), { labelOnly: true });
          const id = data.messages?.[0]?.id;
          if (id === undefined && data.resultSizeEstimate !== 0) throw Object.assign(new Error('Google did not confirm this label is empty.'), { labelOnly: true });
          let latestAt = null;
          if (id !== undefined) {
            if (!/^[a-zA-Z0-9_-]{1,200}$/.test(id)) throw Object.assign(new Error('Invalid message identity.'), { labelOnly: true });
            if (previous?.known && previous.messageId === id) latestAt = previous.latestAt;
            else {
              if (!metadata.has(id)) metadata.set(id, request('messages/' + encodeURIComponent(id),
                { format: 'metadata', fields: 'internalDate' }, context, signal));
              const detail = await metadata.get(id); latestAt = Number(detail.internalDate);
              if (!Number.isFinite(latestAt) || latestAt <= 0) throw Object.assign(new Error('Invalid message date.'), { labelOnly: true });
            }
          }
          records.set(label.id, { id: label.id, known: true, latestAt, ...(id ? { messageId: id } : {}), checkedAt: Date.now() });
        } catch (error) {
          if (signal.aborted || (!error.labelOnly && ![400, 404].includes(error.status))) throw error;
          failed = true; records.set(label.id, { id: label.id, known: false, latestAt: null, checkedAt: Date.now() });
        }
      }
    };
    const workers = Array.from({ length: Math.min(4, chunk.length) }, worker);
    try { await Promise.all(workers); }
    catch (error) { controller.abort(); await Promise.allSettled(workers); throw error; }
    if (signal.aborted || epoch !== revision) throw new DOMException('Cancelled', 'AbortError');
    const rolled = R.rollup(state.labels, records);
    const dismissed = state.dismissed.filter(record => {
      const label = rolled.get(record.id);
      return !label?.known || label.latestAt === null || (!record.empty && label.latestAt <= record.latestAt);
    });
    state = { ...state, records: [...records.values()], dismissed, retryAt: 0 }; await save(state);
    const result = snapshot(state, message);
    if (verification) {
      const remaining = [...ids].filter(id => !records.get(id)?.known || records.get(id).checkedAt < verification.at);
      if (failed) { reviews.delete(verification.id); throw new Error('Could not verify every child label. Nothing was hidden.'); }
      result.reviewId = verification.id; result.reviewPending = remaining.length;
      if (!remaining.length) {
        result.reviewed = true;
        result.candidate = result.results.find(candidate => candidate.path === message.path) || null;
        reviews.delete(verification.id);
      }
    }
    if (failed) result.notice = 'Some labels could not be checked. Their suggestions remain paused.';
    return result;
  }
  async function notify() {
    const message = { type: 'gmail-pro-label-reminders-changed' };
    const tabs = await chrome.tabs.query({});
    await Promise.allSettled([chrome.runtime.sendMessage(message), ...tabs.map(tab => chrome.tabs.sendMessage(tab.id, message))]);
  }
  async function handle(message, sender) {
    if (!popup(sender) && !gmail(sender)) throw new Error('Unauthorized request.');
    const entryRevision = revision;
    if (!(await globalThis.GmailProConsentWorker.status()).accepted) throw new Error('Open Gmail Pro and review the current disclosure first.');
    if (entryRevision !== revision) throw new DOMException('Cancelled', 'AbortError');
    const settingsRead = optionsRevision, loadedOptions = await app.settings.load();
    options = { ...loadedOptions, ...Object.fromEntries([...optionChanges]
      .filter(([, change]) => change.revision > settingsRead).map(([name, change]) => [name, change.value])) };
    if (entryRevision !== revision) throw new DOMException('Cancelled', 'AbortError');
    let state = await load();
    if (entryRevision !== revision) throw new DOMException('Cancelled', 'AbortError');
    if (gmail(sender) && message.action !== 'detach' && (!app.settings.isValidEmail(message.account) || message.account.toLowerCase() !== state.account)) {
      return { configured: configured(), connected: !!state.account, mismatch: !!state.account, results: [], pending: 0 };
    }
    if (message.action === 'status') return snapshot(state, message);
    if (message.action === 'detach') { if (gmail(sender)) reviews.forEach((value, id) => { if (value.tab === sender.tab.id) reviews.delete(id); }); return {}; }
    if (message.action === 'connect') {
      if (!popup(sender)) throw new Error('Open Gmail Pro to connect Google.');
      if (!await chrome.permissions.contains({ origins: [origin + '/*'] })) throw new Error('Allow the Google API connection first.');
      cancel(); const signal = (controller = new AbortController()).signal;
      const context = await session('', true, signal);
      state = context.account === state.account ? state : { ...empty(), account: context.account };
      await save(state); await notify(); return snapshot(state, message);
    }
    if (message.action === 'disconnect') {
      if (!popup(sender)) throw new Error('Open Gmail Pro to disconnect Google.');
      cancel(); await chrome.identity.clearAllCachedAuthTokens(); await save(empty()); await notify(); return snapshot(cached, message);
    }
    if (!state.account || !R.enabled(options)) return snapshot(state, message);
    if (!await chrome.permissions.contains({ origins: [origin + '/*'] })) throw new Error('Reconnect Google to continue.');
    if (message.action === 'scan' || message.action === 'review') {
      if (message.action === 'review' && (!gmail(sender) || !R.validPath(message.path))) throw new Error('Invalid label check.');
      if (message.action === 'scan' && !message.force && state.retryAt > Date.now()) return snapshot(state, message);
      const epoch = revision;
      try { return await scan(message, sender, message.action === 'review', epoch); }
      catch (error) {
        if (error.name !== 'AbortError' && epoch === revision && (await globalThis.GmailProConsentWorker.status()).accepted) {
          error.retryAt = Date.now() + Math.max(failedAge, error.retryAfter || 0);
          try { await save({ ...await load(), retryAt: error.retryAt }); } catch { /* Preserve the original actionable error. */ }
        }
        throw error;
      } finally { scanTab = null; }
    }
    if (message.action === 'dismiss') {
      if (!gmail(sender) || !R.validPath(message.path)) throw new Error('Invalid label dismissal.');
      const rolled = R.rollup(state.labels, recordsOf(state)), label = [...rolled.values()].find(row => row.path === message.path);
      const candidate = R.suggestion(label, options, state.dismissed.find(record => record.id === label?.id));
      if (!candidate) return snapshot(state, message);
      const dismissed = state.dismissed.filter(record => record.id !== label.id);
      dismissed.push({ id: label.id, ...R.dismissal(candidate) });
      await save({ ...state, dismissed }); await notify(); return snapshot(cached, message);
    }
    throw new Error('Unknown label reminder action.');
  }
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (message?.type !== 'gmail-pro-label-reminders') return;
    if (popup(sender) && ['disconnect', 'connect'].includes(message.action)) cancel();
    if (gmail(sender)) {
      if (message.action === 'detach' || (cached?.account && message.account !== cached.account)) {
        clients.delete(sender.tab.id);
        if (!clients.size && scanTab === sender.tab.id) cancel();
      } else if (['status', 'scan', 'review'].includes(message.action)) clients.add(sender.tab.id);
    }
    // Identical refreshes share one chunk. Reviews and explicit mutations are serialized.
    let pending;
    if (message.action === 'scan' && batch && !message.force && gmail(sender)) {
      pending = batch.then(() => serial(() => handle({ ...message, action: 'status' }, sender)));
    } else {
      pending = serial(() => handle(message, sender));
      if (message.action === 'scan') {
        const current = pending; batch = current;
        current.finally(() => { if (batch === current) batch = null; }).catch(() => {});
      }
    }
    pending.then(result => respond({ ok: true, ...result }), error => {
      const message = error.name === 'AbortError' ? 'Label check paused.' :
        /service has been disabled for this account/i.test(error.message || '') ?
          'Google blocked this account’s connection. Work accounts may need administrator approval for Gmail access. This only affects label reminders; other Gmail Pro features still work.' :
          error.message || 'Could not check labels.';
      respond({ ok: false, ...(error.retryAt ? { retryAt: error.retryAt } : {}), error: message });
    });
    return true;
  });
  app.settings.subscribe(patch => {
    optionsRevision++;
    for (const [name, value] of Object.entries(patch)) optionChanges.set(name, { value, revision: optionsRevision });
    Object.assign(options, patch); if (!R.enabled(options)) cancel();
  });
  chrome.storage.onChanged.addListener((changes, area) => { if (area === 'local' && changes['gmailPro.consent.v1']) cancel(); });
  const releaseTab = id => { clients.delete(id); if (!clients.size && scanTab === id) cancel(); };
  chrome.tabs.onRemoved?.addListener(releaseTab);
  chrome.tabs.onUpdated?.addListener((id, change) => { if (change.status === 'loading') releaseTab(id); });
})();
