const THEME_SCRIPT = `
(function () {
  try {
    var key = "discursiva-ai-preferencias";
    var saved = window.localStorage.getItem(key);
    var theme = "system";

    if (saved) {
      var parsed = JSON.parse(saved);

      if (
        parsed &&
        (parsed.tema === "light" ||
          parsed.tema === "dark" ||
          parsed.tema === "system")
      ) {
        theme = parsed.tema;
      }
    }

    var prefersDark =
      window.matchMedia &&
      window.matchMedia(
        "(prefers-color-scheme: dark)"
      ).matches;

    var useDark =
      theme === "dark" ||
      (theme === "system" && prefersDark);

    document.documentElement.classList.toggle(
      "dark",
      useDark
    );

    document.documentElement.dataset.theme =
      theme;
  } catch {
    document.documentElement.classList.remove(
      "dark"
    );
  }
})();
`;

export function ThemeBootstrap() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: THEME_SCRIPT,
      }}
    />
  );
}
