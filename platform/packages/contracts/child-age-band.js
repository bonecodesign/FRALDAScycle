export const CHILD_PROFILE_CONSENT_VERSION = "FC-CHILD-PROFILE-1";
export const CHILD_PROFILE_EMOJIS = Object.freeze(["🍼", "🧸", "⭐", "🌙", "🌈"]);

function utcDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new TypeError("Data de nascimento inválida.");
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new TypeError("Data de nascimento inválida.");
  return date;
}

export function childAgeBand(birthDate, referenceDate = new Date()) {
  const birth = utcDate(birthDate);
  const reference = new Date(referenceDate);
  if (Number.isNaN(reference.getTime()) || birth > reference) throw new RangeError("A data de nascimento não pode estar no futuro.");
  let months = (reference.getUTCFullYear() - birth.getUTCFullYear()) * 12 + reference.getUTCMonth() - birth.getUTCMonth();
  if (reference.getUTCDate() < birth.getUTCDate()) months -= 1;
  if (months < 0 || months >= 156) throw new RangeError("O perfil infantil deve representar uma pessoa de até 12 anos.");
  if (months < 3) return "newborn_0_2";
  if (months < 6) return "infant_3_5";
  if (months < 12) return "infant_6_11";
  if (months < 24) return "toddler_12_23";
  if (months < 36) return "toddler_24_35";
  return "child_36_plus";
}

export function childAgeDisplay(birthDate, referenceDate = new Date()) {
  const birth = utcDate(birthDate);
  const reference = new Date(referenceDate);
  if (Number.isNaN(reference.getTime()) || birth > reference) throw new RangeError("A data de nascimento não pode estar no futuro.");
  let months = (reference.getUTCFullYear() - birth.getUTCFullYear()) * 12 + reference.getUTCMonth() - birth.getUTCMonth();
  if (reference.getUTCDate() < birth.getUTCDate()) months -= 1;
  if (months < 0 || months >= 156) throw new RangeError("O perfil infantil deve representar uma pessoa de até 12 anos.");
  if (months < 24) return `${months} ${months === 1 ? "mês" : "meses"}`;
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  return remainingMonths === 0
    ? `${years} ${years === 1 ? "ano" : "anos"}`
    : `${years} ${years === 1 ? "ano" : "anos"} e ${remainingMonths} ${remainingMonths === 1 ? "mês" : "meses"}`;
}
