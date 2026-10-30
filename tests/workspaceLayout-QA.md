# Workspace layout and shared Gmail navigation — October 29, 2026

`workspaceLayout.js` owns the initial right reading pane and the independent
left Mail/Chat/Meet and right Workspace rail preferences. Both rails default to
collapsed. The left control is an accessible native button; the right control
delegates to Gmail's existing button. Failed preference saves restore the prior
view and report the failure.

Mailbox navigation is identified by its structure. Gmail uses `.WR` on both
classic mailbox navigation and the integrated app rail, so the class alone
cannot decide which owner to hide or theme. The classic mailbox sidebar remains
visible. Header, label discovery and message-list filing use the same selector.

For a verified account without a recorded manual layout choice, the controller
selects Gmail's native vertical split and applies reversible 25/75 flex weights.
Native minimum widths still apply. The original weights restore on mode OFF
unless a real native resize has taken ownership. Opening and canceling the split
menu or clicking the divider without moving does not count as a choice. Actual
native mode selections or divider drags take priority on later starts.

The existing settings adapter stores one boolean per hashed-account Sync key,
without pane dimensions or message data. Separate account keys avoid a shared
read/merge/write race. Unknown accounts, ambiguous controls and unsupported
layouts retain native behavior. Startup waits and observers are bounded; stable
chrome is observed without watching message bodies indefinitely.

Run `workspaceLayout.html` in foreground Chrome. The 12 automated scenarios cover
defaults, delayed chrome, saved layouts, independent preferences, storage failure,
rail/pane replacement, native minima, classic `.WR` navigation, ambiguity and idle
cleanup. The trusted-input fixtures require real browser input:

- `?manual=1`: choose native No split before releasing the delayed preference
  read, then restart. The real choice must survive the stale read and save once.
- `?cancel=1`: open the split menu, press Escape, click the divider without
  moving and disable the mode. Native 80/20 weights must restore with no marker.

Current automated result: 12/12 passed, plus both trusted-input scenarios. The
appearance fixture passed 76/76 checks, including both themes, all accents,
uniform tag markers, delivery-summary text/icons, the expanded Show less footer,
sharp unread counts, native click handlers and message/editor boundaries.
Header/sidebar, label-filing and label-order runs passed 116/116, 97/97 and 50/50
checks respectively. A read-only source review
found no remaining major correctness issues.

Live Chrome verification uses the canonical unpacked extension in both profiles.
Wait for extension Reload to complete before refreshing Gmail. Personal Gmail
uses masked icon slots; work Gmail uses SVG slots. Both display the same tag
silhouette and preserve the selected accent. The work sidebar is 216px including
its border, with the wordmark and Mailboxes heading restored. Saved native pane
choices remain respected. No messages were sent or labels changed for these
appearance checks.

Final October 30 verification: personal Light displayed crisp, shadow-free
counts and clean bitmap tag markers. The temporary Light check was followed by
restoring Dark/Blue. The work app was refreshed after its extension reload and
confirmed the final count token and removal of the native shadow. Private local
crops record the Light result; they are not public marketing assets.

The Chrome Web Store and Stripe activation remain deferred by the owner. Browser
fixtures cover inspected English desktop layouts, not every future Gmail variant.
