export const PILOT_ID = /^[a-z][a-z0-9-]*$/;

export function isDateString(value) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}
