(() => {
  const events = [];
  for (const type of ['keydown','keypress','keyup']) window.addEventListener(type, event => {
    const key = event.key.toLowerCase();
    const match = ['a','d','f'].includes(key) ? event.shiftKey : ['z','n'].includes(key) ? !event.shiftKey : key === 'r';
    if (!event.isTrusted || !event.metaKey || event.ctrlKey || (event.altKey && key !== 'n') || !match) return;
    event.preventDefault(); event.stopImmediatePropagation();
    events.push({type, key, shift:event.shiftKey, alt:event.altKey, ctrl:event.ctrlKey, repeat:event.repeat, trusted:event.isTrusted, cancelled:event.defaultPrevented});
    document.getElementById('results').textContent=JSON.stringify(events,null,2);
  }, {capture:true,passive:false});
})();
