// FC-323: read-only escalation routing preview, never a delivery or pause engine.
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const priorityOrder=Object.freeze({critical:0,high:1,normal:2,low:3});
const fail=message=>{throw new TypeError(message);};
const idOf=value=>typeof value==='string'&&uuid.test(value)?value:null;
export function previewSupportEscalation({tickets=[],duties=[],coordinators=[],overdueTotal=null,criticalOverdue=null}={}){
 if(!Array.isArray(tickets)||!Array.isArray(duties)||!Array.isArray(coordinators))fail('Expected explicit arrays for escalation preview');
 if(tickets.length>50||duties.length>10||coordinators.length>100)fail('Escalation preview input exceeds safe bound');
 const dutyTargets=new Map();
 for(const role of ['primary','substitute']){
  const matches=duties.filter(item=>item?.role_kind===role&&item?.status==='accepted'&&item?.verified===true&&idOf(item.target_user_id));
  if(matches.length===1)dutyTargets.set(role,matches[0].target_user_id);
 }
 const coordinate=(level)=>[...new Set(coordinators.filter(item=>Number(item?.staff_access_level)===level&&item?.verified===true&&idOf(item.user_id)).map(item=>item.user_id))].sort();
 const level4=coordinate(4),founder=coordinate(5);
 const sorted=[...tickets].sort((a,b)=>{
  const ap=priorityOrder[a?.priority]??99,bp=priorityOrder[b?.priority]??99;
  return ap-bp||String(a?.first_response_due_at??'').localeCompare(String(b?.first_response_due_at??''))||String(a?.id??'').localeCompare(String(b?.id??''));
 });
 const routes=sorted.map(ticket=>{
  if(!idOf(ticket?.id)||!Object.hasOwn(priorityOrder,ticket?.priority)||
    ticket?.first_response_at!=null||ticket?.status==='resolved'||
    !Number.isFinite(Date.parse(ticket?.first_response_due_at??'')))fail('Preview requires only classified, overdue, unanswered tickets');
  const required=ticket.priority==='critical'?['primary','substitute','level4','level5']:['primary','substitute'];
  const candidates={
   primary:dutyTargets.get('primary')?[dutyTargets.get('primary')]:[],
   substitute:dutyTargets.get('substitute')?[dutyTargets.get('substitute')]:[],
   level4,level5:founder,
  };
  const missing=required.filter(role=>candidates[role].length===0);
  const recipients=required.flatMap(role=>candidates[role].map(userId=>({role,userId})));
  if(new Set(recipients.map(item=>item.userId)).size!==recipients.length)missing.push('independent_recipients_required');
  return {
   ticketId:ticket.id,priority:ticket.priority,deadline:ticket.first_response_due_at,
   plannedRecipients:recipients,missing,
   readiness:missing.length?'missing_coverage':'prepared_not_activated',
   actualDispatch:false,
  };
 });
 const visibleCritical=routes.filter(x=>x.priority==='critical').length;
 const confirmedTotal=overdueTotal==null?routes.length:overdueTotal;
 const confirmedCritical=criticalOverdue==null?visibleCritical:criticalOverdue;
 if(!Number.isSafeInteger(confirmedTotal)||!Number.isSafeInteger(confirmedCritical)||
    confirmedTotal<routes.length||confirmedCritical<visibleCritical||confirmedCritical>confirmedTotal||
    (confirmedTotal===0&&routes.length!==0))fail('Invalid aggregate overdue counts');
 const incompleteRouting=routes.some(x=>x.priority==='critical'&&x.missing.length>0);
 return {
  routes,overdueTotal:confirmedTotal,criticalOverdue:confirmedCritical,
  previewLimitedTo:50,
  preventionPreview:{
   threeCriticalOverdue:confirmedCritical>=3,
   criticalRoutingIncomplete:incompleteRouting,
   criticalCoverageMissing:confirmedCritical>0, // never claim verified on-call staffing
   humanDecisionRequired:confirmedCritical>0,
  },
  channelVerified:false,staffingVerified:false,externalDispatchAuthorized:false,
  internalDispatchAuthorized:false,automaticPauseAuthorized:false,sendAttempted:false,
 };
}
