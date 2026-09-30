/* Opt-in cross-feature suite: same assertions with the production skin active. */
if (new URLSearchParams(location.search).has("appearance")) {
  const appearanceTheme = new URLSearchParams(location.search).get("appearance") === "light" ? "light" : "dark";
  GmailPro.appearance.start({ appleMailModeEnabled: true, appearanceTheme, accentColor: "blue" });
}
