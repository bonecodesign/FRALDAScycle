export const ACCOUNT_CLOSURE_NOTICE_VERSION = "FC-ACCOUNT-CLOSURE-1";
const PROOF_MAX_AGE_MS = 10 * 60 * 1000;

function verifiedAt(value, userId, now) {
  const time = Date.parse(value?.verifiedAt ?? "");
  return value?.userId === userId && Number.isFinite(time) && time <= now && now - time <= PROOF_MAX_AGE_MS;
}

// Proof objects are server-derived. The public request must never be allowed to
// manufacture these booleans or timestamps from its JSON body.
export function validateAccountClosureRequest({ userId, input, securityProof, now = Date.now() }) {
  if (!userId || !input || typeof input !== "object" || Array.isArray(input)
    || Object.keys(input).some(key => !["confirmed", "noticeVersion", "idempotencyKey"].includes(key))
    || input.confirmed !== true || input.noticeVersion !== ACCOUNT_CLOSURE_NOTICE_VERSION
    || !/^[A-Za-z0-9._:-]{16,128}$/.test(String(input.idempotencyKey ?? ""))) {
    throw new Error("invalid_account_closure_request");
  }
  if (!verifiedAt(securityProof?.password, userId, now) || !verifiedAt(securityProof?.emailCode, userId, now)) {
    throw new Error("account_closure_step_up_required");
  }
  return Object.freeze({ userId, idempotencyKey: input.idempotencyKey, noticeVersion: input.noticeVersion });
}

export function validateAccountClosureSubmission(userId,input){
  if(!userId||!input||typeof input!=="object"||Array.isArray(input)
    ||Object.keys(input).some(key=>!["confirmed","noticeVersion","idempotencyKey","stepUpGrantId"].includes(key))
    ||input.confirmed!==true||input.noticeVersion!==ACCOUNT_CLOSURE_NOTICE_VERSION
    ||!/^[A-Za-z0-9._:-]{16,128}$/.test(String(input.idempotencyKey??""))
    ||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(input.stepUpGrantId??"")))throw new Error("invalid_account_closure_request");
  return Object.freeze({userId,idempotencyKey:input.idempotencyKey,noticeVersion:input.noticeVersion,stepUpGrantId:input.stepUpGrantId});
}

export function accountClosureProgress({ status, cancelUntil, obligations }, now = Date.now()) {
  const deadline = Date.parse(cancelUntil ?? "");
  if (!Number.isFinite(deadline)) throw new Error("invalid_account_closure_state");
  const pending = Object.entries(obligations ?? {}).filter(([, count]) => !Number.isSafeInteger(count) || count > 0).map(([kind]) => kind);
  const coolingOff = now < deadline;
  return Object.freeze({
    status,
    coolingOff,
    cancellable: status === "cooling_off" && coolingOff,
    eligibleForReview: status !== "cancelled" && !coolingOff && pending.length === 0,
    pendingObligations: Object.freeze(pending),
    automaticErasureAllowed: false,
  });
}
