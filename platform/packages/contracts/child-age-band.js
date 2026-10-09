export const CHILD_PROFILE_CONSENT_VERSION = "FC-CHILD-PROFILE-1";

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
  if (months < 0 || months >= 216) throw new RangeError("O perfil infantil deve representar uma pessoa menor de 18 anos.");
  if (months < 3) return "newborn_0_2";
  if (months < 6) return "infant_3_5";
  if (months < 12) return "infant_6_11";
  if (months < 24) return "toddler_12_23";
  if (months < 36) return "toddler_24_35";
  return "child_36_plus";
}
