import { createHash } from 'node:crypto';
import { classifyAsaasWebhook,parseAsaasWebhook } from './asaas-webhook.js';

export function createAsaasWebhookService(repository,{accessToken}){return Object.freeze({
  async receive({raw,providedToken}){const parsed=parseAsaasWebhook({raw,accessToken:providedToken},accessToken),classified=classifyAsaasWebhook(parsed);const result=await repository.register({eventId:classified.eventId,eventType:parsed.event,paymentId:classified.paymentId,candidate:classified.candidate,payloadSha256:createHash('sha256').update(raw).digest('hex')});return Object.freeze({accepted:true,duplicate:result.duplicate,reconciliationPending:!result.duplicate,financialTransitionAllowed:false});},
});}
