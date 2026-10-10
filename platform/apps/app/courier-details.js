import { apiRequest } from '/packages/contracts/api-client.js';
const contactButton=document.getElementById('courier-contact');
const payoutButton=document.getElementById('courier-payout');
const output=document.getElementById('courier-details');
const feedback=document.getElementById('courier-details-feedback');
let pending=false,generation=0;
const clear=()=>{generation++;output.replaceChildren();feedback.textContent='';};
const labels={not_prepared:'Obrigação de repasse ainda não preparada',provider_pending:'Obrigação preparada; processamento externo pendente'};
const blockers={unsupported_transaction_kind:'Modalidade de operação sem repasse disponível',delivery_proof_pending:'Entrega ou comprovante pendente',transaction_not_eligible:'Operação ainda não elegível',payment_not_confirmed:'Pagamento não confirmado',freight_not_charged:'Frete não cobrado',financial_case_pending:'Análise financeira pendente',receiver_approval_pending:'Aprovação do recebedor pendente',proof_validation_pending:'Validação do comprovante pendente',courier_not_assigned:'Entregador não atribuído'};
function line(text){const node=document.createElement('p');node.textContent=text;output.append(node);}
function contact(result){
 const data=result?.contact;
 if(!data||!['pickup','delivery'].includes(data.purpose)||typeof data.displayName!=='string'||!data.displayName.trim()||typeof data.phone!=='string'||!/^\+?[0-9 ()-]{8,25}$/.test(data.phone))throw new Error('Não foi possível confirmar o contato autorizado.');
 line(data.purpose==='pickup'?'Contato para coleta':'Contato para entrega');line(data.displayName);line(data.phone);
 line('Use este contato somente para esta operação. A disponibilidade será conferida novamente ao consultar.');
}
function payout(result){
 const data=result?.payout;
 if(!data||!Object.hasOwn(labels,data.status)||typeof data.eligible!=='boolean'||data.payoutAllowed!==false||!Array.isArray(data.blockers)||data.blockers.some(value=>!Object.hasOwn(blockers,value))||data.eligible!==(data.blockers.length===0))throw new Error('Não foi possível confirmar a situação do repasse.');
 for(const key of ['freightCents','platformFeeCents','courierAmountCents'])if(data[key]!==null&&(!Number.isSafeInteger(data[key])||data[key]<0))throw new Error('Não foi possível confirmar os valores do repasse.');
 line(labels[data.status]);
 for(const value of data.blockers)line(blockers[value]);
 const currency=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
 for(const [key,label] of [['freightCents','Frete registrado'],['platformFeeCents','Comissão registrada'],['courierAmountCents','Valor registrado para o entregador']])line(label+': '+(data[key]===null?'Não informado':currency.format(data[key]/100)));
 line('Consulta informativa. Não confirma pagamento ao entregador nem autoriza ou executa repasse.');
}
async function load(kind){
 if(pending)return;
 clear();const requestGeneration=generation;
 const id=sessionStorage.getItem('fc.activeShipmentId');
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id||'')){feedback.textContent='Selecione uma entrega atribuída antes de consultar.';return;}
 pending=true;contactButton.disabled=true;payoutButton.disabled=true;feedback.textContent='Consultando a operação selecionada...';
 const signal=AbortSignal.timeout(15000);
 try{
  const result=await apiRequest('/v1/shipments/'+id+'/'+(kind==='contact'?'contact':'courier-payout'),{signal});
  if(requestGeneration!==generation||document.hidden)return;
  if(signal.aborted)throw new Error('A consulta demorou para responder. Tente novamente.');
  if(sessionStorage.getItem('fc.activeShipmentId')!==id)throw new Error('A entrega selecionada mudou. Consulte novamente.');
  (kind==='contact'?contact:payout)(result);feedback.textContent='Consulta concluída para a entrega '+id+'.';
 }catch(error){if(requestGeneration===generation&&!document.hidden){output.replaceChildren();feedback.textContent=signal.aborted?'A consulta demorou para responder. Tente novamente.':error.message||'Não foi possível consultar a operação.';}}
 finally{pending=false;contactButton.disabled=false;payoutButton.disabled=false;}
}
contactButton.addEventListener('click',()=>load('contact'));
payoutButton.addEventListener('click',()=>load('payout'));
document.addEventListener('visibilitychange',()=>{if(document.hidden)clear();});
window.addEventListener('pagehide',clear);
