import assert from 'node:assert/strict';
import test from 'node:test';
import {exchangeReconciliationAuthorization,exchangeReconciliationProposal} from '../packages/contracts/exchange-reconciliation-decision.js';

test('level 3 proposes and levels 4 or 5 authorize reconciliation',()=>{assert.equal(exchangeReconciliationProposal({actorAccessLevel:3,action:'confirm_with_provider',evidenceReference:'provider:case:123',note:'Evidência externa revisada pelo financeiro.'}).action,'confirm_with_provider');for(const level of[4,5])assert.equal(exchangeReconciliationAuthorization({actorAccessLevel:level,note:'Autorização registrada após revisão independente.'}).actorAccessLevel,level);});
test('other levels, unknown actions and short evidence fail closed',()=>{assert.throws(()=>exchangeReconciliationProposal({actorAccessLevel:2,action:'confirm_with_provider',evidenceReference:'provider:123',note:'Evidência revisada.'}));assert.throws(()=>exchangeReconciliationProposal({actorAccessLevel:3,action:'repeat_charge',evidenceReference:'provider:123',note:'Evidência revisada.'}));assert.throws(()=>exchangeReconciliationAuthorization({actorAccessLevel:3,note:'Autorização registrada.'}));});
