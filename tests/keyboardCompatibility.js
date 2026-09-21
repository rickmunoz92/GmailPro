(() => {
  const events = [], held = new Set();
  for (const type of ['keydown','keypress','keyup']) window.addEventListener(type, event => {
    const key = event.key.toLowerCase();
    if (!event.isTrusted || !event.metaKey || !event.shiftKey || event.ctrlKey || event.altKey || !['a','d'].includes(key)) return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (type === 'keydown' && !event.repeat && !held.has(key)) held.add(key);
    if (type === 'keyup') held.delete(key);
    events.push({type, key, trusted:event.isTrusted, cancelled:event.defaultPrevented});
    document.getElementById('results').textContent=JSON.stringify(events,null,2);
  }, {capture:true,passive:false});
})();
