'use strict';

(() => {
  const upcomingSection = document.querySelector('[aria-labelledby="upcoming-releases"]');
  const upcoming = upcomingSection?.querySelector('.release-list');
  const released = document.querySelector('[aria-labelledby="store-releases"] > .release-list');
  if (!upcoming || !released) return;

  const releaseDay = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Denver', year: 'numeric', month: '2-digit', day: '2-digit'
  });
  const notes = [...upcoming.children, ...released.children].map(entry => ({
    entry, date: readDate(entry)
  }));
  const dated = notes.filter(note => note.date);
  const undated = notes.filter(note => !note.date);
  let renderedDay;
  let hasScheduledNotes;
  let timer;

  function readDate(entry) {
    const date = entry.querySelector('.release-meta time[datetime]')?.dateTime ?? '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return '';
    // Reject dates that JavaScript rolls into a different month.
    return new Date(date).toJSON()?.slice(0, 10) === date ? date : '';
  }

  function placeNotes(list, entries) {
    entries.forEach(({ entry }, index) => {
      const current = list.children.item(index);
      if (entry !== current) list.insertBefore(entry, current);
    });
  }

  function update() {
    clearTimeout(timer);
    const now = new Date();
    const { year, month, day } = Object.fromEntries(
      releaseDay.formatToParts(now).map(({ type, value }) => [type, value])
    );
    const today = `${year}-${month}-${day}`;

    if (today !== renderedDay) {
      const scheduled = dated.filter(note => note.date > today).sort((a, b) => a.date.localeCompare(b.date));
      const published = dated.filter(note => note.date <= today).sort((a, b) => b.date.localeCompare(a.date));
      const focused = document.activeElement;
      placeNotes(upcoming, [...scheduled, ...undated]);
      placeNotes(released, published);
      upcomingSection.hidden = upcoming.childElementCount === 0;
      if (focused?.isConnected && focused !== document.activeElement) focused.focus({ preventScroll: true });
      hasScheduledNotes = scheduled.length > 0;
      renderedDay = today;
    }

    // Check at the next minute boundary only while a dated release can move.
    if (hasScheduledNotes && !document.hidden) timer = setTimeout(update, 60_000 - now.getTime() % 60_000);
  }

  update();
  document.addEventListener('visibilitychange', update);
  window.addEventListener('pageshow', update);
})();
