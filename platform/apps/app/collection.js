import {apiRequest} from '/packages/contracts/api-client.js';
const form=document.getElementById('collection-form'),feedback=document.getElementById('collection-feedback'),fieldset=form.querySelector('fieldset');
form.addEventListener('submit',async e=>{e.preventDefault();const id=form.elements.shipmentId.value.trim(),body={confirmed:form.elements.confirmed.checked,noticeVersion:'FC-COLLECTION-1'};fieldset.disabled=true;
 try{await apiRequest('/v1/shipments/'+encodeURIComponent(id)+'/collection',{method:'POST',body});form.elements.confirmed.checked=false;feedback.textContent='Coleta registrada. A operação aguarda entrega, comprovante e aprovação do recebedor.';}catch(e){feedback.textContent=e.message;}finally{fieldset.disabled=false;}
});
apiRequest('/v1/auth/session').then(session=>{if(!['courier','admin'].includes(session.user.role))throw new Error('Use a conta do entregador atribuído para registrar a coleta.');form.elements.shipmentId.value=sessionStorage.getItem('fc.activeShipmentId')||'';fieldset.disabled=false;}).catch(e=>{feedback.textContent=e.message;});
