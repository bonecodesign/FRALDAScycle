import assert from 'node:assert/strict';
import test from 'node:test';
import {exchangeDifferenceDispute} from '../packages/contracts/exchange-difference-dispute.js';
const ticket='11111111-1111-4111-8111-111111111111';
test('post-collection dispute requires a support ticket and freezes funds',()=>{assert.deepEqual(exchangeDifferenceDispute({supportTicketId:ticket,reason:'  Pacote coletado, mas ocorreu um problema na entrega. '}),{supportTicketId:ticket,reason:'Pacote coletado, mas ocorreu um problema na entrega.',status:'open',fundsFrozen:true});});
test('invalid ticket or unauditable reason fail closed',()=>{for(const input of [{supportTicketId:'bad',reason:'Motivo suficientemente detalhado.'},{supportTicketId:ticket,reason:'curto'}])assert.throws(()=>exchangeDifferenceDispute(input),/invalid_exchange_difference_dispute/);});
