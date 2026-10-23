import "/apps/admin/auth.js";
import "/apps/admin/navigation.js";
import { apiRequest } from "/packages/contracts/api-client.js";

const status=document.getElementById('pilot-invitation-status');
const rows=document.getElementById('pilot-invitation-rows');
const issue=document.getElementById('pilot-invitation-issue');
const revoke=document.getElementById('pilot-invitation-revoke');
const tokenBox=document.getElementById('pilot-invitation-token');
const dateTime=new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'});
const cell=(row,value)=>{const td=document.createElement('td');td.textContent=value;row.append(td);};
function state(item){if(item.revoked_at)return'Revogado';if(item.consumed_at)return'Consumido';if(Date.parse(item.expires_at)<=Date.now())return'Expirado';return'Emitido';}
async function load(){status.textContent='Consultando convites…';try{const result=await apiRequest('/v1/admin/pilot-invitations?limit=50');rows.replaceChildren();for(const item of result.items??[]){const row=document.createElement('tr');cell(row,item.email);cell(row,item.purpose);cell(row,dateTime.format(new Date(item.expires_at)));cell(row,state(item));cell(row,item.id);rows.append(row);}status.textContent=`${rows.rows.length} convite(s) consultado(s).`;}catch(error){rows.replaceChildren();status.textContent=error.message||'Convites indisponíveis.';}}
issue.addEventListener('submit',async event=>{event.preventDefault();const button=issue.querySelector('button');button.disabled=true;tokenBox.hidden=true;try{const data=new FormData(issue);const expiresAt=new Date(data.get('expiresAt')).toISOString();const result=await apiRequest('/v1/admin/pilot-invitations',{method:'POST',body:{email:String(data.get('email')).trim(),purpose:String(data.get('purpose')).trim(),expiresAt,requestReference:`pilot-ui:${crypto.randomUUID()}`}});if(result.token){tokenBox.querySelector('code').textContent=result.token;tokenBox.hidden=false;}status.textContent=result.reused?'Convite já registrado; o token não é reexibido.':'Convite gerado sem envio externo. Copie o token agora.';await load();}catch(error){status.textContent=error.message||'Não foi possível gerar o convite.';}finally{button.disabled=false;}});
revoke.addEventListener('submit',async event=>{event.preventDefault();const button=revoke.querySelector('button');button.disabled=true;try{const data=new FormData(revoke),id=String(data.get('invitationId')).trim();await apiRequest(`/v1/admin/pilot-invitations/${encodeURIComponent(id)}/revoke`,{method:'POST',body:{reason:String(data.get('reason')).trim()}});status.textContent='Convite revogado e auditado.';revoke.reset();await load();}catch(error){status.textContent=error.message||'Não foi possível revogar o convite.';}finally{button.disabled=false;}});
document.getElementById('pilot-invitation-refresh').addEventListener('click',load);
await load();
