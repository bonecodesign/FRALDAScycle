import { mountPublicationPhoto } from './publication-draft-assets.js';

export function mountPublicationUpload(container,{storageKey=null,upload,readPhoto,onUploaded,onReady}){
  let key=storageKey,busy=false,disposed=false,photo=null;
  const preview=document.createElement('div');
  const status=document.createElement('p');status.setAttribute('role','status');
  const choose=document.createElement('button');choose.type='button';choose.className='button secondary';
  const render=()=>{
    photo?.dispose();photo=null;preview.replaceChildren();
    if(key)photo=mountPublicationPhoto(preview,key,readPhoto);
    status.textContent=key?'Foto enviada neste rascunho. Você pode mantê-la ou substituir.':'Adicione uma foto real do produto.';
    choose.textContent=key?'Trocar foto':'Escolher foto';onReady(Boolean(key));
  };
  container.replaceChildren(preview,status,choose);
  choose.addEventListener('click',()=>{
    if(busy||disposed)return;
    const input=document.createElement('input');input.type='file';input.accept='image/jpeg,image/png,image/webp';
    input.addEventListener('change',async()=>{
      const file=input.files?.[0];if(!file||busy||disposed)return;
      if(!['image/jpeg','image/png','image/webp'].includes(file.type)||!Number.isInteger(file.size)||file.size<1||file.size>10_000_000){status.textContent='Escolha uma imagem JPEG, PNG ou WebP de até 10 MB.';return}
      busy=true;choose.disabled=true;choose.textContent='Enviando...';onReady(false);
      try{
        const uploaded=await upload(file);
        if(disposed)return;
        onUploaded(uploaded);key=uploaded;render();
      }catch(error){
        if(disposed)return;
        status.textContent=key?`${error.message} A foto anterior foi mantida.`:error.message;
      }finally{
        if(!disposed){busy=false;choose.disabled=false;choose.textContent=key?'Trocar foto':'Escolher foto';onReady(Boolean(key))}
      }
    });input.click();
  });
  render();
  return {dispose(){disposed=true;photo?.dispose()}};
}
