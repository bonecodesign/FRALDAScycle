import { createHash } from 'node:crypto';
import { detectProhibitedContent,CONTENT_RULE_VERSION } from '../../packages/contracts/content-moderation.js';
import { ServiceError } from './service-error.js';
export async function assertContentAllowed(repository,userId,surface,text,transactionId=null) {
  const reasons=detectProhibitedContent(text,{chat:surface==='chat',review:surface==='review'});
  if(!reasons.length) return;
  const input={userId,surface,transactionId,reasons,ruleVersion:CONTENT_RULE_VERSION,hash:createHash('sha256').update(text).digest('hex')};
  if(repository?.exception && await repository.exception(input)) return;
  const record=repository?.recordBlocked ? await repository.recordBlocked(input) : null;
  throw new ServiceError('content_requires_moderation',422,`Conteúdo bloqueado por possível contato ou informação privada (${reasons.join(', ')}). Corrija ou conteste pelo suporte${record?.id ? ' com o registro '+record.id : ''}.`);
}
