import assert from 'node:assert/strict';
import test from 'node:test';
import {BACKUP_EXPIRY_DAYS,CDN_PURGE_HOURS,PARTY_CONTENT_ACCESS_DAYS,contentRemovalDeadlines,mayReadRestrictedContent,partyContentAccessUntil,validateContentHoldSequence} from '../packages/contracts/user-content-retention.js';

test('removal revokes public use immediately and fixes CDN and backup deadlines',()=>{
 const result=contentRemovalDeadlines('2030-01-01T12:00:00Z');
 assert.equal(result.publicRevokedAt,'2030-01-01T12:00:00.000Z');
 assert.equal(result.cdnPurgeDueAt,'2030-01-02T12:00:00.000Z');
 assert.equal(result.backupExpireBy,'2030-01-31T12:00:00.000Z');
 assert.equal(CDN_PURGE_HOURS,24);assert.equal(BACKUP_EXPIRY_DAYS,30);
});

test('parties retain restricted access for exactly seven days or while a dispute is open',()=>{
 const completedAt='2030-01-01T12:00:00Z';assert.equal(PARTY_CONTENT_ACCESS_DAYS,7);assert.equal(partyContentAccessUntil(completedAt),'2030-01-08T12:00:00.000Z');
 assert.equal(mayReadRestrictedContent({actorKind:'party',completedAt,now:'2030-01-08T12:00:00Z'}),true);
 assert.equal(mayReadRestrictedContent({actorKind:'party',completedAt,now:'2030-01-08T12:00:00.001Z'}),false);
 assert.equal(mayReadRestrictedContent({actorKind:'party',completedAt,disputeOpen:true,now:'2031-01-01T00:00:00Z'}),true);
 assert.equal(mayReadRestrictedContent({actorKind:'public',listingPublished:false}),false);
});

test('internal access needs authorization and a live obligation while holds follow 3 then 4 then 5',()=>{
 assert.equal(mayReadRestrictedContent({actorKind:'internal',internalAuthorized:true,legalHoldActive:true}),true);
 assert.equal(mayReadRestrictedContent({actorKind:'internal',internalAuthorized:true}),false);
 assert.equal(mayReadRestrictedContent({actorKind:'internal',legalHoldActive:true}),false);
 assert.equal(validateContentHoldSequence(['level3','level4','level5']),true);
 for(const invalid of [['level4'],['level3','level5'],['level3','level4','level5','level5']])assert.equal(validateContentHoldSequence(invalid),false);
});
