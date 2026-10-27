import { ServiceError } from './service-error.js';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function createDataExportService(repository,{artifactService=null}={}){return Object.freeze({
  list(userId){return repository.list(userId);},
  detail(userId,requestId){if(!UUID.test(String(requestId??'')))throw new ServiceError('invalid_data_export_id',422,'Exportação inválida.');return repository.detail(userId,requestId);},
  async request(userId,input){if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>!['format','stepUpGrantId','confirmed'].includes(key))||!['json','csv'].includes(input.format)||!UUID.test(String(input.stepUpGrantId??''))||input.confirmed!==true)throw new ServiceError('invalid_data_export_request',422,'Escolha JSON ou CSV, confirme o pedido e a autorização de segurança.');return repository.request({userId,format:input.format,stepUpGrantId:input.stepUpGrantId});},
  async prepare(userId,requestId,input){if(!artifactService||!UUID.test(String(requestId??''))||!input||Object.keys(input).some(key=>!['password','expectedVersion','confirmed'].includes(key))||input.confirmed!==true||typeof input.password!=='string'||input.password.length<12||input.password.length>256||!Number.isSafeInteger(input.expectedVersion)||input.expectedVersion<0)throw new ServiceError('invalid_data_export_preparation',422,'Confirme a versão e informe a senha de criptografia.');return artifactService.prepare({userId,requestId,password:input.password,expectedVersion:input.expectedVersion});},
  download(userId,requestId){if(!artifactService||!UUID.test(String(requestId??'')))throw new ServiceError('invalid_data_export_id',422,'Exportação inválida.');return artifactService.download({userId,requestId});},
});}
