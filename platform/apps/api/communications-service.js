import { ServiceError } from './service-error.js';
import { assertContentAllowed } from './content-guard.js';
const strict=(input,keys)=>input&&typeof input==='object'&&!Array.isArray(input)&&Object.keys(input).every(key=>keys.includes(key));
export function createCommunicationsService(repository,moderation) {
  return Object.freeze({
    messages(userId,transactionId) { return repository.messages(userId,transactionId); },
    async send(userId,transactionId,input) {
      if(!strict(input,['body','idempotencyKey'])||typeof input.body!=='string'||!input.body.trim()||input.body.length>2000||typeof input.idempotencyKey!=='string'||input.idempotencyKey.length<16||input.idempotencyKey.length>128)throw new ServiceError('invalid_message',422,'Informe mensagem de até 2000 caracteres e chave de repetição.');
      await repository.canAccess(userId,transactionId);
      const body=input.body.trim(); await assertContentAllowed(moderation,userId,'chat',body,transactionId);
      return repository.send(userId,transactionId,{body,idempotencyKey:input.idempotencyKey});
    },
    async review(userId,transactionId,input) {
      if(!strict(input,['rating','comment'])||!Number.isInteger(input.rating)||input.rating<1||input.rating>5||typeof input.comment!=='string'||!input.comment.trim()||input.comment.length>1000)throw new ServiceError('invalid_review',422,'Informe nota de 1 a 5 e comentário de até 1000 caracteres.');
      await repository.canAccess(userId,transactionId,true);
      const comment=input.comment.trim(); await assertContentAllowed(moderation,userId,'review',comment,transactionId);
      return repository.review(userId,transactionId,{rating:input.rating,comment});
    },
    publicReviews(subjectId) { return repository.publicReviews(subjectId); },
  });
}
