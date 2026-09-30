# Gmail Pro repository workflow

## Canonical checkout

- Work in `~/Documents/GmailPro` (`/Users/rmunoz/Documents/GmailPro`). Chrome loads this exact directory as its unpacked extension.
- Make all Gmail Pro source edits, tests, commits and pushes in this checkout. Do not develop in the separate copy under `~/Documents/ChatGPT/Gmail Pro/GmailPro` or copy production files between the two directories.
- If a task starts in the separate copy, use the canonical checkout as the working directory for all repository operations.

## GitHub publishing

- GitHub repository: `https://github.com/rickmunoz92/GmailPro.git`.
- In the canonical checkout, `origin` is this GitHub repository and local `main` tracks `origin/main`.
- When the user asks to commit and push, commit the requested local changes with a descriptive conventional commit message and push them to GitHub `main` from this checkout.
- Fetch and check the remote state before publishing. Preserve concurrent remote work; never force-push or discard uncommitted changes. Verify the remote commit and final local status.
- Keep generated browser captures, recovery files and credentials out of commits.

## Validation

- Run `node scripts/validate.cjs` and the relevant synthetic browser fixtures for the change. Report any blocked checks accurately.
- After changing content scripts or styles, Chrome may require extension Reload followed by a Gmail refresh. The extension's loaded folder stays `~/Documents/GmailPro`.
