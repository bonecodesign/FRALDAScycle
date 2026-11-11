import {createHash,timingSafeEqual} from 'node:crypto';
import {ServiceError} from './service-error.js';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const reference=/^[A-Za-z0-9][A-Za-z0-9._:-]{15,255}$/;
const digest=value=>createHash('sha256').update(value).digest();

export function createNotificationDeviceService(repository,{enabled=false,clock=Date.now}={}){return Object.freeze({
  async registerVerified(userId,input,providerProof){
    if(!enabled)throw new ServiceError('push_registration_not_configured',503,'Cadastro push não configurado.');
    const installationId=String(input?.installationId??''),providerReference=String(input?.providerReference??''),verifiedAt=Date.parse(providerProof?.verifiedAt??'');
    const expected=digest(providerReference),provided=Buffer.isBuffer(providerProof?.referenceHash)?providerProof.referenceHash:null;
    if(!uuid.test(String(userId??''))||!uuid.test(installationId)||!reference.test(providerReference)||input?.confirmed!==true||input?.noticeVersion!=='FC-PUSH-DEVICE-1'
      ||!provided||provided.length!==expected.length||!timingSafeEqual(provided,expected)||!Number.isFinite(verifiedAt)||verifiedAt>clock()||clock()-verifiedAt>5*60*1000)
      throw new ServiceError('invalid_push_device_proof',422,'Dispositivo push não confirmado pelo fornecedor.');
    const device=await repository.register({userId,providerReference,installationHash:digest(installationId),verifiedAt:new Date(verifiedAt)});
    if(!device)throw new ServiceError('push_device_conflict',409,'A referência push pertence a outro dispositivo.');
    return{device:{id:device.id,status:device.status,registeredAt:device.created_at,updatedAt:device.updated_at},providerReferenceExposed:false};
  },
  async revoke(userId,deviceId){if(!enabled)throw new ServiceError('push_registration_not_configured',503,'Cadastro push não configurado.');if(!uuid.test(String(userId??''))||!uuid.test(String(deviceId??'')))throw new ServiceError('invalid_push_device',422,'Dispositivo push inválido.');const device=await repository.revoke({userId,deviceId});if(!device)throw new ServiceError('push_device_not_found',404,'Dispositivo push não encontrado.');return{device:{id:device.id,status:device.status,revokedAt:device.revoked_at}};},
});}
