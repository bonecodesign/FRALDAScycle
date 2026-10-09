export function approximatePublicationLocation(location){
  if(!location||typeof location.city!=='string'||location.city.trim().length<2||
      !/^[A-Z]{2}$/.test(location.state)||typeof location.latitude!=='number'||
      !Number.isFinite(location.latitude)||Math.abs(location.latitude)>90||
      typeof location.longitude!=='number'||!Number.isFinite(location.longitude)||Math.abs(location.longitude)>180){
    throw new Error('A consulta não retornou cidade, UF e coordenadas válidas. Informe cidade e UF manualmente.');
  }
  return {city:location.city.trim(),state:location.state,latitude:Math.round(location.latitude*100)/100,longitude:Math.round(location.longitude*100)/100};
}

export function publicationLocationFields(draft){
  const city=String(draft.city||'').trim(),state=String(draft.state||'').trim().toUpperCase();
  if(city.length<2||city.length>120||!/^[A-Z]{2}$/.test(state))throw new Error('Informe cidade e UF na etapa Localização.');
  const cached=draft.resolvedLocation;
  const matching=cached&&cached.address===`${draft.postalCode}|${draft.neighborhood}`&&cached.city===city&&cached.state===state;
  const valid=matching&&typeof cached.latitude==='number'&&Number.isFinite(cached.latitude)&&Math.abs(cached.latitude)<=90&&typeof cached.longitude==='number'&&Number.isFinite(cached.longitude)&&Math.abs(cached.longitude)<=180;
  return {city,state,latitude:valid?Math.round(cached.latitude*100)/100:null,longitude:valid?Math.round(cached.longitude*100)/100:null};
}

export function mountPublicationPhoto(container,storageKey,readPhoto){
  let disposed=false,generation=0,timer=null;
  const image=document.createElement('img');image.alt='Foto enviada para este anúncio';image.referrerPolicy='no-referrer';image.hidden=true;
  const status=document.createElement('p');status.setAttribute('role','status');
  const retry=document.createElement('button');retry.type='button';retry.className='button secondary';retry.textContent='Consultar foto novamente';
  container.append(image,status,retry);
  const clear=()=>{clearTimeout(timer);image.onload=null;image.onerror=null;image.removeAttribute('src');image.hidden=true};
  async function load(){
    if(disposed)return;
    const current=++generation;clear();retry.disabled=true;status.textContent='Consultando a foto enviada...';
    try{
      const media=await readPhoto(storageKey);
      if(disposed||current!==generation)return;
      const url=new URL(media.readUrl),expiresAt=Date.parse(media.expiresAt),remaining=expiresAt-Date.now();
      if(url.protocol!=='https:'||url.username||url.password||!Number.isFinite(remaining)||remaining<=0||remaining>300_000)throw new Error('Acesso temporário à foto inválido.');
      const failed=()=>{if(disposed||current!==generation)return;clear();retry.disabled=false;status.textContent='Não foi possível carregar a foto. Consulte novamente.'};
      image.onload=()=>{
        if(disposed||current!==generation)return;
        if(Date.now()>=expiresAt){failed();return}
        if(!image.naturalWidth){failed();return}
        clearTimeout(timer);image.hidden=false;status.textContent='Foto enviada carregada.';retry.disabled=false;
        timer=setTimeout(()=>{clear();status.textContent='O acesso à foto expirou. Consulte novamente.'},Math.max(0,expiresAt-Date.now()));
      };
      image.onerror=failed;image.src=url.toString();timer=setTimeout(failed,Math.min(15_000,remaining));
    }catch(error){
      if(disposed||current!==generation)return;
      retry.disabled=false;status.textContent=error.code==='media_not_ready'?'A foto ainda está em processamento. Consulte novamente em instantes.':'Não foi possível consultar a foto enviada. Tente novamente.';
    }
  }
  retry.addEventListener('click',()=>void load());void load();
  return {dispose(){disposed=true;generation++;clear()}};
}
