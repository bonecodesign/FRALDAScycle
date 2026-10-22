import assert from 'node:assert/strict';
import {validateSyntheticAddressChange} from './beta-address-change-check.mjs';
import { createLogisticsRepository } from '../database/logistics-repository.js';
import { createLogisticsService } from '../apps/api/logistics-service.js';
import { createMarketplaceRepository } from '../database/marketplace-repository.js';
import { createMarketplaceService } from '../apps/api/marketplace-service.js';

export async function validateSyntheticSale(database, { user, other, transaction }) {
  const admin = '10000000-0000-4000-8000-000000000003';
  const courier = '10000000-0000-4000-8000-000000000004';
  await database.query(`INSERT INTO users(id,email,password_hash,display_name,role)
    VALUES($1,'synthetic-admin@example.test','synthetic-unusable-hash','Admin fictício','admin'),
          ($2,'synthetic-courier@example.test','synthetic-unusable-hash','Entregador fictício','courier')`, [admin, courier]);
  const repository = createLogisticsRepository(database);
  const service = createLogisticsService(repository, null, null);
  const support = createMarketplaceService(createMarketplaceRepository(database));
  // Exclusivamente uma fixture no banco efêmero: nenhum adaptador financeiro é chamado.
  await database.query(`UPDATE transactions SET status='paid' WHERE id=$1`, [transaction]);
  await database.query(`INSERT INTO payment_intents(transaction_id,buyer_id,idempotency_key,method,amount_cents,platform_fee_cents,delivery_fee_cents,seller_amount_cents,provider_reference,status)
    VALUES($1,$2,'synthetic-native-paid-intent','pix',10000,800,0,9200,'synthetic-only-paid-reference','paid')`, [transaction, other]);
  const shipmentInput = { transactionId: transaction, mode: 'pickup', insured: false, idempotencyKey: 'synthetic-native-pickup' };
  const creations = await Promise.all([service.create(other, shipmentInput), service.create(other, shipmentInput)]);
  assert.equal(creations.filter(x=>!x.reused).length,1);
  const { shipment } = creations[0];
  assert.equal((await database.query('SELECT count(*)::int AS count FROM shipment_events WHERE shipment_id=$1',[shipment.id])).rows[0].count,1);
  await assert.rejects(service.create(user,shipmentInput),e=>e.code==='shipment_idempotency_conflict');
  await assert.rejects(service.create(other,{...shipmentInput,insured:true}),e=>e.code==='shipment_idempotency_conflict');
  await assert.rejects(service.create(other,{...shipmentInput,transactionId:'90000000-0000-4000-8000-000000000099'}),e=>e.code==='shipment_idempotency_conflict');
  await assert.rejects(service.create(other,{...shipmentInput,idempotencyKey:'synthetic-second-pickup-key'}),e=>e.code==='shipment_already_exists');
  // Simulate the stale preflight explicitly: final insertion must reject a cancelled transaction.
  await database.query("UPDATE transactions SET status='cancelled' WHERE id=$1",[transaction]);
  await assert.rejects(repository.createShipment({...shipmentInput,buyerId:other,sellerId:user,idempotencyKey:'synthetic-cancelled-pickup'}),e=>e.code==='shipment_not_allowed');
  await database.query("UPDATE transactions SET status='paid' WHERE id=$1",[transaction]);
  const address = await service.createAddress(user, { label: 'Fixture interna', postalCode: '00000000', street: 'Rua fictícia da fixture', number: 'S/N', district: 'Bairro fictício', city: 'Belo Horizonte', state: 'MG' });
  await assert.rejects(service.shareAddress(user, shipment.id, { addressId: address.id, confirmed: false, noticeVersion: 'FC-ADDRESS-1' }), error => error.status === 422);
  await assert.rejects(service.shareAddress(other, shipment.id, { addressId: address.id, confirmed: true, noticeVersion: 'FC-ADDRESS-1' }), error => error.code === 'address_recipient_pending');
  const consent = { addressId: address.id, confirmed: true, noticeVersion: 'FC-ADDRESS-1' };
  const shares = await Promise.all([service.shareAddress(user, shipment.id, consent), service.shareAddress(user, shipment.id, consent)]);
  assert.equal(shares.filter(share => share.reused === false).length, 1);
  assert.equal((await service.sharedAddresses(other, shipment.id)).length, 1);
  await assert.rejects(service.sharedAddresses(admin, shipment.id), error => error.status === 404);
  await assert.rejects(service.sharedAddresses(courier, shipment.id), error => error.status === 404);
  assert.ok((await database.query('SELECT address_shared_at FROM transactions WHERE id=$1', [transaction])).rows[0].address_shared_at);
  assert.equal((await database.query('SELECT count(*)::integer AS count FROM shipment_address_shares')).rows[0].count, 1);
  await assert.rejects(support.cancelTransaction(other, transaction), error => error.code === 'cancellation_requires_support');
  await assert.rejects(service.approveReceipt(other, shipment.id, { approved: true }), error => error.code === 'receipt_not_ready');
  await validateSyntheticAddressChange(database,{service,repository,user,other,admin,shipment,address});
  await database.query("UPDATE transactions SET status='disputed' WHERE id=$1",[transaction]);
  await assert.rejects(service.assign(courier,shipment.id),error=>error.code==='shipment_not_available');
  assert.equal((await database.query('SELECT courier_id FROM shipments WHERE id=$1',[shipment.id])).rows[0].courier_id,null);
  await database.query("UPDATE transactions SET status='paid' WHERE id=$1",[transaction]);
  const pendingCancellation=await support.createSupportTicket(other,{category:'cancellation',subject:'Cancelamento fictício antes da coleta',details:'Pendência fictícia para impedir a atribuição enquanto o suporte analisa.',transactionId:transaction,idempotencyKey:'synthetic-pre-assignment-cancellation'});
  await assert.rejects(service.assign(courier,shipment.id),error=>error.code==='shipment_not_available');
  await database.query("UPDATE support_tickets SET status='resolved' WHERE id=$1",[pendingCancellation.ticket.id]);
  const paymentIntentId=(await database.query('SELECT id FROM payment_intents WHERE transaction_id=$1',[transaction])).rows[0].id;
  const pendingFinancialCase=(await database.query(`INSERT INTO payment_cases(payment_intent_id,requester_id,kind,idempotency_key,reason,details)
    VALUES($1,$2,'dispute','synthetic-pre-assignment-financial-case','Disputa fictícia','Pendência fictícia para impedir atribuição logística.') RETURNING id`,[paymentIntentId,other])).rows[0].id;
  await assert.rejects(service.assign(courier,shipment.id),error=>error.code==='shipment_not_available');
  await database.query("UPDATE payment_cases SET status='rejected' WHERE id=$1",[pendingFinancialCase]);
  await service.assign(courier, shipment.id);
  await assert.rejects(service.sharedAddresses(courier, shipment.id), error => error.status === 404);
  const collected=await Promise.all([service.collect(courier,shipment.id,{confirmed:true,noticeVersion:'FC-COLLECTION-1'}),service.collect(courier,shipment.id,{confirmed:true,noticeVersion:'FC-COLLECTION-1'})]);
  assert.equal(collected.filter(x=>!x.reused).length,1);
  const proofInput = { mediaKey: 'synthetic/delivery-proof-key', recipientName: 'Recebedor fictício', latitude: 0, longitude: 0 };
  await assert.rejects(service.proof(user, shipment.id, proofInput), error => error.status === 403);
  const proof = await service.proof(courier, shipment.id, proofInput);
  assert.equal(proof.duplicate, false);
  assert.equal((await service.proof(courier, shipment.id, proofInput)).duplicate, true);
  await assert.rejects(service.approveReceipt(user, shipment.id, { approved: true }), error => error.status === 404);
  const receipts = await Promise.all([service.approveReceipt(other, shipment.id, { approved: true }), service.approveReceipt(other, shipment.id, { approved: true })]);
  assert.equal(receipts.filter(receipt => receipt.reused === false).length, 1);
  const validation = { validated: true, reason: 'Conferência fictícia sem mídia de fornecedor real.' };
  await assert.rejects(service.validateProof({ id: other, role: 'customer' }, shipment.id, validation), error => error.status === 403);
  await assert.rejects(service.validateProof({ id: other, role: 'admin' }, shipment.id, validation), error => error.code === 'independent_validation_required');
  const reviews = await Promise.all([service.validateProof({ id: admin, role: 'admin' }, shipment.id, validation), service.validateProof({ id: admin, role: 'admin' }, shipment.id, validation)]);
  assert.equal(reviews.filter(review => review.reused === false).length, 1);
  await assert.rejects(service.receiptEvidence({ id: '10000000-0000-4000-8000-000000000099', role: 'customer' }, shipment.id), error => error.status === 404);
  const status = await service.settlementStatus({ id: user, role: 'customer' }, shipment.id);
  assert.equal(status.requirementsMet, true);
  assert.equal(status.payoutAllowed, false);
  assert.equal((await database.query('SELECT status FROM transactions WHERE id=$1', [transaction])).rows[0].status, 'in_delivery');
  const ticket = await support.createSupportTicket(other, { category: 'receipt_problem', occurrenceKind:'damaged_package', subject: 'Ocorrência fictícia de recebimento', details: 'Caso sintético para verificar o bloqueio da consulta, sem dados reais.', transactionId: transaction, idempotencyKey: 'synthetic-native-support-ticket' });
  assert.match(String(ticket.ticket.protocol), /^[1-9]\d*$/);
  assert.equal((await service.settlementStatus({ id: user, role: 'customer' }, shipment.id)).requirementsMet, false);
  await assert.rejects(support.replySupportTicket({ id: other, role: 'customer' }, ticket.ticket.id, { body: 'Resposta fictícia de teste', status: 'resolved' }), error => error.status === 403);
  await assert.rejects(support.replySupportTicket({ id: admin, role: 'admin' }, ticket.ticket.id, { body: 'Análise fictícia encerrada sem decisão específica.', status: 'resolved', idempotencyKey:'synthetic-beta-sale-support-reply' }),error=>error.code==='occurrence_decision_required');
  await support.supportOccurrenceDecision({id:admin,role:'admin'},ticket.ticket.id,{confirmed:true,outcome:'dismissed',reason:'Ocorrência fictícia improcedente após análise registrada.'});
  assert.equal((await service.settlementStatus({ id: user, role: 'customer' }, shipment.id)).requirementsMet, true);
  assert.equal((await service.settlementStatus({ id: user, role: 'customer' }, shipment.id)).payoutAllowed, false);
  const audit = await database.query('SELECT metadata FROM audit_events');
  assert.equal(JSON.stringify(audit.rows).includes('Rua fictícia da fixture'), false);
  console.log('BETA_SALE: endereço privado, aviso, repetição concorrente, aprovação, validação independente, suporte e consulta sem repasse executados em PostgreSQL. Prova/mídia e pagamento são fixtures, sem fornecedor.');
}
