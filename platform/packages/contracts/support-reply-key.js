// Only the random key and digest are kept; message text remains in the form.
export async function supportReplyKey(ticketId,body,status,{storage=sessionStorage,cryptography=crypto}={}){
 const namespace='fc.supportReplyKey:'+ticketId;
 const bytes=new TextEncoder().encode(JSON.stringify([ticketId,body,status]));
 const fingerprint=Array.from(new Uint8Array(await cryptography.subtle.digest('SHA-256',bytes)),byte=>byte.toString(16).padStart(2,'0')).join('');
 let existing;try{existing=JSON.parse(storage.getItem(namespace));}catch{/* Invalid saved data is not an intent. */}
 if(existing?.fingerprint===fingerprint&&typeof existing.key==='string'&&/^[a-zA-Z0-9:_-]{16,128}$/.test(existing.key))return existing.key;
 const key=cryptography.randomUUID();storage.setItem(namespace,JSON.stringify({key,fingerprint}));return key;
}
export function clearSupportReplyKey(ticketId,key,{storage=sessionStorage}={}){
 const namespace='fc.supportReplyKey:'+ticketId;let existing;try{existing=JSON.parse(storage.getItem(namespace));}catch{return;}
 if(existing?.key===key)storage.removeItem(namespace);
}
