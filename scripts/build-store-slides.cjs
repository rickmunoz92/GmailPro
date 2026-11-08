'use strict';

// Developer-only listing artwork. Reuse the website's feature icons/titles and
// approved screenshots of the real extension with fictional mail. Never ship
// this source or generated artwork inside the extension ZIP.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const version = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'))).version;
const output = path.join(root, 'artifacts/store', version);
const website = fs.readFileSync(path.join(root, 'website/public/index.html'), 'utf8');
const features = new Map([...website.matchAll(/<section class="feature-card">([\s\S]*?)<\/section>/g)].map(([, html]) => {
  const title = /<h3>(.*?)<\/h3>/.exec(html)?.[1];
  const icon = /<svg[^>]*>([\s\S]*?)<\/svg>/.exec(html)?.[1];
  if (!title || !icon) throw new Error('Unrecognized website feature card');
  return [title, icon];
}));
const slides = [
  {
    name: '01-cleaner-gmail', title: 'A cleaner way to use Gmail.',
    subtitle: 'Less clutter. More room to read. Your existing inbox, with more control.', theme: 'light',
    cards: [
      ['Newest-first conversations', 'Start with the latest reply, right at the top of an opened conversation.'],
      ['Message-only zoom', 'Read at 80–200% while your toolbar and sidebar keep their size. macOS shortcuts.'],
      ['Desktop-style layout', 'A compact list, a roomy reading pane, and collapsible header and app rails.'],
      ['System, light and dark themes', 'Follow your system or choose your look, with eight accent colors.']
    ]
  },
  {
    name: '02-your-inbox-your-way', title: 'Your inbox. Your organization.',
    subtitle: 'Put your labels where you want them—and keep moving through your mail.', theme: 'dark',
    cards: [
      ['Custom label order', 'Reorder top-level labels. Move sublabels or hide a branch from the sidebar.'],
      ['One-click filing', 'Click an Inbox label badge to mark read and archive, keeping its labels.'],
      ['Automatic page changes', 'Keep scrolling at either list edge to move to the next or previous page.']
    ]
  },
  {
    name: '03-keep-your-momentum', title: 'Keep your momentum.',
    subtitle: 'Reply, act, and get back to your inbox with useful controls close by.', theme: 'light',
    cards: [
      ['Floating replies by default', 'Open Reply, Reply All and Forward in Gmail’s native floating composer.'],
      ['Keyboard shortcuts', 'Archive, Trash, read/unread, Send, Undo and more. Individually configurable on macOS.'],
      ['Message actions in reach', 'Keep supported Reply, Reply All, Forward and reaction actions in the toolbar.'],
      ['Visible Undo Send notice', 'See Gmail’s sent notice and Undo action even with the header collapsed.']
    ]
  },
  {
    name: '04-see-what-matters', title: 'See what matters. Skip the clutter.',
    subtitle: 'A clearer conversation list and search that feels at home in your theme.', theme: 'dark',
    cards: [
      ['Two-line conversation list', 'Sender and subject on separate lines, with unread dots and accent selection.'],
      ['Readable search controls', 'Compact toolbar search and theme-aware highlights. Clear search to return to your mailbox.'],
      ['Dates and times in the list', 'Today, Yesterday, or a full date and time—right beside the conversation.']
    ]
  },
  {
    name: '05-the-useful-details', title: 'The details make the difference.',
    subtitle: 'Thoughtful tools for the everyday parts of email.', theme: 'light',
    cards: [
      ['Automatic BCC', 'Add one chosen address to new mail, replies and forwards. Off by default.'],
      ['Clear recipient details', 'See separate To, CC and BCC lines for recipients Gmail makes available.'],
      ['Click to copy an address', 'Copy an available sender or recipient address straight from the message header.'],
      ['Immediate read state', 'Mark the matching conversation read when it opens in the right reading pane.']
    ]
  }
];
const escape = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
fs.mkdirSync(output, { recursive: true });
for (const [index, slide] of slides.entries()) {
  const cards = slide.cards.map(([title, description]) => {
    if (!features.has(title)) throw new Error('Website feature missing: ' + title);
    return `<article><span class="icon"><svg viewBox="0 0 24 24" aria-hidden="true">${features.get(title)}</svg></span><h2>${escape(title)}</h2><p>${escape(description)}</p></article>`;
  }).join('');
  const html = `<!doctype html><html lang="en"><meta charset="utf-8"><title>Gmail Pro — ${escape(slide.title)}</title>
<style>
*{box-sizing:border-box}html,body{margin:0;width:1280px;height:800px;overflow:hidden}body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#f4f7fc;color:#152b4a}.slide{height:800px;padding:30px 36px 22px;display:flex;flex-direction:column}.brand{display:flex;align-items:center;gap:10px;font-size:20px;font-weight:750;color:#173354}.brand img{width:30px;height:30px;border-radius:8px}.brand em{font-style:normal;color:#007aff}.page{margin-left:auto;color:#60718a;font-size:13px;font-weight:600;letter-spacing:1px}h1{font-size:48px;line-height:1.08;letter-spacing:-1.9px;margin:22px 0 10px;font-weight:760}.subtitle{font-size:20px;line-height:1.4;color:#536680;margin:0 0 22px}.screen{height:300px;flex:0 0 300px;overflow:hidden;border:1px solid #d8dfe9;border-radius:11px;background:white;box-shadow:0 12px 28px #152b4a0d}.screen img{width:calc(100% + 20px);display:block;height:auto}.cards{display:grid;grid-template-columns:repeat(${slide.cards.length},minmax(0,1fr));gap:14px;margin-top:20px;flex:1;min-height:0}article{background:#fff;border:1px solid #dfe5ef;border-radius:10px;padding:17px 18px 15px;position:relative}.icon{width:30px;height:30px;display:grid;place-items:center;background:#edf4ff;border-radius:7px;margin-bottom:10px}.icon svg{width:19px;height:19px;fill:none;stroke:#007aff;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}h2{font-size:20px;line-height:1.2;letter-spacing:-.35px;margin:0 0 8px;font-weight:720}article p{font-size:16px;line-height:1.4;margin:0;color:#51627b}.foot{display:flex;align-items:center;justify-content:space-between;margin-top:15px;flex:0 0 16px;color:#65758b;font-size:11px}.foot strong{color:#3c5576;font-weight:600}
</style><main class="slide"><div class="brand"><img src="/icons/icon128.png" alt=""><span>Gmail <em>Pro</em></span><span class="page">${String(index + 1).padStart(2, '0')} / 05</span></div><h1>${escape(slide.title)}</h1><p class="subtitle">${escape(slide.subtitle)}</p><div class="screen"><img src="/website/public/assets/gmail-pro-${slide.theme}.jpg" alt="Actual Gmail Pro interface with fictional demo messages; cropped view."></div><section class="cards">${cards}</section><footer class="foot"><span>Actual extension · Fictional mailbox · Cropped view</span><strong>English desktop Gmail · Independent of Google and Apple</strong></footer></main></html>`;
  fs.writeFileSync(path.join(output, slide.name + '.html'), html);
}
fs.writeFileSync(path.join(output, 'slides.json'), JSON.stringify(slides, null, 2) + '\n');
console.log(`Prepared ${slides.length} listing slides (${slides.reduce((n, s) => n + s.cards.length, 0)} feature cards) in ${output}`);
