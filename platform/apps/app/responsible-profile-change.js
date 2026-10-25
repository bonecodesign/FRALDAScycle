import { apiRequest, ApiError } from "/packages/contracts/api-client.js";
import { notify } from "/packages/ui/notify.js";

export function setupResponsibleProfileChange() {
  const heading = document.querySelector('[data-source-route="#/app/settings"] h1');
  if (!heading || document.getElementById("responsible-profile-change-form")) return;
  const section = document.createElement("section"); section.className = "phone-card";
  section.innerHTML = `<div><h2>Dados do responsável</h2><p>Alterar nome e nascimento exige sua senha e um código enviado ao e-mail verificado.</p>
    <form id="responsible-profile-change-form"><label>Nome completo<input class="input" name="fullName" required minlength="3" maxlength="160" autocomplete="name"></label><label>Data de nascimento<input class="input" name="birthDate" type="date" required autocomplete="bday"></label><label>Senha atual<input class="input" name="password" type="password" required minlength="12" maxlength="1024" autocomplete="current-password"></label><button class="button primary block" type="submit">Enviar código por e-mail</button></form>
    <form id="responsible-profile-change-confirm" hidden><label>Código de seis dígitos<input class="input" name="code" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" autocomplete="one-time-code" required></label><button class="button primary block" type="submit">Confirmar alteração</button><button class="button text" type="button" data-cancel-responsible-change>Cancelar</button></form><p id="responsible-profile-change-feedback" role="status" aria-live="polite"></p></div>`;
  heading.insertAdjacentElement("afterend", section);
  const form = section.querySelector("#responsible-profile-change-form");
  const confirmation = section.querySelector("#responsible-profile-change-confirm");
  const feedback = section.querySelector("#responsible-profile-change-feedback");
  let pending = null;
  const message = error => error instanceof ApiError ? error.message : "Não foi possível alterar os dados agora.";

  form.addEventListener("submit", async event => {
    event.preventDefault(); if (form.dataset.busy === "true") return;
    const change = { fullName: form.elements.fullName.value.trim(), birthDate: form.elements.birthDate.value };
    form.dataset.busy = "true"; form.querySelector('[type="submit"]').disabled = true; feedback.textContent = "Enviando código…";
    try {
      const result = await apiRequest("/v1/account/responsible-profile/change/request", { method: "POST",
        body: { password: form.elements.password.value, change } });
      if (!/^[A-Za-z0-9_-]{43}$/.test(result?.challenge ?? "")) throw new Error("invalid challenge");
      pending = { challenge: result.challenge, change }; form.elements.password.value = "";
      confirmation.hidden = false; confirmation.elements.code.focus();
      feedback.textContent = "Código enviado ao e-mail verificado. Ele vale por 15 minutos.";
    } catch (error) {
      form.elements.password.value = ""; pending = null; feedback.textContent = message(error);
    } finally { form.dataset.busy = "false"; form.querySelector('[type="submit"]').disabled = false; }
  });

  confirmation.addEventListener("submit", async event => {
    event.preventDefault(); if (!pending || confirmation.dataset.busy === "true") return;
    confirmation.dataset.busy = "true"; confirmation.querySelector('[type="submit"]').disabled = true;
    try {
      await apiRequest("/v1/account/responsible-profile/change/confirm", { method: "POST",
        body: { challenge: pending.challenge, code: confirmation.elements.code.value, change: pending.change } });
      pending = null; confirmation.reset(); confirmation.hidden = true; form.reset();
      feedback.textContent = "Nome e data de nascimento atualizados."; notify("Dados do responsável atualizados");
    } catch (error) {
      confirmation.elements.code.value = ""; feedback.textContent = message(error);
      if (error?.code === "too_many_attempts") { pending = null; confirmation.hidden = true; }
    } finally { confirmation.dataset.busy = "false"; confirmation.querySelector('[type="submit"]').disabled = false; }
  });
  section.querySelector("[data-cancel-responsible-change]").addEventListener("click", () => {
    pending = null; confirmation.reset(); confirmation.hidden = true; feedback.textContent = "Alteração cancelada neste dispositivo.";
  });
}

setupResponsibleProfileChange();
