'use strict';
// Deliberately blocked/corrupt tab storage must not prevent existing customers
// from opening billing management. Never contacts a real payment service.
Object.defineProperty(window,'sessionStorage',{get() {
  if (new URLSearchParams(location.search).get('storage') === 'corrupt') return { getItem: () => '{broken' };
  throw new Error('Storage blocked');
}});
window.fetch = async (url, options) => {
  const valid = url === '/api/billing/portal' && options.headers.Authorization === 'Bearer GP1.sub_demo.' + 'x'.repeat(43);
  document.getElementById('results').textContent = valid ? 'PASS manual management submits with unavailable purchase storage' : 'FAIL wrong management request';
  return Response.json({ error:'Synthetic portal boundary reached.' },{status:503});
};
