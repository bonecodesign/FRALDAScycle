const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function exchangeDifferenceDispute({ supportTicketId, reason }) {
  const normalizedReason = String(reason ?? "").trim().replace(/\s+/g, " ");
  if (!UUID.test(String(supportTicketId ?? "")) || normalizedReason.length < 10 || normalizedReason.length > 1000) {
    throw new Error("invalid_exchange_difference_dispute");
  }
  return Object.freeze({ supportTicketId, reason: normalizedReason, status: "open", fundsFrozen: true });
}
