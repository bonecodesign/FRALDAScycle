import { listingPrice, saleSplit } from './commercial-rules.js';

export function publicationText(draft) {
  const title=(typeof draft.title==='string'?draft.title.trim():'')||[draft.brand,draft.model,draft.size].filter(Boolean).join(' ') + (draft.quantity ? ` · ${draft.quantity} unidades` : '');
  const description=[typeof draft.description==='string'?draft.description.trim():'',draft.expiry?`Validade informada: ${draft.expiry}.`:'',draft.delivery?`Preferência de entrega: ${draft.delivery}.`:''].filter(Boolean).join('\n');
  return {title,description};
}

export function renderPublicationReview(container,draft,{photoPreview=null,hasPhoto=false}={}) {
  const element=(tag,text,className)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node};
  const {title,description}=publicationText(draft);
  const heading=element('h2','Revise seu anúncio');
  const card=element('article',undefined,'phone-card review-product');
  if(photoPreview){const image=element('img');image.src=photoPreview;image.alt='Prévia local da foto selecionada';card.append(image)}
  const details=element('div');
  details.append(element('span',({sale:'Venda',exchange:'Troca',donation:'Doação'})[draft.kind]||'Tipo não informado','badge'),element('strong',title||'Produto não informado'),element('p',`${draft.size||'Tamanho não informado'} · ${draft.quantity||'Quantidade não informada'} unidades`));
  const price=element('div',undefined,'price');
  try{
    const amount=listingPrice(draft);
    if(amount===null)price.textContent=draft.kind==='donation'?'Doação sem preço de venda':'Troca sem preço de venda';
    else{
      const split=saleSplit(amount),money=value=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(value/100);
      price.textContent=`${money(amount)} · Comissão: ${money(split.platformCents)} · Você recebe: ${money(split.sellerCents)} antes da tarifa do processador`;
    }
  }catch(error){price.textContent=error.message}
  details.append(price);card.append(details);
  const list=element('ul',undefined,'review-list');
  const rows=[draft.packageCondition==='sealed'?'Pacote fechado e lacrado':draft.packageCondition==='open'?'Pacote aberto para doação':'Condição não informada',draft.expiry?`Validade informada: ${draft.expiry}`:'Validade não informada',draft.delivery?`Preferência de entrega: ${draft.delivery}`:'Preferência de entrega não informada',draft.location?`Região informada: ${draft.location}`:'Região não informada',hasPhoto?'Foto enviada; processamento conferido ao enviar':'Foto não enviada'];
  if(draft.kind==='donation')rows.push(`Instituição destinatária: ${draft.institutionName||'Não selecionada'}`);
  if(draft.packageCondition==='open')rows.push(draft.openPackageAttested?'Condições sanitárias declaradas':'Declaração sanitária pendente');
  rows.forEach(text=>list.append(element('li',text)));
  const descriptionNode=element('p',description||'Descrição não informada');descriptionNode.style.whiteSpace='pre-wrap';
  container.replaceChildren(heading,card,list,descriptionNode,element('p','O anúncio será enviado para revisão. Entrega e frete dependem de confirmação na negociação.'));
}
