# Compose shortcut verification — 2026-09-21

## Behavior

- Command-R: native Chrome refresh; Shift-Command-R: Reply All; Shift-Command-F: Forward.
- Two independent versioned preferences default on. Save preferences applies them.
- The existing conversation owner resolves the open conversation afresh. The existing
  persistent toolbar delegates to native Gmail controls; without that toolbar, the
  visible native thread footer supplies the action. Sticky footer precedence matches
  the reading-pane controller. Bulk checkbox selections do not guess a reply target.
- Native click handling preserves floating/inline preferences, native recipient and
  quotation handling, and Auto BCC. No new composer ownership, listeners, observers,
  permissions, background service, timers, or network calls were added.
- Enabled combinations stay reserved even when no action is available. Editors,
  composers, menus, and dialogs never create another draft or fall through to reload.
  Disabled switches restore the browser keys. Native Gmail shortcuts stay available.
- Gmail may focus a page-level proxy after closing a draft. Replies continue to use
  the visible current conversation instead of requiring focus inside its DOM subtree.

## Compatibility and limits

Native macOS keystrokes in Chrome were intercepted for the two added combinations.
The harmless compatibility fixture retained its contents, recorded trusted canceled
events, and did not reload or change the browser's presentation.

Command-N is reserved by Chrome: it opened a new browser window and delivered no N
keydown to the page. Command-Option-N likewise opened Chrome's split-view chooser.
Both test surfaces were closed afterward. No substitute new-message binding is shipped.
Gmail's own C shortcut remains the available New Message shortcut when its keyboard
shortcuts are enabled. No macOS or Gmail preference was changed for this feature.

The Gmail app window was held by another task's browser session, so a new app-window
check was not performed for this change. Prior Archive/Send/Undo app-window checks do
not count as validation of these new combinations.

## Results

183 automated checks passed: settings 31, keyboard shortcuts 71, popup 18, floating
composer 33, and reading pane 30. Coverage includes native/footer bridge paths,
floating preferences on/off, missing and ambiguous actions, navigation, page-level
focus after draft close, editable/overlay exclusions, repeat suppression, exact
modifiers, independent settings, native shortcut fallback, and lifecycle teardown.

With the installed extension in live Gmail, Reply All and Forward each created one
native floating draft with the BCC field present. Created test drafts were discarded;
preexisting drafts were untouched, and no email was sent. After removing the proposed
Command-R Reply binding at the user’s request, a real Command-R keystroke completed
a native Gmail page reload with no draft created. Synthetic regression checks confirm
all Command-R event phases remain untouched in conversations, search, and composers. Temporary content-free key-routing diagnostics
were removed from the installed controller before the final live Forward/Reply All tests.

Reload Gmail Pro and refresh existing Gmail windows to load the changes. The supported
selectors are for English desktop Gmail on Mac. Unknown layouts leave the enabled
shortcut inactive rather than guessing another message or action.
