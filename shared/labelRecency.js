(() => {
  'use strict';
  const app = (globalThis.GmailPro ??= {});
  if (app.labelRecency) return;
  const months = Object.freeze([3, 6, 12]);
  const setting = month => `labelReminder${month}MonthsEnabled`;
  const routes = Object.freeze({ INBOX: 'inbox', SENT: 'sent', DRAFT: 'drafts', STARRED: 'starred',
    IMPORTANT: 'important', SPAM: 'spam', TRASH: 'trash', UNREAD: 'unread',
    CATEGORY_PERSONAL: 'category/personal', CATEGORY_SOCIAL: 'category/social',
    CATEGORY_PROMOTIONS: 'category/promotions', CATEGORY_UPDATES: 'category/updates', CATEGORY_FORUMS: 'category/forums' });
  const views = Object.freeze([
    Object.freeze({ id: 'view/all', name: 'All Mail', path: 'mailbox/all', query: '', includeSpamTrash: false }),
    Object.freeze({ id: 'view/snoozed', name: 'Snoozed', path: 'mailbox/snoozed', query: 'in:snoozed', includeSpamTrash: false }),
    Object.freeze({ id: 'view/scheduled', name: 'Scheduled', path: 'mailbox/scheduled', query: 'in:scheduled', includeSpamTrash: false })
  ]);
  const mailboxPaths = Object.freeze([...Object.values(routes).map(route => 'mailbox/' + route), ...views.map(view => view.path)]);
  const enabled = settings => months.some(month => settings[setting(month)] === true);
  const validPath = path => typeof path === 'string' && path.length <= 1024 &&
    ((path.startsWith('label/') && path.length > 6) || mailboxPaths.includes(path));
  function sidebarPath(hash) {
    try {
      let route = decodeURIComponent(hash.replace(/^#/, '').replace(/\+/g, ' '));
      if (route.startsWith('label/')) return validPath(route) ? route : null;
      if (route === 'imp') route = 'important';
      if (route === 'category/primary') route = 'category/personal';
      return mailboxPaths.includes('mailbox/' + route) ? 'mailbox/' + route : null;
    } catch { return null; }
  }
  function catalog(raw) {
    if (!Array.isArray(raw) || raw.length > 10000) throw new Error('Invalid label catalog.');
    const labels = [], ids = new Set(), names = new Map();
    for (const source of raw) {
      if (!source || !/^[a-zA-Z0-9_-]{1,200}$/.test(source.id) || typeof source.name !== 'string' ||
          !source.name.length || source.name.length > 1018 || !['user', 'system'].includes(source.type) || ids.has(source.id)) {
        throw new Error('Invalid label catalog.');
      }
      ids.add(source.id);
      if (source.type === 'system' && !Object.hasOwn(routes, source.id)) continue;
      const label = { id: source.id, name: source.name, type: source.type,
        path: source.type === 'user' ? 'label/' + source.name : 'mailbox/' + routes[source.id], parentId: null };
      labels.push(label);
      if (source.type === 'user') names.set(source.name, label);
    }
    for (const label of labels) {
      if (label.type !== 'user') continue;
      let prefix = label.name;
      while (prefix.includes('/')) {
        prefix = prefix.slice(0, prefix.lastIndexOf('/'));
        if (names.has(prefix)) { label.parentId = names.get(prefix).id; break; }
      }
    }
    return [...labels, ...views.map(view => ({ ...view, type: 'view', parentId: null }))];
  }
  function rollup(labels, records) {
    const result = new Map(labels.map(label => {
      const own = records.get(label.id);
      return [label.id, { ...label, children: 0, known: own?.known === true,
        latestAt: own?.known === true ? own.latestAt : null, checkedAt: own?.checkedAt || 0 }];
    }));
    // Descendants have longer paths. Iteration avoids a recursion-depth limit.
    for (const label of [...result.values()].sort((a, b) => b.name.length - a.name.length)) {
      const parent = result.get(label.parentId);
      if (!parent) continue;
      parent.children++;
      parent.known &&= label.known;
      parent.checkedAt = Math.min(parent.checkedAt, label.checkedAt);
      if (label.latestAt !== null) parent.latestAt = Math.max(parent.latestAt || 0, label.latestAt);
    }
    return result;
  }
  function anniversary(timestamp, count) {
    const date = new Date(timestamp), day = date.getDate();
    date.setDate(1); date.setMonth(date.getMonth() + count);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    date.setDate(Math.min(day, end)); return date.getTime();
  }
  function suggestion(label, settings, dismissed, now = Date.now()) {
    if (!enabled(settings) || !label?.known) return null;
    if (label.latestAt === null) {
      return !label.children && !dismissed?.empty ? { kind: 'empty', milestone: 0, latestAt: null } : null;
    }
    const through = !dismissed?.empty && dismissed?.latestAt >= label.latestAt ? dismissed.through || 0 : 0;
    const milestone = months.filter(month => settings[setting(month)] === true && month > through &&
      now >= anniversary(label.latestAt, month)).at(-1);
    return milestone ? { kind: 'age', milestone, latestAt: label.latestAt } : null;
  }
  function dismissal(candidate) {
    return candidate.kind === 'empty' ? { empty: true, latestAt: null, through: 0 } :
      { empty: false, latestAt: candidate.latestAt, through: candidate.milestone };
  }
  const api = Object.freeze({ months, setting, enabled, validPath, sidebarPath, catalog, rollup, anniversary,
    suggestion, dismissal, mailboxPaths });
  app.labelRecency = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})();
