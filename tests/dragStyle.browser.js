/* Regression instrumentation stays in this synthetic page, never the extension. */
(() => {
  'use strict';
  const root = document.documentElement, results = document.getElementById('results');
  root.className = 'gmail-pro-apple-mail-mode';
  root.dataset.gpTheme = 'dark'; root.dataset.gpAccent = 'blue';
  const labels = document.getElementById('labels'), rows = document.getElementById('rows');
  labels.innerHTML = Array.from({length:300}, (_, i) => `<div class="aim"><div class="TO"><div class="TN"><div class="aio"><span class="nU"><a class="n0" href="#label/synthetic-${i}">Synthetic ${i}</a></span></div></div></div></div>`).join('');
  rows.innerHTML = Array.from({length:75}, () => '<tr class="zA"><td class="yX">Synthetic sender</td><td class="a4W"><div class="xS"><span class="bog">Synthetic thread</span></div></td></tr>').join('');
  const retained = document.getElementById('retained'), preview = document.querySelector('.lE');
  const frame = () => new Promise(resolve => requestAnimationFrame(resolve));
  const median = values => [...values].sort((a,b) => a-b)[Math.floor(values.length/2)];
  function growTo(count) {
    const fragment = document.createDocumentFragment();
    while (retained.childElementCount < count) {
      const panel = document.createElement('div'); panel.className = 'iY';
      panel.innerHTML = '<h2 data-thread-perm-id="synthetic" data-legacy-thread-id="synthetic">Synthetic subject</h2><div class="gE"><span class="g3">Synthetic header</span></div><div class="ii"><div class="a3s"><div><span>Authored synthetic content</span><a href="#synthetic">Link</a></div><table><tbody><tr><td>Cell</td></tr></tbody></table></div></div>';
      // Fragment count cannot drive a loop before it is attached.
      fragment.append(panel);
      if (retained.childElementCount + fragment.childElementCount >= count) break;
    }
    retained.append(fragment);
  }
  function measure(enabled, iterations) {
    root.classList.toggle('gmail-pro-apple-mail-mode', enabled);
    document.body.style.cursor = '';
    preview.offsetWidth; // Exclude mode switching from the cursor samples.
    const samples = [];
    for (let i=0; i<iterations; i++) {
      const start = performance.now();
      document.body.style.cursor = i % 2 ? 'grabbing' : 'default';
      preview.style.visibility = 'hidden';
      preview.style.position = 'absolute';
      preview.style.display = 'block';
      preview.offsetWidth; preview.offsetHeight;
      preview.style.display = '';
      preview.style.position = '';
      preview.style.visibility = '';
      samples.push(performance.now() - start);
    }
    document.body.style.cursor = '';
    preview.offsetWidth;
    return {medianMs: +median(samples).toFixed(2), maxMs: +Math.max(...samples).toFixed(2)};
  }
  document.getElementById('run').addEventListener('click', async event => {
    const button = event.currentTarget; button.disabled = true;
    const report = {comparison:baseline, labels:300, rows:75, stages:[]};
    let styles;
    try {
      styles = await stylesReady;
      retained.replaceChildren();
      for (const count of (params.has('quick') ? [500] : [0, 500, 2000])) {
        growTo(count);
        await frame();
        const stage={retainedPanels:count, elements:document.querySelectorAll('*').length};
        // Compare in the same page/process. Loading or switching a sheet is
        // outside the samples; the two orders limit warmup/thermal bias.
        for (const name of (baseline ? ['baseline','current','current','baseline'] : ['current'])) {
          for (const [key,style] of Object.entries(styles)) style.disabled = key !== name;
          await frame();
          measure(true, 2); measure(false, 2);
          const on=measure(true, 12), off=measure(false, 12);
          (stage[name] ||= []).push({modeOn:on, modeOff:off});
        }
        report.stages.push(stage);
        results.textContent = JSON.stringify(report,null,2);
      }
      report.status='complete';
    } catch(error) { report.error=error.message; }
    finally {
      if(styles) for(const [key,style] of Object.entries(styles)) style.disabled = key !== 'current';
      root.classList.add('gmail-pro-apple-mail-mode');
      results.textContent=JSON.stringify(report,null,2);
      button.disabled=false;
    }
  });
})();
