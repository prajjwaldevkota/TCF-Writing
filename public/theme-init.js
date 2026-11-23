try {
  var savedMode = localStorage.getItem("tcf_color_mode_v1");
  var colorMode =
    savedMode === "dark" || savedMode === "light"
      ? savedMode
      : window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
  document.documentElement.dataset.theme = colorMode;
  document.documentElement.style.colorScheme = colorMode;
} catch {
  document.documentElement.dataset.theme = "light";
}
