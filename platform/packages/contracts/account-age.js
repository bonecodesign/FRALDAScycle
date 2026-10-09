export const ADULT_DECLARATION_VERSION = "FC-AGE-1";

export function adultDeclaration(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new TypeError("Confirme que você tem 18 anos ou mais.");
  }
  const allowed = new Set(["confirmed", "version"]);
  if (Object.keys(input).some(key => !allowed.has(key)) || input.confirmed !== true || input.version !== ADULT_DECLARATION_VERSION) {
    throw new TypeError("Confirme que você tem 18 anos ou mais usando a versão atual.");
  }
  return Object.freeze({ confirmed: true, version: ADULT_DECLARATION_VERSION });
}
