const DAY_MS=24*60*60*1000;
export const PARTY_CONTENT_ACCESS_DAYS=7;
export const CDN_PURGE_HOURS=24;
export const BACKUP_EXPIRY_DAYS=30;

const instant=value=>{const time=new Date(value).getTime();if(!Number.isFinite(time))throw new TypeError('Data de retenção inválida.');return time;};
const iso=value=>new Date(value).toISOString();

export function contentRemovalDeadlines(removedAt){const removed=instant(removedAt);return Object.freeze({
 publicRevokedAt:iso(removed),
 cdnPurgeDueAt:iso(removed+CDN_PURGE_HOURS*60*60*1000),
 backupExpireBy:iso(removed+BACKUP_EXPIRY_DAYS*DAY_MS),
});}

export function partyContentAccessUntil(completedAt){return iso(instant(completedAt)+PARTY_CONTENT_ACCESS_DAYS*DAY_MS);}

export function mayReadRestrictedContent({actorKind,listingPublished=false,operationActive=false,completedAt=null,disputeOpen=false,legalHoldActive=false,internalAuthorized=false,now=Date.now()}={}){
 const current=instant(now);
 if(actorKind==='public')return listingPublished;
 if(actorKind==='party')return operationActive||disputeOpen||(completedAt!==null&&current<=instant(partyContentAccessUntil(completedAt)));
 if(actorKind==='internal')return Boolean(internalAuthorized&&(operationActive||disputeOpen||legalHoldActive));
 return false;
}

export function validateContentHoldSequence(stages){const expected=['level3','level4','level5'];if(!Array.isArray(stages)||stages.length>expected.length)return false;return stages.every((stage,index)=>stage===expected[index]);}
