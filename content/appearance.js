(() => {
  "use strict";
  const app = (globalThis.GmailPro ??= {});
  if (app.appearance) return;

  const marker = "gmail-pro-apple-mail-mode";
  let current = { ...app.settings.defaults };
  let bootstrap;
  let media;

  function apply() {
    if (!current.appleMailModeEnabled) return;
    const root = document.documentElement;
    if (!root) return;
    bootstrap?.disconnect();
    bootstrap = undefined;
    root.classList.add(marker);
    root.dataset.gpTheme = current.appearanceTheme === "system"
      ? (media.matches ? "dark" : "light") : current.appearanceTheme;
    root.dataset.gpAccent = current.accentColor;
  }

  function stop() {
    current.appleMailModeEnabled = false;
    bootstrap?.disconnect();
    bootstrap = undefined;
    media?.removeEventListener("change", apply);
    media = undefined;
    const root = document.documentElement;
    if (!root) return;
    root.classList.remove(marker);
    delete root.dataset.gpTheme;
    delete root.dataset.gpAccent;
  }

  function update(patch = {}) {
    for (const name of ["appleMailModeEnabled", "appearanceTheme", "accentColor"]) {
      if (Object.hasOwn(patch, name)) current[name] = patch[name];
    }
    if (!current.appleMailModeEnabled) return stop();
    // Only follow OS changes while needed. No observers of rows or message bodies,
    // listeners on Gmail controls, layout reads, navigation state, or timers.
    if (current.appearanceTheme === "system" && !media) {
      media = matchMedia("(prefers-color-scheme: dark)");
      media.addEventListener("change", apply);
    } else if (current.appearanceTheme !== "system" && media) {
      media.removeEventListener("change", apply);
      media = undefined;
    }
    if (document.documentElement) apply();
    else if (!bootstrap) {
      bootstrap = new MutationObserver(apply);
      bootstrap.observe(document, { childList: true });
    }
  }

  app.appearance = Object.freeze({ start: update, update, stop });
})();
