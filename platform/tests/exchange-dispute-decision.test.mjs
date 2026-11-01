import assert from 'node:assert/strict';
import test from 'node:test';
import {exchangeDisputeDecision} from '../packages/contracts/exchange-dispute-decision.js';
test('three exact access levels accept auditable decisions',()=>{for(const [stage,level] of [['support_analysis',2],['finance_approval',3],['founder_authorization',5]])assert.equal(exchangeDisputeDecision({stage,actorAccessLevel:level,outcome:'release',note:'Decisão documentada com evidências revisadas.'}).requiredAccessLevel,level);});
test('wrong level, unsupported outcome or short note fail closed',()=>{for(const input of [{stage:'support_analysis',actorAccessLevel:3,outcome:'release',note:'Decisão detalhada.'},{stage:'finance_approval',actorAccessLevel:3,outcome:'wallet_credit',note:'Decisão detalhada.'},{stage:'founder_authorization',actorAccessLevel:5,outcome:'release',note:'curta'}])assert.throws(()=>exchangeDisputeDecision(input),/invalid_exchange_dispute_decision/);});
