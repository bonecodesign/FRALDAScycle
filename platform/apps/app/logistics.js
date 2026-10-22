import { setupWalletLogisticsExtras, setupActionStates } from "/apps/app/action-states.js";
import { notify } from "/packages/ui/notify.js";
import "/packages/ui/iconography.js";
import { apiRequest } from "/packages/contracts/api-client.js";

async function createRealShipment(event){
  const content=document.getElementById('delivery-options-content');if(!content)return;
  event.preventDefault();const transactionId=sessionStorage.getItem('fc.activeTransactionId');if(!transactionId){notify('Pedido não identificado para entrega');return}
  const mode='partner';const insured=Boolean(content.querySelector('.toggle input')?.checked);const keyName='fc.shipmentIdempotency.'+transactionId;const idempotencyKey=sessionStorage.getItem(keyName)||crypto.randomUUID();sessionStorage.setItem(keyName,idempotencyKey);
  const button=event.currentTarget;button.setAttribute('aria-disabled','true');try{const result=await apiRequest('/v1/shipments',{method:'POST',body:{transactionId,mode,insured,idempotencyKey}});sessionStorage.setItem('fc.activeShipmentId',result.shipment.id);window.location.assign('/app/delivery')}catch(error){button.removeAttribute('aria-disabled');notify(error.message||'Não foi possível criar a entrega')}
}
async function refreshRealShipment(){
  const shipmentId=sessionStorage.getItem('fc.activeShipmentId');if(!shipmentId)return false;
  const result=await apiRequest('/v1/shipments/'+shipmentId);const shipment=result.shipment;const status=document.getElementById('delivery-status');const eta=document.getElementById('delivery-eta');if(status)status.textContent=shipment.status;if(eta)eta.textContent=shipment.estimatedDeliveryAt?'Previsão: '+new Date(shipment.estimatedDeliveryAt).toLocaleString('pt-BR'):'Aguardando previsão do parceiro';return true
}
function setupRealLogistics(){
  document.querySelector('#delivery-options-content .button.primary')?.addEventListener('click',createRealShipment,true);
  const refresh=document.getElementById('delivery-refresh');refresh?.addEventListener('click',event=>{if(!sessionStorage.getItem('fc.activeShipmentId'))return;event.preventDefault();event.stopImmediatePropagation();refresh.disabled=true;void refreshRealShipment().then(()=>notify('Rastreamento atualizado')).catch(error=>notify(error.message)).finally(()=>{refresh.disabled=false;refresh.textContent='Rastreamento atualizado'})},true);
  if(document.getElementById('delivery-tracking'))void refreshRealShipment().catch(()=>{});
}

function setupDeliveryTracking(){
  const tracking=document.getElementById('delivery-tracking');if(!tracking)return;
  const refresh=document.getElementById('delivery-refresh');const driver=document.getElementById('tracking-driver');const eta=document.getElementById('delivery-eta');const contact=document.getElementById('delivery-contact');
  if(contact)contact.addEventListener('click',()=>{notify('Chat protegido aberto com o entregador');location.pathname='/app/chat'});
  if(refresh)refresh.addEventListener('click',()=>{if(sessionStorage.getItem('fc.activeShipmentId'))return;notify('Nenhuma entrega real foi selecionada para rastreamento.')});
}

setupRealLogistics();
setupDeliveryTracking();
setupWalletLogisticsExtras();
setupActionStates();



const receiptApproval = document.getElementById('receipt-approve');
if (receiptApproval) receiptApproval.addEventListener('click', async () => {
  const shipmentId = sessionStorage.getItem('fc.activeShipmentId');
  if (!shipmentId) { notify('Entrega não identificada. Abra o pedido para confirmar.'); return; }
  receiptApproval.disabled = true;
  try {
    await apiRequest('/v1/shipments/' + shipmentId + '/receipt', {
      method: 'POST', body: { approved: true },
    });
    receiptApproval.textContent = 'Recebimento aprovado';
    notify('Sua aprovação foi registrada. O repasse ainda não foi liberado.');
  } catch (error) {
    receiptApproval.disabled = false;
    notify(error.message || 'Não foi possível registrar sua aprovação');
  }
});
