export function buildResponsibleRegistrationPayload(fields, configuration) {
  const value = name => String(fields[name]?.value ?? "").trim();
  const password = String(fields.password?.value ?? "");
  if (password.length < 12 || password.trim().length < 12 || password !== String(fields.passwordConfirmation?.value ?? "")) {
    throw new TypeError("As senhas precisam ser iguais e ter pelo menos 12 caracteres.");
  }
  if (!fields.truthConfirmed?.checked || !fields.termsAccepted?.checked) {
    throw new TypeError("Confirme a veracidade dos dados e aceite os Termos de Uso.");
  }
  const noComplement = Boolean(fields.noComplement?.checked);
  const complement = value("complement");
  if ((!noComplement && !complement) || (noComplement && complement)) {
    throw new TypeError("Informe o complemento ou marque Sem complemento.");
  }
  const contact = value("contact");
  const contactPayload = contact.includes("@") ? { email: contact } : { phone: contact };
  return {
    displayName: value("displayName"),
    ...contactPayload,
    password,
    ...(value("pilotInvitationToken") ? { pilotInvitationToken: value("pilotInvitationToken") } : {}),
    responsible: {
      fullName: value("fullName"), cpf: value("cpf"), birthDate: value("birthDate"),
      address: {
        id: "signup-main", version: 1, postalCode: value("postalCode"),
        street: value("street"), number: value("number"), complement,
        noComplement, district: value("district"), city: value("city"), state: value("state"),
      },
      truthDeclaration: { confirmed: true, version: configuration.truthDeclarationVersion },
      terms: { accepted: true, version: configuration.terms.version, contentHash: configuration.terms.contentHash },
    },
  };
}

export async function setupResponsibleRegistration({ apiRequest, ApiError, notify }) {
  const legacy = document.getElementById("register-form");
  const form = document.getElementById("responsible-register-form");
  if (!legacy || !form) return;
  let configuration;
  try { configuration = await apiRequest("/v1/auth/registration-config"); }
  catch { return; }
  if (configuration?.enabled !== true || !configuration.terms?.version || !configuration.terms?.contentHash) return;

  legacy.hidden = true;
  form.hidden = false;
  form.querySelector("[data-terms-version]").textContent = configuration.terms.version;
  const steps = [...form.querySelectorAll("[data-registration-step]")];
  const showStep = index => steps.forEach((step, position) => { step.hidden = position !== index; });
  const error = form.querySelector(".field-error");
  const showError = message => { error.textContent = message; };
  const fields = Object.fromEntries([...form.elements].filter(item => item.name).map(item => [item.name, item]));

  form.querySelector("[data-next-step]").addEventListener("click", () => {
    const required = [fields.fullName, fields.cpf, fields.birthDate, fields.displayName, fields.contact, fields.password, fields.passwordConfirmation];
    if (required.some(field => !field.checkValidity())) return showError("Revise os dados pessoais antes de continuar.");
    if (fields.password.value !== fields.passwordConfirmation.value) return showError("As senhas precisam ser iguais.");
    showError(""); showStep(1); fields.postalCode.focus();
  });
  form.querySelector("[data-previous-step]").addEventListener("click", () => { showError(""); showStep(0); });

  const lookup = async () => {
    const postalCode = fields.postalCode.value.replace(/\D/g, "");
    if (postalCode.length !== 8) return showError("Informe um CEP com oito números.");
    try {
      const result = await apiRequest(`/v1/auth/registration-postal-code/${postalCode}`);
      for (const key of ["postalCode", "street", "district", "city", "state"])
        if (result.address?.[key] != null) fields[key].value = result.address[key];
      showError(""); notify("CEP confirmado", 1800);
    } catch (lookupError) {
      showError(lookupError instanceof ApiError ? lookupError.message : "Não foi possível consultar o CEP.");
    }
  };
  form.querySelector("[data-postal-lookup]").addEventListener("click", lookup);
  fields.postalCode.addEventListener("blur", () => { if (fields.postalCode.value.replace(/\D/g, "").length === 8) void lookup(); });
  fields.noComplement.addEventListener("change", () => {
    fields.complement.disabled = fields.noComplement.checked;
    if (fields.noComplement.checked) fields.complement.value = "";
  });

  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (form.dataset.busy === "true") return;
    let body;
    try { body = buildResponsibleRegistrationPayload(fields, configuration); }
    catch (validationError) { showError(validationError.message); return; }
    form.dataset.busy = "true";
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    showError("");
    try {
      const result = await apiRequest("/v1/auth/register", { method: "POST", body });
      if (!/^[A-Za-z0-9_-]{43}$/.test(result?.challenge ?? "")) throw new ApiError("invalid_auth_response", "Não foi possível iniciar a verificação.", 502);
      sessionStorage.setItem("fc.auth.verificationChallenge", result.challenge);
      sessionStorage.setItem("fc.auth.contact", fields.contact.value.trim());
      sessionStorage.setItem("fc.auth.mode", "verification");
      fields.password.value = ""; fields.passwordConfirmation.value = ""; fields.cpf.value = "";
      location.pathname = "/app/verify";
    } catch (submitError) {
      fields.password.value = ""; fields.passwordConfirmation.value = "";
      showError(submitError instanceof ApiError ? submitError.message : "Não foi possível concluir o cadastro.");
      form.dataset.busy = "false"; submit.disabled = false;
    }
  });
  showStep(0);
}
