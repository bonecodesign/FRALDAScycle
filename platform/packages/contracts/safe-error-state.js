// Shared safety boundary for visible API failures in marketplace surfaces.
// Server/provider messages are untrusted text, never HTML or markup.
export function renderSafeErrorState(target, {
  heading = "Não foi possível concluir a solicitação",
  message = "Tente novamente em instantes.",
  onRetry = null,
} = {}) {
  const doc = target.ownerDocument;
  const panel = doc.createElement("div");
  panel.className = "ui-state error-state";
  panel.setAttribute("role", "alert");

  const title = doc.createElement("h2");
  title.textContent = heading;
  const detail = doc.createElement("p");
  detail.textContent = typeof message === "string" && message.trim()
    ? message.slice(0, 320)
    : "Tente novamente em instantes.";
  panel.append(title, detail);

  if (typeof onRetry === "function") {
    const retry = doc.createElement("button");
    retry.className = "button secondary";
    retry.type = "button";
    retry.textContent = "Tentar novamente";
    retry.addEventListener("click", onRetry, { once: true });
    panel.append(retry);
  }

  target.replaceChildren(panel);
  return panel;
}
