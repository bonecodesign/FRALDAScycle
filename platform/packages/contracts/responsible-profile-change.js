const FIELDS = new Set(["fullName", "birthDate"]);

function fail(code, message) {
  return Object.assign(new TypeError(message), { code, status: 422 });
}

function adultBirthDate(value, now) {
  const text = String(value ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw fail("invalid_birth_date", "Informe uma data de nascimento válida.");
  const [year, month, day] = text.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const reference = new Date(now);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day
      || Number.isNaN(reference.getTime()) || date > reference) {
    throw fail("invalid_birth_date", "Informe uma data de nascimento válida.");
  }
  let age = reference.getUTCFullYear() - year;
  if (reference.getUTCMonth() + 1 < month
      || (reference.getUTCMonth() + 1 === month && reference.getUTCDate() < day)) age -= 1;
  if (age < 18) throw fail("responsible_must_be_adult", "O responsável precisa ter 18 anos ou mais.");
  return text;
}

export function validateResponsibleProfileChange(input, { now = new Date() } = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)
      || Object.keys(input).some(key => !FIELDS.has(key))) {
    throw fail("invalid_responsible_profile_change", "A alteração solicitada é inválida.");
  }
  const fullName = String(input.fullName ?? "").trim().replace(/\s+/g, " ");
  if (fullName.length < 3 || fullName.length > 160 || fullName.split(" ").length < 2
      || /[\u0000-\u001f\u007f]/.test(fullName)) {
    throw fail("invalid_full_name", "Informe o nome completo.");
  }
  return Object.freeze({ fullName, birthDate: adultBirthDate(input.birthDate, now) });
}
