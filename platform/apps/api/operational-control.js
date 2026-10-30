import { ServiceError } from "./service-error.js";
import {accessLevel,requireAccessLevel} from './authorization.js';

export const OPERATIONAL_DOMAINS = Object.freeze(["global", "marketplace", "payments", "refunds", "payouts", "logistics", "donations", "premium"]);
const DOMAIN_SET = new Set(OPERATIONAL_DOMAINS);

export class OperationalControlError extends ServiceError {
  constructor(code, status, message) { super(code, status, message); }
}

export function controlledDomain(method, pathname) {
  if (method === "POST" && pathname === "/v1/listings") return "marketplace";
  if (method === "POST" && /^\/v1\/account\/listings\/[0-9a-f-]{36}\/resubmit$/i.test(pathname)) return "marketplace";
  if (method === "POST" && /^\/v1\/listings\/[0-9a-f-]{36}\/transactions$/i.test(pathname)) return "marketplace";
  if (method === "POST" && (pathname === "/v1/exchanges" || /^\/v1\/exchanges\/[0-9a-f-]{36}\/(accept|refuse|cancel|complete)$/i.test(pathname))) return "marketplace";
  if (method === "POST" && ["/v1/payments/intents", "/v1/payments/tokenization-sessions"].includes(pathname)) return "payments";
  if (method === "POST" && /^\/v1\/payments\/[0-9a-f-]{36}\/refunds$/i.test(pathname)) return "refunds";
  if (method === "POST" && /^\/v1\/admin\/supported-cancellations\/[0-9a-f-]{36}\/execute$/i.test(pathname)) return "refunds";
  if (method === "POST" && /^\/v1\/shipments\/[0-9a-f-]{36}\/(seller|courier)-payout$/i.test(pathname)) return "payouts";
  if (method === "POST" && pathname === "/v1/shipments") return "logistics";
  if (method === "POST" && /^\/v1\/shipments\/[0-9a-f-]{36}\/(assign|collection)$/i.test(pathname)) return "logistics";
  if (method === "POST" && pathname === "/v1/donations") return "donations";
  if (method === "POST" && /^\/v1\/donations\/[0-9a-f-]{36}\/(accept|refuse|decide|pickup)$/i.test(pathname)) return "donations";
  if (["POST", "PUT"].includes(method) && pathname.startsWith("/v1/account/premium/")) return "premium";
  return null;
}

export function createOperationalControlService(repository) {
  return Object.freeze({
    async status() { return { items: await repository.list() }; },

    async change(actor, input) {
      const domain = String(input?.domain ?? "");
      const action = String(input?.action ?? "");
      const reason = String(input?.reason ?? "").trim();
      if (!DOMAIN_SET.has(domain)) throw new OperationalControlError("invalid_operational_domain", 422, "Escolha um domínio operacional válido.");
      if (!new Set(["pause", "resume"]).has(action)) throw new OperationalControlError("invalid_operational_action", 422, "Escolha pausar ou retomar.");
      if (input?.confirmed !== true) throw new OperationalControlError("operational_confirmation_required", 422, "Confirme expressamente a alteração operacional.");
      if (reason.length < 10 || reason.length > 500) throw new OperationalControlError("invalid_operational_reason", 422, "Registre uma justificativa entre 10 e 500 caracteres.");
      if(action==='resume')throw new OperationalControlError('joint_resume_approval_required',409,'A retomada exige solicitação técnica e autorização final do fundador.');
      return { state: await repository.change({ actorUserId: actor.id, domain, paused: action === "pause", reason }) };
    },

    async resumeRequests(actor){requireAccessLevel(actor,2);return{items:await repository.listResumeRequests(),canDecide:accessLevel(actor)===5};},
    async proposeResume(actor,input){requireAccessLevel(actor,2);if(accessLevel(actor)===5)throw new OperationalControlError('independent_resume_proposal_required',403,'O fundador não pode propor e autorizar a mesma retomada.');const domain=String(input?.domain??''),reason=String(input?.reason??'').trim(),grantId=String(input?.grantId??'');if(!DOMAIN_SET.has(domain)||reason.length<10||reason.length>500||!/^[0-9a-f-]{36}$/i.test(grantId))throw new OperationalControlError('invalid_resume_request',422,'Informe domínio, justificativa e confirmação válidos.');return{request:await repository.proposeResume({actorUserId:actor.id,domain,reason,grantId})};},
    async decideResume(actor,requestId,input){requireAccessLevel(actor,5);const reason=String(input?.reason??'').trim(),grantId=String(input?.grantId??'');if(!/^[0-9a-f-]{36}$/i.test(requestId)||typeof input?.approved!=='boolean'||reason.length<10||reason.length>500||!/^[0-9a-f-]{36}$/i.test(grantId))throw new OperationalControlError('invalid_resume_decision',422,'Informe decisão, justificativa e confirmação válidas.');return repository.decideResume({actorUserId:actor.id,requestId,approved:input.approved,reason,grantId});},

    async assertAvailable(domain) {
      const block = await repository.blocked(domain);
      if (block) throw new OperationalControlError("operational_paused", 503, "Esta operação está temporariamente pausada com segurança.");
    },
  });
}
