'use strict';
const preview = document.getElementById('product-preview');
for (const button of document.querySelectorAll('[data-preview-theme]')) {
  button.addEventListener('click', () => {
    const theme = button.dataset.previewTheme;
    if (!preview || !['light', 'dark'].includes(theme)) return;
    preview.src = '/assets/gmail-pro-' + theme + '.jpg';
    preview.alt = 'Actual Gmail Pro in ' + theme + ' mode, showing fictional labels, a compact inbox and an open launch-checklist conversation.';
    for (const option of document.querySelectorAll('[data-preview-theme]'))
      option.setAttribute('aria-pressed', String(option === button));
  });
}
