(async () => {
  "use strict";
  const output = document.getElementById("results"), reports = [];
  const assert = (value, message) => { if (!value) throw new Error(message); };
  const settle = async () => { for (let i = 0; i < 8; i++) await new Promise(requestAnimationFrame); };
  const owned = '[data-gmail-pro-retention-probe="host"]';
  function fixture({ reuse = false, dispose = false, late = false } = {}) {
    const mount = document.getElementById("fixture-host"), owners = [], opens = [], selections = [];
    function page(first) {
      const main = document.createElement("div"); main.setAttribute("role", "main");
      main.innerHTML = `<div class="Di"><div role="button" aria-label="Show more messages"><span class="ts">${first}</span>–<span class="ts">${first + 49}</span> of 150</div><div role="button" aria-label="Older" aria-disabled="${first === 101}">Next results</div></div><div class="panes"><div class="Nu tf"><div class="ae4"><table role="grid"><tbody></tbody></table></div></div><div class="Nu S3">Synthetic reading pane</div></div>`;
      const root = main.querySelector('.Nu.tf'), body = root.querySelector('tbody');
      for (let i = first; i < first + 50; i++) {
        const row = document.createElement("tr"); row.setAttribute("role", "row");
        row.innerHTML = `<td><button role="checkbox" aria-checked="false">Select ${i}</button></td><td><div role="link"><span data-thread-id="synthetic-${i}" data-legacy-thread-id="legacy-${i}">Synthetic conversation ${i}</span></div></td>`;
        body.append(row);
      }
      const handler = event => {
        const checkbox = event.target.closest('[role="checkbox"]'), link = event.target.closest('[role="link"]');
        if (checkbox) { checkbox.setAttribute('aria-checked', String(checkbox.getAttribute('aria-checked') !== 'true')); selections.push(first); }
        if (link) opens.push(first);
      };
      root.addEventListener('click', handler); owners.push({ root, handler });
      main.querySelector('[aria-label="Older"]').addEventListener('click', () => {
        const advance = () => {
          if (reuse) {
            root.querySelectorAll('[data-thread-id]').forEach((node, index) => node.setAttribute('data-thread-id', `replacement-${index}`));
            return;
          }
          if (dispose) for (const owner of owners) owner.root.removeEventListener('click', owner.handler);
          mount.replaceChildren(page(first + 50));
        };
        if (!late) advance();
      });
      return main;
    }
    mount.replaceChildren(page(1));
    return { owners, opens, selections };
  }
  // Each case uses a fresh iframe, so production-style singleton bootstrapping
  // and stop behavior are exercised without a test reset API in the probe.
  async function test(name, query) {
    try {
      if (query) {
        const frame = document.createElement('iframe'); frame.style.cssText = 'width:900px;height:700px';
        frame.src = `endlessScrollProbe.html?case=${query}`;
        document.body.append(frame);
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('fixture deadline')), 20000);
          const listener = event => {
            if (event.source !== frame.contentWindow || event.data?.case !== query) return;
            clearTimeout(timeout); window.removeEventListener('message', listener);
            if (event.data.error) reject(new Error(event.data.error)); else resolve();
          };
          window.addEventListener('message', listener);
        });
        frame.remove();
      }
      reports.push(`PASS ${name}`);
    } catch (error) { reports.push(`FAIL ${name}: ${error.message}`); }
    output.textContent = reports.join('\n');
  }
  const selected = new URLSearchParams(location.search).get('case');
  if (selected) {
    try {
      const f = fixture({ reuse: selected === 'reused-owner', dispose: selected === 'disposed-owner', late: selected === 'stop-pending' });
      await settle();
      const probe = GmailPro.retentionProbe;
      probe.loadNext(); await settle();
      if (selected === 'reused-owner') {
        assert(document.querySelector('[data-gmail-pro-retention-probe="controls"]').dataset.result === 'retention-failed', 'reused native rows fail the gate');
      } else if (selected === 'stop-pending') {
        probe.stop(); await settle();
        assert(!document.querySelector(owned) && f.owners[0].root.closest('#fixture-host'), 'pending cleanup restores the current native subtree');
      } else {
        probe.loadNext(); await settle();
        const rows = document.querySelectorAll(`${owned} tr[role="row"]`);
        assert(rows.length === 150 && new Set([...rows].map(row => row.querySelector('[data-thread-id]').getAttribute('data-thread-id'))).size === 150, 'three distinct retained batches');
        assert([...document.querySelector(owned).children].every((root, index) => root === f.owners[index].root), 'original page subtrees, never clones');
        rows[0].querySelector('[role="link"]').click(); rows[0].querySelector('[role="checkbox"]').click();
        if (selected === 'disposed-owner') {
          assert(f.opens.length === 0 && f.selections.length === 0, 'intact DOM does not prove native actions survived disposal');
        } else {
          assert(f.opens.join() === '1' && f.selections.join() === '1', 'first-batch delegated handlers survive reparenting');
          if (selected === 'cleanup') {
            probe.stop(); await settle();
            assert(!document.querySelector(owned) && f.owners[2].root.closest('#fixture-host'), 'stop restores the latest native page');
          }
        }
      }
      parent.postMessage({ case: selected }, location.origin);
    } catch (error) { parent.postMessage({ case: selected, error: error.message }, location.origin); }
    return;
  }
  GmailPro.retentionProbe.stop();
  await test('50 → 100 → 150 retains original subtrees and first-batch delegated handlers', 'retained-handlers');
  await test('Gmail recycling a retained native owner fails the retention gate', 'reused-owner');
  await test('Gmail disposing a controller can leave 150 intact but inert rows', 'disposed-owner');
  await test('stopping during a pending load restores the native subtree', 'stop-pending');
  await test('stopping after three batches restores the latest native page', 'cleanup');
  output.dataset.failed = String(reports.filter(line => line.startsWith('FAIL')).length);
  output.dataset.passed = String(reports.filter(line => line.startsWith('PASS')).length);
  output.textContent += `\n${output.dataset.passed}/${reports.length} passed`;
})();
