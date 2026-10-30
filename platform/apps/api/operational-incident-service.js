import { randomUUID } from 'node:crypto';
import { ServiceError } from './service-error.js';
import { requireAccessLevel } from './authorization.js';

const domains=new Set(['global','marketplace','payments','refunds','payouts','logistics','donations','premium']);
const severities=new Set(['low','medium','high','critical']);
const statuses=new Set(['open','contained','monitoring','resolved']);
const actions=new Set(['claim','release','contain','monitor','resolve','reopen','note']);
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const fail=(code,status,message)=>new ServiceError(code,status,message);
const text=(value,min,max,label)=>{const result=String(value??'').trim();if(result.length<min||result.length>max)throw fail('invalid_incident_input',422,`${label} deve ter entre ${min} e ${max} caracteres.`);return result;};

export function createOperationalIncidentService(repository,{clock=Date.now}={}){
  return Object.freeze({
    async list(input={}){
      const status=input.status?String(input.status):null,domain=input.domain?String(input.domain):null,severity=input.severity?String(input.severity):null;
      if(status&&!statuses.has(status)||domain&&!domains.has(domain)||severity&&!severities.has(severity))throw fail('invalid_incident_filter',422,'Filtro de incidente inválido.');
      return {items:await repository.list({status,domain,severity,limit:50})};
    },
    async detail(id){if(!uuid.test(id))throw fail('incident_not_found',404,'Incidente não encontrado.');const result=await repository.detail(id);if(!result)throw fail('incident_not_found',404,'Incidente não encontrado.');return result;},
    async create(actor,input){
      if(!uuid.test(String(input?.idempotencyKey??'')))throw fail('invalid_incident_idempotency_key',422,'Informe uma chave de idempotência UUID.');
      const severity=String(input?.severity??''),domain=String(input?.domain??'');
      if(!severities.has(severity)||!domains.has(domain))throw fail('invalid_incident_input',422,'Severidade ou domínio inválido.');
      requireAccessLevel(actor,['payments','refunds','payouts'].includes(domain)?3:2);
      const stamp=new Date(clock()).toISOString().slice(0,10).replaceAll('-','');
      return repository.create({actorUserId:actor.id,reference:`FC-INC-${stamp}-${randomUUID().slice(0,8).toUpperCase()}`,idempotencyKey:input.idempotencyKey,
        title:text(input.title,10,160,'Título'),summary:text(input.summary,20,2000,'Resumo'),severity,domain});
    },
    async change(actor,id,input){
      if(!uuid.test(id))throw fail('incident_not_found',404,'Incidente não encontrado.');
      const action=String(input?.action??''),expectedVersion=Number(input?.expectedVersion);
      if(!actions.has(action)||!Number.isSafeInteger(expectedVersion)||expectedVersion<1)throw fail('invalid_incident_change',422,'Ação ou versão inválida.');
      const note=text(input.note,10,2000,'Registro');
      const current=await repository.detail(id);
      if(!current)throw fail('incident_not_found',404,'Incidente não encontrado.');
      requireAccessLevel(actor,['payments','refunds','payouts'].includes(current.incident.domain)?3:2);
      const result=await repository.change({actorUserId:actor.id,id,expectedVersion,action,note});
      if(!result)throw fail('incident_not_found',404,'Incidente não encontrado.');
      if(result.conflict)throw fail('incident_version_conflict',409,'O incidente foi atualizado; recarregue antes de continuar.');
      if(result.assignedConflict)throw fail('incident_assignment_conflict',409,'O incidente está atribuído a outro responsável.');
      return result;
    },
  });
}
