import { randomUUID } from 'node:crypto';
import { ServiceError } from './service-error.js';
import { requireAccessLevel } from './authorization.js';
import { privacyCommunicationDecision, privacyRiskAssessment } from '../../packages/contracts/privacy-incident.js';

const domains=new Set(['global','marketplace','payments','refunds','payouts','logistics','donations','premium','privacy']);
const severities=new Set(['low','medium','high','critical']);
const statuses=new Set(['open','contained','monitoring','resolved']);
const actions=new Set(['claim','release','contain','monitor','resolve','reopen','note','assess_privacy','record_communication']);
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
      requireAccessLevel(actor,['payments','refunds','payouts','privacy'].includes(domain)?3:2);
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
      const privacy=current.incident.domain==='privacy';
      if(privacy&&action==='record_communication')requireAccessLevel(actor,current.incident.severity==='critical'?5:4);
      else requireAccessLevel(actor,['payments','refunds','payouts','privacy'].includes(current.incident.domain)?3:2);
      if(!privacy&&['assess_privacy','record_communication'].includes(action))throw fail('privacy_incident_action_required',409,'A ação exige incidente de privacidade.');
      if(privacy&&action==='resolve'){
        const recorded=new Set(current.events.map(event=>event.action));
        if(!recorded.has('risk_assessed')||!recorded.has('communication_decision'))
          throw fail('privacy_incident_review_incomplete',409,'Avalie o risco e registre a decisão de comunicação antes de resolver.');
      }
      const metadata=action==='assess_privacy'?privacyRiskAssessment(input.assessment)
        :action==='record_communication'?privacyCommunicationDecision(input.communication):{};
      const result=await repository.change({actorUserId:actor.id,id,expectedVersion,action,note,metadata});
      if(!result)throw fail('incident_not_found',404,'Incidente não encontrado.');
      if(result.conflict)throw fail('incident_version_conflict',409,'O incidente foi atualizado; recarregue antes de continuar.');
      if(result.assignedConflict)throw fail('incident_assignment_conflict',409,'O incidente está atribuído a outro responsável.');
      return result;
    },
  });
}
