// Synthetic preview only; never included in the extension package.
if (location.hostname !== '127.0.0.1') throw new Error('Local fixture only');
if (new URLSearchParams(location.search).get('availability') !== 'disabled') GmailPro.labelRecency = Object.freeze({ ...GmailPro.labelRecency, available: true });
