const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function pilotBhConfig(env) {
  if (env.PILOT_BH_ENABLED != null && !["true", "false"].includes(env.PILOT_BH_ENABLED)) {
    throw new Error("PILOT_BH_ENABLED must be true or false");
  }
  if (env.PILOT_BH_ENABLED !== "true") return Object.freeze({ enabled: false, invitedEmails: Object.freeze([]) });
  const invitedEmails = String(env.PILOT_BH_INVITED_EMAILS ?? "")
    .split(",").map(value => value.trim().toLowerCase()).filter(Boolean);
  if (invitedEmails.length === 0 || invitedEmails.some(email => !EMAIL_PATTERN.test(email)) ||
      new Set(invitedEmails).size !== invitedEmails.length) {
    throw new Error("PILOT_BH_INVITED_EMAILS must contain unique valid invited emails when the BH pilot is enabled");
  }
  return Object.freeze({ enabled: true, invitedEmails: Object.freeze(invitedEmails) });
}

export function pilotBhInvited(pilot, email) {
  return !pilot?.enabled || (typeof email === "string" && pilot.invitedEmails.includes(email.trim().toLowerCase()));
}

export function pilotBhLocation(pilot, city, state) {
  if (!pilot?.enabled) return true;
  const normalizedCity = String(city ?? "").trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return normalizedCity === "belo horizonte" && String(state ?? "").trim().toUpperCase() === "MG";
}

export function pilotBhPostalCode(pilot, postalCode) {
  if (!pilot?.enabled) return true;
  const digits = String(postalCode ?? "").replace(/\D/g, "");
  return /^\d{8}$/.test(digits) && Number(digits) >= 30000000 && Number(digits) <= 31999999;
}
