import { apiRequest } from './api-client.js';

export function institutionAcceptsCondition(institution, condition) {
  return Boolean(institution) && (condition !== 'open' || institution.open_packages_accepted === true);
}

// Only public data from the active-institution endpoint is shown here.
// Publication rechecks eligibility on the server inside the transaction.
export function mountDonationInstitutionPicker(container, {
  selectedId = '', getCondition = () => 'sealed', onChange,
  request = apiRequest,
}) {
  let items=[], selected=selectedId, offset=0, generation=0, disposed=false, ready=false, busy=false, queryCity='';
  const label=document.createElement('label');label.className='field full';
  const title=document.createElement('span');title.textContent='Instituição destinatária';
  const select=document.createElement('select');select.required=true;
  const status=document.createElement('p');status.setAttribute('role','status');
  const searchLabel=document.createElement('label');searchLabel.className='field full';
  const searchTitle=document.createElement('span');searchTitle.textContent='Filtrar por cidade (opcional)';
  const city=document.createElement('input');city.type='search';city.maxLength=100;
  const search=document.createElement('button');search.type='button';search.className='button secondary';search.textContent='Buscar instituições';
  const more=document.createElement('button');more.type='button';more.className='button secondary';more.textContent='Carregar mais instituições';more.hidden=true;
  const retry=document.createElement('button');retry.type='button';retry.className='button secondary';retry.textContent='Tentar novamente';retry.hidden=true;
  label.append(title,select);searchLabel.append(searchTitle,city);
  container.append(label,searchLabel,search,status,more,retry);
  const emit=()=>onChange(items.find(item=>item.id===selected&&institutionAcceptsCondition(item,getCondition()))||null);
  const render=()=>{
    select.replaceChildren();
    const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent='Selecione uma instituição';select.append(placeholder);
    const eligible=items.filter(item=>institutionAcceptsCondition(item,getCondition()));
    for(const item of eligible){const option=document.createElement('option');option.value=item.id;option.textContent=[item.public_name,item.city,item.state].filter(Boolean).join(' — ');select.append(option)}
    if(!eligible.some(item=>item.id===selected))selected='';
    select.value=selected;select.disabled=!ready||busy||!eligible.length;
    if(ready&&!busy)status.textContent=eligible.length?'A instituição será conferida novamente ao enviar o anúncio.':getCondition()==='open'?'Nenhuma instituição nesta lista aceita pacotes abertos. Busque outra cidade ou carregue mais resultados.':'Nenhuma instituição habilitada encontrada nesta consulta.';
    emit();
  };
  async function load(reset=true){
    if(disposed)return;
    const current=++generation;busy=true;ready=false;
    if(reset){items=[];offset=0;queryCity=city.value.trim()}
    select.disabled=true;search.disabled=true;more.disabled=true;retry.hidden=true;
    status.textContent='Consultando instituições habilitadas...';emit();
    try{
      const query=new URLSearchParams({limit:'100',offset:String(offset)});
      if(queryCity)query.set('city',queryCity);
      const result=await request(`/v1/institutions?${query}`);
      if(disposed||current!==generation)return;
      if(!Array.isArray(result.items))throw new Error('Resposta de instituições inválida.');
      items=[...new Map([...items,...result.items].map(item=>[item.id,item])).values()];
      offset+=result.items.length;more.hidden=result.items.length<100;ready=true;
    }catch(error){
      if(disposed||current!==generation)return;
      selected='';onChange(null);status.textContent='Não foi possível consultar as instituições. Tente novamente.';retry.hidden=false;more.hidden=true;
    }finally{
      if(!disposed&&current===generation){busy=false;search.disabled=false;more.disabled=false;if(ready)render()}
    }
  }
  select.addEventListener('change',()=>{selected=select.value;emit()});
  search.addEventListener('click',()=>{selected='';void load()});
  more.addEventListener('click',()=>void load(false));retry.addEventListener('click',()=>void load());
  void load();
  return {
    refresh(){if(!disposed)render()},
    validate(){return !disposed&&ready&&!busy&&Boolean(items.find(item=>item.id===selected&&institutionAcceptsCondition(item,getCondition())))},
    dispose(){disposed=true;generation++},
  };
}
