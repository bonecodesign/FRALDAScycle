const RESPONSES = new Set(["agree", "contest"]);

export function exchangeDisputeResponse({ response, statementReference }) {
  const reference = String(statementReference ?? "").trim();
  if (!RESPONSES.has(response) || reference.length < 3 || reference.length > 200 || /[\r\n]/.test(reference)) {
    throw new Error("invalid_exchange_dispute_response");
  }
  return Object.freeze({ response, statementReference: reference });
}
