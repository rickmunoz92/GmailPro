/* Opt-in cross-feature suite: same assertions with the production skin active. */
if (new URLSearchParams(location.search).has("appearance")) {
  GmailPro.appearance.start({ appleMailModeEnabled: true, appearanceTheme: "dark", accentColor: "blue" });
}
