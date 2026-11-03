import {accessLevel} from './authorization.js';
import {ServiceError} from './service-error.js';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const fail=(code,status,message)=>new ServiceError(code,status,message);
const reference=value=>{if(!uuid.test(String(value??'')))throw fail('invalid_authority_request_reference',422,'Referência inválida.');return value;};
const note=(value,min=10)=>{const result=String(value??'').trim();if(result.length<min||result.length>2000)throw fail('invalid_authority_request_note',422,'Registre uma justificativa adequada.');return result;};

export function createAuthorityRequestService(repository,{enabled=false}={}){
 const active=()=>{if(!enabled)throw fail('authority_requests_disabled',404,'Solicitações de autoridades indisponíveis.');};
 return Object.freeze({
  async list(actor){active();if(accessLevel(actor)<2)throw fail('insufficient_access_level',403,'Consulta exige nível 2 ou superior.');return{items:await repository.list()};},
  async protocol(actor,input){active();if(accessLevel(actor)<1)throw fail('insufficient_access_level',403,'Protocolo exige nível 1 ou superior.');const exceptional=input?.flow==='judicial_exception';if(!['ordinary','judicial_exception'].includes(input?.flow))throw fail('invalid_authority_request_flow',422,'Fluxo inválido.');const request=await repository.protocol({actorId:actor.id,flow:input.flow,authorityName:note(input?.authorityName,3),authorityReference:note(input?.authorityReference,3),scope:note(input?.scope,10),legalBasis:note(input?.legalBasis,10),judicialOrderReference:exceptional?note(input?.judicialOrderReference,3):null});return{request,disclosureAuthorized:false};},
  async validate(actor,requestId,input){active();if(accessLevel(actor)<2)throw fail('insufficient_access_level',403,'Validação exige nível 2 ou superior.');if(typeof input?.valid!=='boolean')throw fail('invalid_authority_validation',422,'Validação inválida.');const result=await repository.validate({actorId:actor.id,requestId:reference(requestId),valid:input.valid,note:note(input?.note)});if(!result)throw fail('authority_request_not_pending_validation',409,'Solicitação indisponível para validação.');return{request:result,disclosureAuthorized:false};},
  async decide(actor,requestId,input){active();const level=accessLevel(actor),stage=input?.stage;if(!['authorize','legal','level3','level4','level5'].includes(stage)||typeof input?.approved!=='boolean')throw fail('invalid_authority_decision',422,'Decisão inválida.');const required={authorize:3,legal:3,level3:3,level4:4,level5:5}[stage];if(level<required)throw fail('insufficient_access_level',403,`Decisão exige nível ${required} ou superior.`);const result=await repository.decide({actorId:actor.id,requestId:reference(requestId),stage,approved:input.approved,note:note(input?.note)});if(!result)throw fail('authority_request_not_actionable',409,'Solicitação indisponível nesta etapa.');return{request:result.request,disclosureAuthorized:Boolean(result.disclosureAuthorized),minimumDisclosure:true};}
 });
}
