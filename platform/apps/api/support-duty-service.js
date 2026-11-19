import {accessLevel,requireAccessLevel,requireAdminSector,staffSector} from './authorization.js';
import {ServiceError} from './service-error.js';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const fail=(code,status,message)=>new ServiceError(code,status,message);
const reason=value=>{
 if(typeof value!=='string'||value.trim().length<10||value.trim().length>500)
  throw fail('support_duty_reason_required',422,'Informe uma justificativa entre 10 e 500 caracteres.');
 return value.trim();
};
const grant=value=>{
 if(typeof value!=='string'||!uuid.test(value))
  throw fail('support_duty_grant_required',422,'Confirmação de segurança inválida.');
 return value;
};
const bool=value=>{
 if(typeof value!=='boolean')throw fail('support_duty_decision_required',422,'Indique aceitar ou recusar.');
 return value;
};
const requireLevel=(actor,level,sectors)=>{
 requireAdminSector(actor,sectors,level);
 if(accessLevel(actor)!==level||!(level===5?staffSector(actor)==='founder':sectors.includes(staffSector(actor))))
  throw fail('support_duty_level_required',403,'Esta etapa exige a função e o nível exatos definidos pela governança.');
 return actor;
};
export function createSupportDutyService(repository){
 return Object.freeze({
  async list(actor){
   requireAdminSector(actor,['support','operations'],1);
   const level=accessLevel(actor);
   const entries=await repository.list({actorId:actor.id,leadership:level>=4});
   return {
    canPropose:level===3&&staffSector(actor)==='support',
    canReview:level===4&&staffSector(actor)==='operations',
    canDecide:level===5&&staffSector(actor)==='founder',
    proposals:entries.proposals.map(p=>({
     id:p.id,role_kind:p.role_kind,target_name:p.target_name,target_user_id:p.target_user_id,
     status:p.status,proposal_reason:p.proposal_reason,review_reason:p.review_reason,
     decision_reason:p.decision_reason,created_at:p.created_at,reviewed_at:p.reviewed_at,
     canReview:p.status==='pending_review'&&level===4&&staffSector(actor)==='operations'&&p.proposed_by!==actor.id&&p.target_user_id!==actor.id,
     canDecide:p.status==='pending_founder'&&level===5&&staffSector(actor)==='founder',
    })),
    assignments:entries.assignments.map(a=>({
     id:a.id,role_kind:a.role_kind,status:a.status,target_name:a.target_name,
     created_at:a.created_at,accepted_at:a.accepted_at,revoked_at:a.revoked_at,revoke_reason:a.revoke_reason,
     canRespond:a.status==='pending'&&a.target_user_id===actor.id,
     canRevoke:['pending','accepted'].includes(a.status)&&level===5&&staffSector(actor)==='founder',
    })),
    realStaffingActive:false,externalDispatchAuthorized:false,automaticPauseAuthorized:false,
   };
  },
  async propose(actor,input){
   requireLevel(actor,3,['support']);
   const roleKind=input?.roleKind,targetUserId=input?.targetUserId;
   if(!input||typeof input!=='object'||Array.isArray(input)||
    Object.keys(input).some(x=>!['roleKind','targetUserId','reason','grantId'].includes(x))||
    !['primary','substitute'].includes(roleKind)||!uuid.test(String(targetUserId??'')))
    throw fail('support_duty_invalid_proposal',422,'Função ou conta indicada inválida.');
   return {proposal:await repository.propose({actorId:actor.id,roleKind,targetUserId,
    reason:reason(input.reason),grantId:grant(input.grantId)})};
  },
  async review(actor,id,input){
   requireLevel(actor,4,['operations']);
   if(!uuid.test(id)||!input||typeof input!=='object'||Array.isArray(input)||
      Object.keys(input).some(x=>!['approved','reason','grantId'].includes(x)))
    throw fail('support_duty_invalid_review',422,'Revisão inválida.');
   return {proposal:await repository.review({actorId:actor.id,proposalId:id,
    approved:bool(input.approved),reason:reason(input.reason),grantId:grant(input.grantId)})};
  },
  async decide(actor,id,input){
   requireLevel(actor,5,['founder']);
   if(!uuid.test(id)||!input||typeof input!=='object'||Array.isArray(input)||
      Object.keys(input).some(x=>!['approved','reason','grantId'].includes(x)))
    throw fail('support_duty_invalid_decision',422,'Decisão final inválida.');
   return repository.decide({actorId:actor.id,proposalId:id,approved:bool(input.approved),
    reason:reason(input.reason),grantId:grant(input.grantId)});
  },
  async respond(actor,id,input){
   requireAdminSector(actor,['support'],1);
   if(!uuid.test(id)||!input||typeof input!=='object'||Array.isArray(input)||
     Object.keys(input).some(x=>!['accepted','grantId'].includes(x)))
    throw fail('support_duty_invalid_acceptance',422,'Aceite pessoal inválido.');
   return {assignment:await repository.respond({actorId:actor.id,assignmentId:id,
    accepted:bool(input.accepted),grantId:grant(input.grantId)})};
  },
  async revoke(actor,id,input){
   requireLevel(actor,5,['founder']);
   if(!uuid.test(id)||!input||typeof input!=='object'||Array.isArray(input)||
      Object.keys(input).some(x=>!['reason','grantId'].includes(x)))
    throw fail('support_duty_invalid_revocation',422,'Revogação inválida.');
   return {assignment:await repository.revoke({actorId:actor.id,assignmentId:id,
     reason:reason(input.reason),grantId:grant(input.grantId)})};
  },
 });
}
