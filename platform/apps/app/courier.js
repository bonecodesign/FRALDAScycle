import { notify } from "/packages/ui/notify.js";
import "/packages/ui/iconography.js";
import { apiRequest } from "/packages/contracts/api-client.js";
import { uploadListingMedia } from "/packages/contracts/marketplace-ui.js";

async function currentLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Localização indisponível.'));
    navigator.geolocation.getCurrentPosition(
      position => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
      () => reject(new Error('Permita o acesso à localização para concluir a entrega.')),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  });
}

function setupRealDeliveryProof() {
  const photo = document.querySelector('.panel .button.secondary');
  const action = document.querySelector('[data-action="delivery"]');
  if (!photo || !action) return;
  const recipient = document.querySelector('.phone-content .form-group input');
  const confirmation = document.querySelector('.phone-content .terms input');
  let uploading = false;
  let submitting = false;
  const activeShipment = () => sessionStorage.getItem('fc.activeShipmentId');
  const clearPhoto = () => {
    sessionStorage.removeItem('fc.deliveryProofMediaKey');
    sessionStorage.removeItem('fc.deliveryProofShipmentId');
  };
  if (sessionStorage.getItem('fc.deliveryProofShipmentId') !== activeShipment()) clearPhoto();
  if (sessionStorage.getItem('fc.deliveryProofMediaKey')) photo.textContent = 'Foto adicionada';

  photo.addEventListener('click', event => {
    event.preventDefault(); event.stopImmediatePropagation();
    if (uploading || submitting) return;
    const shipmentId = activeShipment();
    if (!shipmentId) { notify('Selecione uma entrega real antes de adicionar a foto'); return; }
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/jpeg,image/png,image/webp';
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file || uploading || submitting) return;
      uploading = true; photo.disabled = true; action.disabled = true;
      photo.textContent = 'Enviando foto...';
      try {
        const storageKey = await uploadListingMedia(file);
        if (activeShipment() !== shipmentId) throw new Error('A entrega selecionada mudou. Adicione a foto para a entrega atual.');
        sessionStorage.setItem('fc.deliveryProofMediaKey', storageKey);
        sessionStorage.setItem('fc.deliveryProofShipmentId', shipmentId);
        photo.closest('.panel')?.classList.add('ready');
        notify('Foto registrada com segurança');
      } catch (error) { notify(error.message || 'Não foi possível enviar a foto'); }
      finally {
        uploading = false; photo.disabled = false; action.disabled = false;
        photo.textContent = sessionStorage.getItem('fc.deliveryProofMediaKey') && sessionStorage.getItem('fc.deliveryProofShipmentId') === activeShipment() ? 'Foto adicionada' : 'Adicionar foto';
      }
    }, { once: true });
    input.click();
  }, true);

  action.addEventListener('click', async event => {
    event.preventDefault(); event.stopImmediatePropagation();
    if (uploading || submitting) return;
    const shipmentId = activeShipment();
    const mediaKey = sessionStorage.getItem('fc.deliveryProofMediaKey');
    const recipientName = recipient?.value.trim();
    if (!shipmentId) { notify('Selecione uma entrega real antes de enviar o comprovante'); return; }
    if (!mediaKey || sessionStorage.getItem('fc.deliveryProofShipmentId') !== shipmentId) {
      clearPhoto(); photo.textContent = 'Adicionar foto';
      notify('Adicione a foto da entrega antes de concluir'); return;
    }
    if (!recipientName || recipientName.length < 2 || recipientName.length > 100 || !confirmation?.checked) {
      notify('Informe quem recebeu e confirme a entrega sem avarias'); return;
    }
    submitting = true;
    for (const control of [action, photo, recipient, confirmation]) control.disabled = true;
    action.setAttribute('aria-busy', 'true');
    try {
      const location = await currentLocation();
      if (activeShipment() !== shipmentId) throw new Error('A entrega selecionada mudou. Confira os dados antes de enviar.');
      const result = await apiRequest('/v1/shipments/' + shipmentId + '/proof', {
        method: 'POST', body: { mediaKey, recipientName, ...location },
      });
      if (!result.proof?.id && result.proof?.duplicate !== true) throw new Error('Não foi possível confirmar o registro do comprovante. Tente novamente.');
      if (sessionStorage.getItem('fc.deliveryProofShipmentId') === shipmentId && sessionStorage.getItem('fc.deliveryProofMediaKey') === mediaKey) clearPhoto();
      notify('Comprovante enviado; aguardando aprovação do recebedor e validação');
      if (activeShipment() === shipmentId) window.location.assign('/courier/history');
    } catch (error) { notify(error.message || 'Não foi possível concluir a entrega'); }
    finally {
      submitting = false;
      for (const control of [action, photo, recipient, confirmation]) control.disabled = false;
      action.removeAttribute('aria-busy');
    }
  }, true);
}

setupRealDeliveryProof();
