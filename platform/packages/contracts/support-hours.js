const TIME_ZONE = "America/Sao_Paulo";
const formatter = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE,
  weekday: "short",
  hour: "2-digit",
  hourCycle: "h23",
});

export function internalSupportPolicy(at = new Date()) {
  const date = at instanceof Date ? at : new Date(at);
  if (!Number.isFinite(date.getTime())) throw new TypeError("Support policy requires a valid date");
  const parts = Object.fromEntries(formatter.formatToParts(date).map(part => [part.type, part.value]));
  const businessDay = ["Mon", "Tue", "Wed", "Thu", "Fri"].includes(parts.weekday);
  const hour = Number(parts.hour);
  const open = businessDay && hour >= 9 && hour < 18;
  return Object.freeze({
    timeZone: TIME_ZONE,
    schedule: "weekdays_09_18",
    open,
    queueState: open ? "within_service_hours" : "received_outside_service_hours",
    firstResponseTargetBusinessDays: 2,
    resolutionGuaranteed: false,
  });
}
