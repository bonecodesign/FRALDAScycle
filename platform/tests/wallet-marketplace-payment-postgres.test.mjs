import assert from 'node:assert/strict';
import test from 'node:test';
import {createPaymentService} from '../apps/api/payment-service.js';
import {createDatabase} from '../database/client.js';
import {createCourierWalletRepository} from '../database/courier-wallet-repository.js';
import {createPaymentRepository} from '../database/payment-repository.js';
import {discoverMigrations,migrate} from '../database/migrate.js';
import {nativePostgresTools,withNativeTestPostgres} from '../tools/native-postgres.mjs';

const native=await nativePostgresTools();
const ids={seller:'11111111-1111-4111-8111-111111111111',courier:'22222222-2222-4222-8222-222222222222',payout:'33333333-3333-4333-8333-333333333333'};

test('courier wallet funds full and mixed Marketplace payments without releasing contact early',{skip:!native&&!process.env.CI?'PostgreSQL local indisponível.':false,timeout:90_000},async()=>{
 await withNativeTestPostgres(async databaseUrl=>{const db=createDatabase({databaseUrl,databaseSsl:false});try{
  await migrate(db,await discoverMigrations());
  const admin='66666666-6666-4666-8666-666666666666';
  await db.query(`INSERT INTO users(id,email,password_hash,display_name,role) VALUES($1,'wallet-seller@example.test','fixture','Vendedor','customer'),($2,'wallet-buyer@example.test','fixture','Entregador comprador','courier'),($3,'wallet-admin@example.test','fixture','Financeiro','admin')`,[ids.seller,ids.courier,admin]);
  const listings=['44444444-4444-4444-8444-444444444441','44444444-4444-4444-8444-444444444442','44444444-4444-4444-8444-444444444443'];
  const transactions=['55555555-5555-4555-8555-555555555551','55555555-5555-4555-8555-555555555552','55555555-5555-4555-8555-555555555553'];
  for(let index=0;index<3;index++){const amount=[10000,4000,3000][index];await db.query(`INSERT INTO listings(id,seller_id,title,description,category,brand,model,package_condition,quantity,kind,price_cents,status) VALUES($1,$2,$3,'Descrição sintética exclusiva para carteira.','infant','Marca','Modelo','sealed',1,'sale',$4,'unavailable')`,[listings[index],ids.seller,`Anúncio carteira ${index+1}`,amount]);await db.query(`INSERT INTO transactions(id,listing_id,buyer_id,seller_id,status,amount_cents) VALUES($1,$2,$3,$4,'initiated',$5)`,[transactions[index],listings[index],ids.courier,ids.seller,amount]);}
  const wallet=createCourierWalletRepository(db),hash='a'.repeat(64);
  await wallet.creditConfirmedPayout({courierId:ids.courier,payoutId:ids.payout,amountCents:15000,providerReferenceHash:hash,evidenceSha256:'b'.repeat(64),idempotencyKey:'wallet-marketplace-credit-0001'});
  const repository=createPaymentRepository(db);let externalCalls=[];
  const service=createPaymentService(repository,{async createIntent(input){externalCalls.push(input);if(input.idempotencyKey==='wallet-marketplace-failure-0001')throw Object.assign(new Error('offline'),{code:'provider_offline'});return{providerReference:`provider-${externalCalls.length}`,status:'pending',checkout:{}};}});

  const full=await service.createIntent(ids.courier,{transactionId:transactions[0],idempotencyKey:'wallet-marketplace-full-0001',method:'wallet',walletAmountCents:10000});
  assert.equal(full.intent.status,'paid');assert.equal(full.intent.providerChargeCents,0);assert.equal(externalCalls.length,0);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM transaction_contact_access WHERE transaction_id=$1',[transactions[0]])).rows[0].n,1);

  const mixed=await service.createIntent(ids.courier,{transactionId:transactions[1],idempotencyKey:'wallet-marketplace-mixed-0001',method:'pix',walletAmountCents:2000});
  assert.equal(mixed.intent.walletAmountCents,2000);assert.equal(mixed.intent.providerChargeCents,2000);assert.deepEqual({amount:externalCalls[0].amountCents,platform:externalCalls[0].platformFeeCents,seller:externalCalls[0].sellerAmountCents},{amount:2000,platform:160,seller:1840});
  assert.equal((await db.query('SELECT count(*)::int AS n FROM transaction_contact_access WHERE transaction_id=$1',[transactions[1]])).rows[0].n,0);
  const settled=await repository.processWebhook({id:'wallet-marketplace-paid-event-0001',type:'payment.paid',providerReference:'provider-1',amountCents:2000,occurredAt:new Date(),payloadHash:Buffer.from('wallet-marketplace-paid')});
  assert.equal(settled.status,'paid');assert.equal((await db.query('SELECT status FROM courier_wallet_purchase_allocations WHERE transaction_id=$1',[transactions[1]])).rows[0].status,'paid');

  await assert.rejects(service.createIntent(ids.courier,{transactionId:transactions[2],idempotencyKey:'wallet-marketplace-failure-0001',method:'pix',walletAmountCents:1000}),error=>error.code==='provider_offline');
  const failed=(await db.query('SELECT status FROM courier_wallet_purchase_allocations WHERE transaction_id=$1',[transactions[2]])).rows[0];assert.equal(failed.status,'released');
  const balance=await wallet.summary(ids.courier);assert.deepEqual({available:balance.available_cents,reserved:balance.reserved_cents},{available:3000,reserved:0});

  const tickets=['77777777-7777-4777-8777-777777777771','77777777-7777-4777-8777-777777777772'];
  const cancellations=['88888888-8888-4888-8888-888888888881','88888888-8888-4888-8888-888888888882'];
  const paymentRows=(await db.query('SELECT id,transaction_id FROM payment_intents WHERE transaction_id=ANY($1::uuid[]) ORDER BY transaction_id',[transactions.slice(0,2)])).rows;
  for(let index=0;index<2;index++){
   await db.query(`INSERT INTO support_tickets(id,requester_id,transaction_id,category,subject,details,idempotency_key) VALUES($1,$2,$3,'cancellation','Cancelamento assistido','Cancelamento sintético para validar a origem exata do reembolso.',$4)`,[tickets[index],ids.courier,transactions[index],`wallet-refund-ticket-${index}`]);
   await db.query(`INSERT INTO supported_cancellations(id,transaction_id,support_ticket_id,payment_intent_id,decided_by,gross_amount_cents,retained_platform_fee_cents,retained_delivery_fee_cents,refund_amount_cents,reason) VALUES($1,$2,$3,$4,$5,$6,0,0,$6,'Reembolso integral aprovado para teste automatizado.')`,[cancellations[index],transactions[index],tickets[index],paymentRows.find(row=>row.transaction_id===transactions[index]).id,admin,[10000,4000][index]]);
  }
  const refundCalls=[];
  const refundRepository=createPaymentRepository(db,{stepUpRepository:{async consume(){return{id:'step-up'};}}});
  const refundService=createPaymentService(refundRepository,{async createCase(input){refundCalls.push(input);return{providerReference:'provider-refund-mixed',status:'submitted'};}});
  const fullRefund=await refundService.executeSupportedRefund({id:admin,role:'admin',staffAccessLevel:3},cancellations[0],{confirmed:true,idempotencyKey:'99999999-9999-4999-8999-999999999991',grantId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'});
  assert.equal(fullRefund.refund.completion_source,'local_wallet');assert.equal(refundCalls.length,0);
  assert.equal((await wallet.summary(ids.courier)).available_cents,13000);
  await refundService.executeSupportedRefund({id:admin,role:'admin',staffAccessLevel:3},cancellations[1],{confirmed:true,idempotencyKey:'99999999-9999-4999-8999-999999999992',grantId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2'});
  assert.equal(refundCalls[0].amountCents,2000);assert.equal((await wallet.summary(ids.courier)).available_cents,13000);
  const mixedRefunded=await refundRepository.processWebhook({id:'wallet-marketplace-refund-event-0001',type:'payment.refunded',providerReference:'provider-1',amountCents:2000,occurredAt:new Date(),payloadHash:Buffer.from('wallet-marketplace-refunded')});
  assert.equal(mixedRefunded.supportedRefundCompleted,true);assert.equal((await wallet.summary(ids.courier)).available_cents,15000);
  const allocations=(await db.query('SELECT transaction_id,wallet_refunded_cents,external_refunded_cents,status FROM courier_wallet_purchase_allocations WHERE transaction_id=ANY($1::uuid[]) ORDER BY transaction_id',[transactions.slice(0,2)])).rows;
  assert.deepEqual(allocations.map(row=>[row.wallet_refunded_cents,row.external_refunded_cents,row.status]),[[10000,0,'refunded'],[2000,2000,'refunded']]);
 }finally{await db.close();}});
});
