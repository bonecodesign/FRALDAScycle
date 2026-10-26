import assert from "node:assert/strict";
import test from "node:test";
import { accountClosureProgress, validateAccountClosureRequest } from "../packages/contracts/account-closure.js";
import { createAccountClosureService } from "../apps/api/account-closure-service.js";
import { createAccountClosureRepository } from "../database/account-closure-repository.js";
import { newOperationsAllowed, requireNewOperations } from "../database/moderation-repository.js";

const userId = "11111111-1111-4111-8111-111111111111";
const requestId = "22222222-2222-4222-8222-222222222222";
const now = Date.parse("2030-01-01T12:00:00Z");
const input = { confirmed: true, noticeVersion: "FC-ACCOUNT-CLOSURE-1", idempotencyKey: "closure-request-0001" };
const proof = {
  password: { userId, verifiedAt: "2030-01-01T11:55:00Z" },
  emailCode: { userId, verifiedAt: "2030-01-01T11:56:00Z" },
};

test("account closure requires recent server-derived password and email proof", () => {
  assert.deepEqual(validateAccountClosureRequest({ userId, input, securityProof: proof, now }), {
    userId, idempotencyKey: input.idempotencyKey, noticeVersion: input.noticeVersion,
  });
  assert.throws(() => validateAccountClosureRequest({ userId, input, securityProof: { ...proof, emailCode: { ...proof.emailCode, userId: "other" } }, now }), /step_up/);
  assert.throws(() => validateAccountClosureRequest({ userId, input: { ...input, confirmed: "true" }, securityProof: proof, now }), /invalid_account/);
});

test("closure progress preserves seven-day cancellation and never authorizes erasure", () => {
  const state = { status: "cooling_off", cancelUntil: "2030-01-08T12:00:00Z", obligations: { activeTransactions: 0, financialCases: 0 } };
  assert.deepEqual(accountClosureProgress(state, Date.parse("2030-01-08T11:59:59Z")), {
    status: "cooling_off", coolingOff: true, cancellable: true, eligibleForReview: false,
    pendingObligations: [], automaticErasureAllowed: false,
  });
  assert.equal(accountClosureProgress(state, Date.parse("2030-01-08T12:00:00Z")).eligibleForReview, true);
  assert.deepEqual(accountClosureProgress({ ...state, obligations: { activeTransactions: 1, financialCases: 0 } }, Date.parse("2030-01-09T00:00:00Z")).pendingObligations, ["activeTransactions"]);
});

test("service refuses client-provided pseudo proof and validates cancellation version", async () => {
  const calls = [];
  const service = createAccountClosureService({ request: async value => { calls.push(value); return value; }, cancel: async value => value }, { clock: () => now });
  const authorized={...input,stepUpGrantId:"33333333-3333-4333-8333-333333333333"};
  await assert.rejects(service.request(userId, { ...authorized, passwordVerified: true }), error => error.code === "invalid_account_closure_request");
  await assert.rejects(service.request(userId, input), error => error.code === "invalid_account_closure_request");
  await service.request(userId, authorized);
  assert.equal(calls.length, 1);
  await assert.rejects(service.cancel(userId, requestId, { confirmed: true, expectedVersion: -1 }), error => error.code === "invalid_account_closure_cancellation");
  assert.equal((await service.cancel(userId, requestId, { confirmed: true, expectedVersion: 0 })).expectedVersion, 0);
});

function closureRow(overrides={}) { return { id:requestId,user_id:userId,idempotency_key:input.idempotencyKey,notice_version:input.noticeVersion,status:"cooling_off",version:0,requested_at:"2030-01-01T12:00:00Z",cancel_until:"2030-01-08T12:00:00Z",cancelled_at:null,...overrides }; }

test("repository creates restriction and stops Premium renewal in the same transaction", async () => {
  const calls=[];
  const client={async query(sql,values){calls.push({sql,values});if(sql.startsWith("SELECT id FROM users"))return{rows:[{id:userId}]};if(sql.includes("WHERE idempotency_key"))return{rows:[]};if(sql.includes("status<>'cancelled' FOR UPDATE"))return{rows:[]};if(sql.startsWith("INSERT INTO account_closure_requests"))return{rows:[closureRow()]};return{rows:[]};}};
  let consumed;const repository=createAccountClosureRepository({transaction:operation=>operation(client)},{stepUpRepository:{consume:async(_client,value)=>{consumed=value;return{confirmed_at:"2030-01-01"};}}});
  const result=await repository.request({userId,idempotencyKey:input.idempotencyKey,noticeVersion:input.noticeVersion,stepUpGrantId:"33333333-3333-4333-8333-333333333333"});
  assert.equal(result.request.cancelUntil,"2030-01-08T12:00:00.000Z");
  assert.ok(calls.some(({sql})=>sql.includes("INSERT INTO account_operation_restrictions")));
  assert.ok(calls.some(({sql})=>sql.includes("UPDATE premium_subscriptions SET renewal_enabled=false")));
  assert.deepEqual(consumed,{grantId:"33333333-3333-4333-8333-333333333333",userId,purpose:"account_closure"});
  assert.equal(result.automaticErasureAllowed,false);
});

test("new operation gate blocks closure restriction while preserving ordinary access", async () => {
  const blocked={query:async()=>({rows:[{suspended:false,closure_pending:true}]})};
  const allowed={query:async()=>({rows:[{suspended:false,closure_pending:false}]})};
  assert.equal(await newOperationsAllowed(blocked,userId),false);
  await assert.rejects(requireNewOperations(blocked,userId),error=>error.code==="new_operations_suspended");
  assert.equal(await newOperationsAllowed(allowed,userId),true);
});
