const themeStates = ["auto", "light", "dark"];
let themeIndex = 0;

export function initTheme() {
  const saved = localStorage.getItem("theme");
  if (saved === "light" || saved === "dark") {
    themeIndex = themeStates.indexOf(saved);
    document.documentElement.setAttribute("data-theme", saved);
  }
}

export function toggleTheme() {
  themeIndex = (themeIndex + 1) % themeStates.length;
  const next = themeStates[themeIndex];
  if (next === "auto") {
    document.documentElement.removeAttribute("data-theme");
    localStorage.removeItem("theme");
  } else {
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
  }
}
