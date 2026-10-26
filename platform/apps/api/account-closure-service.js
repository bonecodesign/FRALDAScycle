import { ServiceError } from './service-error.js';
import { validateAccountClosureSubmission } from '../../packages/contracts/account-closure.js';

export function createAccountClosureService(repository,{clock=Date.now}={}){return Object.freeze({
  status(userId){return repository.status(userId);},
  async request(userId,input){let validated;try{validated=validateAccountClosureSubmission(userId,input);}catch{throw new ServiceError('invalid_account_closure_request',422,'Confirme o encerramento, o aviso e a autorização de segurança.');}return repository.request(validated);},
  async cancel(userId,requestId,input){if(!/^[0-9a-f-]{36}$/i.test(String(requestId??''))||!input||Object.keys(input).some(key=>!['confirmed','expectedVersion'].includes(key))||input.confirmed!==true||!Number.isSafeInteger(input.expectedVersion)||input.expectedVersion<0)throw new ServiceError('invalid_account_closure_cancellation',422,'Confirme o cancelamento usando a versão atual.');return repository.cancel({userId,requestId,expectedVersion:input.expectedVersion});},
});}
