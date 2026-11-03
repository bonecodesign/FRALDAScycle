import {createCipheriv,createDecipheriv,createHash,randomBytes as secureRandomBytes} from 'node:crypto';
import {ServiceError} from './service-error.js';

const TOKEN=/^[A-Za-z0-9_-]{43}$/;
const ROOT=new Set(['fullName','displayName','contact','address','step']);
const ADDRESS=new Set(['postalCode','street','number','complement','noComplement','district','city','state']);
const fail=(code,status,message)=>new ServiceError(code,status,message);
const text=(value,max)=>{const result=String(value??'').trim();if(result.length>max)throw fail('invalid_registration_draft',422,'O rascunho contém um campo inválido.');return result;};

function validateDraft(input){
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>!ROOT.has(key)))throw fail('invalid_registration_draft',422,'Rascunho de cadastro inválido.');
 const address=input.address??{};
 if(typeof address!=='object'||Array.isArray(address)||Object.keys(address).some(key=>!ADDRESS.has(key)))throw fail('invalid_registration_draft',422,'Endereço do rascunho inválido.');
 const step=Number(input.step);
 if(![1,2].includes(step))throw fail('invalid_registration_draft',422,'Etapa do rascunho inválida.');
 return Object.freeze({fullName:text(input.fullName,160),displayName:text(input.displayName,100),contact:text(input.contact,320),step,address:Object.freeze({postalCode:text(address.postalCode,9),street:text(address.street,180),number:text(address.number,30),complement:text(address.complement,120),noComplement:address.noComplement===true,district:text(address.district,120),city:text(address.city,120),state:text(address.state,2).toUpperCase()})});
}

function tokenHash(token){return createHash('sha256').update(`registration-draft:${token}`).digest();}

export function createRegistrationDraftService(repository,{encryptionKey,clock=()=>Date.now(),randomBytes=secureRandomBytes}={}){
 const key=Buffer.from(String(encryptionKey??''),'base64url');
 if(key.length!==32)throw new Error('Registration draft encryption key must decode to 32 bytes');
 const encrypt=value=>{const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv),encryptedPayload=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);return{encryptedPayload,iv,tag:cipher.getAuthTag()};};
 const decrypt=row=>{try{const decipher=createDecipheriv('aes-256-gcm',key,row.encryption_iv);decipher.setAuthTag(row.authentication_tag);return JSON.parse(Buffer.concat([decipher.update(row.encrypted_payload),decipher.final()]).toString('utf8'));}catch{throw fail('registration_draft_unavailable',404,'Rascunho indisponível ou expirado.');}};
 const requiredToken=value=>{const token=String(value??'');if(!TOKEN.test(token))throw fail('registration_draft_unavailable',404,'Rascunho indisponível ou expirado.');return token;};
 return Object.freeze({
  async save(input){const draft=validateDraft(input?.draft),provided=input?.resumeToken==null?null:requiredToken(input.resumeToken),sealed=encrypt(draft);if(provided){const current=await repository.find(tokenHash(provided));if(!current)throw fail('registration_draft_unavailable',404,'Rascunho indisponível ou expirado.');const updated=await repository.update({id:current.id,...sealed});if(!updated)throw fail('registration_draft_unavailable',404,'Rascunho indisponível ou expirado.');return{resumeToken:provided,expiresAt:updated.expires_at};}const resumeToken=randomBytes(32).toString('base64url'),expiresAt=new Date(clock()+24*60*60*1000);const created=await repository.create({tokenHash:tokenHash(resumeToken),...sealed,expiresAt});return{resumeToken,expiresAt:created.expires_at};},
  async resume(input){const token=requiredToken(input?.resumeToken),row=await repository.find(tokenHash(token));if(!row)throw fail('registration_draft_unavailable',404,'Rascunho indisponível ou expirado.');return{draft:validateDraft(decrypt(row)),resumeToken:token,expiresAt:row.expires_at};},
  async remove(input){const token=requiredToken(input?.resumeToken);await repository.remove(tokenHash(token));return{removed:true};},
 });
}

