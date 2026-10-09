export async function preparePublicationAttempt(storage,key,source,build){
  let previous;try{previous=JSON.parse(storage.getItem(key))}catch{}
  const serialized=JSON.stringify(canonical(source));
  if(previous?.source===serialized&&previous.payload?.idempotencyKey)return previous.payload;
  if(previous?.payload?.idempotencyKey)throw new Error('O envio anterior ainda precisa ser confirmado. Retome os dados daquela tentativa antes de alterar o anúncio.');
  const payload={...await build(),idempotencyKey:crypto.randomUUID()};
  storage.setItem(key,JSON.stringify({source:serialized,payload,uncertain:false}));
  return payload;
}
export function publicationAttemptFailed(storage,key,error){
  let previous;try{previous=JSON.parse(storage.getItem(key))}catch{}
  if(!previous)return;
  if(!error.status||error.status>=500||[408,429].includes(error.status)||error.code==='listing_creation_conflict'){
    previous.uncertain=true;try{storage.setItem(key,JSON.stringify(previous))}catch{}
  }else if(!previous.uncertain)storage.removeItem(key);
}
function canonical(value){
  if(Array.isArray(value))return value.map(canonical);
  if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])]));
  return value;
}
export function pendingPublicationSource(storage,key){
  try{const saved=JSON.parse(storage.getItem(key));return saved?.uncertain?JSON.parse(saved.source):null}catch{return null}
}
