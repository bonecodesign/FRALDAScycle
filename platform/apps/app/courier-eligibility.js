import { apiRequest } from "/packages/contracts/api-client.js";

const panel = document.getElementById("courier-eligibility");
const feedback = document.getElementById("courier-eligibility-feedback");
const actions = document.getElementById("courier-eligibility-actions");
const refresh = document.getElementById("courier-refresh");

const actionLabels = {
  identity: "Concluir verificação de identidade",
  adult: "Confirmar maioridade",
  contacts: "Confirmar e-mail e telefone",
  vehicle: "Regularizar veículo e habilitação",
  payout: "Verificar conta de recebimento",
  terms: "Aceitar os termos atuais do entregador",
  admin: "Aguardar aprovação administrativa",
  clearance: "Enviar ou renovar o atestado da Polícia Civil",
  support: "Contatar o suporte para solicitar liberação",
};

function date(value) {
  const parsed = typeof value === "string" ? new Date(value) : null;
  return parsed && Number.isFinite(parsed.getTime()) ? parsed : null;
}

function addAction(key) {
  const text = actionLabels[key];
  if (!text) return;
  const item = document.createElement("p");
  item.textContent = "• " + text;
  actions.append(item);
}

function validate(result) {
  const value = result?.eligibility;
  if (!value?.profile || typeof value.profile.account_status !== "string") {
    throw new Error("Não foi possível confirmar a situação do cadastro.");
  }
  return value;
}

function render(result) {
  const value = validate(result);
  const { profile, vehicle, clearance, review, suspension } = value;
  const now = Date.now();
  const supportDue = date(suspension?.support_due_at)?.getTime();
  const supervisorDue = date(suspension?.supervisor_due_at)?.getTime();
  const suspended = suspension?.status === "suspended" || profile.account_status === "suspended";
  const priority = suspended && Number.isFinite(supportDue) && now >= supportDue &&
    (!Number.isFinite(supervisorDue) || now <= supervisorDue);
  const provisional = review?.status === "pending" && review.review_kind === "renewal" &&
    (date(review.due_at)?.getTime() ?? 0) > now && !suspended;
  const eligible = profile.account_status === "active" && !suspended;
  actions.replaceChildren();

  if (priority) feedback.textContent = "Em análise prioritária. Novas ofertas permanecem bloqueadas.";
  else if (suspended) feedback.textContent = "Cadastro suspenso. Novas ofertas estão bloqueadas até a regularização.";
  else if (provisional) feedback.textContent = "Renovação em análise. Liberação provisória válida até o prazo exibido no processo.";
  else if (eligible) feedback.textContent = "Cadastro elegível para receber novas ofertas.";
  else feedback.textContent = "Cadastro com pendências. Regularize os itens abaixo para receber novas ofertas.";

  if (profile.identity_status !== "verified") addAction("identity");
  if (!profile.adult_confirmed_at) addAction("adult");
  if (!profile.email_verified_at || !profile.phone_verified_at) addAction("contacts");
  if (vehicle?.status !== "approved" ||
      (vehicle?.vehicle_type === "motorcycle" && vehicle.driver_license_status !== "verified")) addAction("vehicle");
  if (profile.payout_status !== "verified") addAction("payout");
  if (profile.terms_version !== "FC-COURIER-1" || !profile.terms_accepted_at) addAction("terms");
  if (profile.admin_approval_status !== "approved") addAction("admin");
  const expiresAt = date(clearance?.expires_at)?.getTime();
  if (!provisional && (clearance?.status !== "verified" || !Number.isFinite(expiresAt) || expiresAt <= now)) addAction("clearance");
  else if (Number.isFinite(expiresAt) && expiresAt > now && expiresAt - now <= 7 * 24 * 60 * 60 * 1000) {
    const notice = document.createElement("p");
    notice.textContent = "Seu atestado vence em até 7 dias. Envie a renovação para evitar bloqueio.";
    actions.append(notice);
  }
  if (suspended) {
    addAction("support");
    const button = document.createElement("button");
    button.type = "button"; button.className = "button secondary block";
    button.textContent = "Solicitar análise do suporte";
    button.addEventListener("click", requestSupportRelease);
    actions.append(button);
  }
  panel.setAttribute("aria-busy", "false");
}

async function requestSupportRelease(event) {
  const button = event.currentTarget;
  button.disabled = true;
  try {
    const result = await apiRequest("/v1/courier/eligibility/support-release", {
      method: "POST", body: { requestReference: "courier-support:" + crypto.randomUUID() },
      signal: AbortSignal.timeout(15000),
    });
    feedback.textContent = result.supportRequest?.reused
      ? "Sua solicitação já está em análise."
      : "Solicitação enviada ao suporte. Prazo inicial: até 24 horas.";
  } catch (error) {
    feedback.textContent = error.message || "Não foi possível solicitar a análise.";
    button.disabled = false;
  }
}

async function loadEligibility() {
  panel.setAttribute("aria-busy", "true");
  try {
    render(await apiRequest("/v1/courier/eligibility", { signal: AbortSignal.timeout(15000) }));
  } catch (error) {
    actions.replaceChildren();
    panel.setAttribute("aria-busy", "false");
    feedback.textContent = error.code === "courier_eligibility_disabled"
      ? "A validação do cadastro ainda não foi ativada. Suas entregas já atribuídas continuam disponíveis."
      : error.message || "Não foi possível consultar a situação do cadastro.";
  }
}

refresh?.addEventListener("click", loadEligibility);
void loadEligibility();
