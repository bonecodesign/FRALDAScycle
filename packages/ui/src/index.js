import tokens from "./tokens.json" with { type: "json" };

export { tokens };

export function applyStoredTheme({ storage = globalThis.localStorage, root = globalThis.document?.documentElement } = {}) {
  if (!root) return "light";
  const theme = storage?.getItem("fraldacycle-theme") === "dark" ? "dark" : "light";
  root.dataset.theme = theme;
  return theme;
}

export function setTheme(theme, { storage = globalThis.localStorage, root = globalThis.document?.documentElement } = {}) {
  const normalized = theme === "dark" ? "dark" : "light";
  if (root) root.dataset.theme = normalized;
  storage?.setItem("fraldacycle-theme", normalized);
  return normalized;
}
