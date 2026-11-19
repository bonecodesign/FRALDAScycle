const TIME_ZONE = "America/Sao_Paulo";
const formatter = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE,
  weekday: "short",
  hour: "2-digit",
  hourCycle: "h23",
});
// Founder approval (14/11): these are first-response targets by classification,
// not guaranteed resolution or proof of staffed service.
const FIRST_RESPONSE_TARGETS = Object.freeze({
  critical: Object.freeze({ minutes: 30 }),
  high: Object.freeze({ hours: 4 }),
  normal: Object.freeze({ businessDays: 1 }),
  low: Object.freeze({ businessDays: 2 }),
});

export function internalSupportPolicy(at = new Date()) {
  const date = at instanceof Date ? at : new Date(at);
  if (!Number.isFinite(date.getTime())) throw new TypeError("Support policy requires a valid date");
  const parts = Object.fromEntries(formatter.formatToParts(date).map(part => [part.type, part.value]));
  const businessDay = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].includes(parts.weekday);
  const hour = Number(parts.hour);
  const open = businessDay && hour >= 8 && hour < 20;
  return Object.freeze({
    timeZone: TIME_ZONE,
    schedule: "monday_saturday_08_20",
    open,
    queueState: open ? "within_service_hours" : "received_outside_service_hours",
    firstResponseTargets: FIRST_RESPONSE_TARGETS,
    staffedServiceVerified: false,
    resolutionGuaranteed: false,
  });
}
