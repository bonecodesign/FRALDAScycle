import { catalogHasModel, DIAPER_SIZES } from './diaper-catalog.js';
import { publicationText } from './publication-review.js';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const states=new Set('AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' '));
export function validatePublicationDraft(draft,{mediaKeys=[],surface='app'}={}){
  if(!draft||typeof draft!=='object'||Array.isArray(draft))draft={};
  const issues=[],add=(step,code,message)=>issues.push({step,code,message});
  if(!['sale','exchange','donation'].includes(draft.kind))add(1,'kind','Escolha venda, troca ou doação na etapa Tipo.');
  const text=publicationText(draft);
  if(text.title.length<5||text.title.length>120)add(2,'title','Informe um título entre 5 e 120 caracteres na etapa Produto.');
  if(!catalogHasModel(draft.category,draft.brand,draft.model))add(2,'model','Escolha a categoria, marca e modelo na etapa Produto.');
  if(!DIAPER_SIZES.includes(draft.size))add(2,'size','Escolha o tamanho na etapa Produto.');
  if(!/^\d+$/.test(String(draft.quantity??''))||!Number.isSafeInteger(Number(draft.quantity))||Number(draft.quantity)<1||Number(draft.quantity)>100_000)add(2,'quantity','Informe entre 1 e 100.000 unidades na etapa Produto.');
  if(!Array.isArray(mediaKeys)||mediaKeys.length<1||mediaKeys.length>8||new Set(mediaKeys).size!==mediaKeys.length||mediaKeys.some(key=>typeof key!=='string'||!/^listings\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9._/-]+$/.test(key)||key.length>512||key.includes('..')))add(3,'photo','Adicione uma foto do produto na etapa Fotos antes de enviar para revisão.');
  if(!['sealed','open'].includes(draft.packageCondition)||draft.packageCondition==='open'&&draft.kind!=='donation')add(4,'condition','Venda e troca exigem pacote fechado; confira a etapa Condição.');
  if(draft.packageCondition==='open'&&draft.openPackageAttested!==true)add(4,'attestation','Confirme as condições sanitárias na etapa Condição.');
  if(draft.kind==='donation'&&!uuid.test(draft.institutionId||''))add(4,'institution','Escolha uma instituição destinatária na etapa Condição.');
  if(!/^(?:\d{4}-(?:0[1-9]|1[0-2])|(?:0[1-9]|1[0-2])\/\d{4})$/.test(draft.expiry||''))add(4,'expiry','Informe mês e ano válidos na etapa Condição.');
  if(typeof draft.description!=='string'||draft.description.trim().length<20||text.description.length>4000)add(4,'description','Descreva o produto com pelo menos 20 caracteres; o texto completo deve ter até 4.000.');
  if(draft.kind==='sale'&&(!Number.isSafeInteger(draft.priceCents)||draft.priceCents<=0))add(5,'price','Informe um preço válido na etapa Preço.');
  if(draft.delivery!=='Entrega por parceiro')add(6,'delivery','No piloto, selecione a entrega por parceiro.');
  if(surface==='app'&&(!/^\d{8}$/.test(String(draft.postalCode||'').replace(/\D/g,''))||!String(draft.neighborhood||'').trim()))add(7,'region','Informe um CEP válido e o bairro na etapa Localização.');
  if(typeof draft.city!=='string'||draft.city.trim().length<2||draft.city.trim().length>120||!states.has(String(draft.state||'').toUpperCase()))add(7,'city','Informe cidade e uma UF brasileira na etapa Localização.');
  return issues;
}

export function parsePublicationRegion(value){
  const match=String(value||'').trim().match(/^(.+?),\s*(.+?)\s*-\s*([a-z]{2})$/i);
  return match?{neighborhood:match[1].trim(),city:match[2].trim(),state:match[3].toUpperCase()}:{city:null,state:null};
}

export function renderPublicationIssues(container,issues,{surface='app',onNavigate}={}){
  const heading=document.createElement('p');heading.textContent='Confira os dados antes de enviar:';
  const list=document.createElement('ul');
  issues.forEach(issue=>{
    const item=document.createElement('li');const control=document.createElement(surface==='app'?'a':'button');control.textContent=issue.message;
    if(surface==='app')control.href=`/app/publish-${issue.step}`;
    else{control.type='button';control.addEventListener('click',()=>onNavigate(issue.step))}
    item.append(control);list.append(item);
  });
  container.setAttribute('role','alert');container.replaceChildren(heading,list);
}
