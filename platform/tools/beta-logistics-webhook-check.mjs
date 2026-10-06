import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createLogisticsRepository } from '../database/logistics-repository.js';

// These fixtures exercise PostgreSQL transitions, not external providers or real deliveries.
export async function validateSyntheticLogisticsWebhooks(database, { user, other }) {
  const repository = createLogisticsRepository(database);
  const donation = (await database.query("SELECT institution_id FROM listings WHERE kind='donation' AND institution_id IS NOT NULL LIMIT 1")).rows[0];
  assert.ok(donation, 'Run the donation fixture before webhook regression scenarios.');
  const baseline = (await database.query('SELECT count(*)::int AS n FROM payment_intents')).rows[0].n;
  let scenarios = 0;
  async function verify({ kind, transactionStatus, shipmentStatus, eventType, expectedTransaction, expectedShipment, ignored = false }) {
    const reference = 'synthetic-webhook-' + randomUUID();
    const listing = (await database.query(
      `INSERT INTO listings(seller_id,title,description,brand,category,model,package_condition,quantity,kind,price_cents,status,institution_id)
       VALUES($1,'Pacote fictício webhook','Descrição fictícia exclusiva para regressão','Pampers','infant','Confort Sec','sealed',10,$2::transaction_kind,$3,'unavailable',$4) RETURNING id`,
      [user, kind, kind === 'sale' ? 10000 : null, kind === 'donation' ? donation.institution_id : null],
    )).rows[0];
    const transaction = (await database.query(
      `INSERT INTO transactions(listing_id,buyer_id,seller_id,status,amount_cents)
       VALUES($1,$2,$3,$4::transaction_status,$5) RETURNING id,updated_at::text`,
      [listing.id, other, user, transactionStatus, kind === 'donation' ? 0 : 10000],
    )).rows[0];
    const shipment = (await database.query(
      `INSERT INTO shipments(transaction_id,buyer_id,seller_id,mode,idempotency_key,provider_reference,status)
       VALUES($1,$2,$3,'pickup',$4,$4,$5::shipment_status) RETURNING id`,
      [transaction.id, other, user, reference, shipmentStatus],
    )).rows[0];
    const event = { id: reference + '-event', type: eventType, providerReference: reference,
      occurredAt: new Date(), payloadHash: Buffer.from('synthetic-webhook-hash'),
      description: 'Evento logístico fictício', latitude: null, longitude: null };
    const deliveries = await Promise.all([repository.processWebhook(event), repository.processWebhook(event)]);
    assert.equal(deliveries.filter(result => result.duplicate === true).length, 1, reference);
    assert.equal(deliveries.filter(result => result.ignored === true).length, ignored ? 1 : 0, reference);
    assert.deepEqual(await repository.processWebhook(event), { duplicate: true });
    const current = (await database.query(
      `SELECT t.status AS transaction_status,t.updated_at::text,l.status AS listing_status,s.status AS shipment_status
       FROM transactions t JOIN listings l ON l.id=t.listing_id JOIN shipments s ON s.transaction_id=t.id WHERE t.id=$1`,
      [transaction.id],
    )).rows[0];
    assert.equal(current.transaction_status, expectedTransaction, kind + ' ' + transactionStatus + ' ' + eventType);
    assert.equal(current.shipment_status, expectedShipment);
    assert.equal(current.listing_status, 'unavailable', 'A webhook must not republish the listing.');
    if (ignored || !['paid', 'donation_confirmed', 'in_delivery'].includes(transactionStatus)
        || (kind === 'donation' && ['shipment.failed', 'shipment.cancelled'].includes(eventType))) {
      assert.equal(current.updated_at, transaction.updated_at, 'Protected transaction is unchanged.');
    }
    assert.equal((await database.query('SELECT count(*)::int AS n FROM shipment_events WHERE shipment_id=$1', [shipment.id])).rows[0].n, ignored ? 0 : 1);
    assert.equal((await database.query("SELECT count(*)::int AS n FROM audit_events WHERE action='shipment.webhook.processed' AND entity_id=$1", [shipment.id])).rows[0].n, ignored ? 0 : 1);
    assert.equal((await database.query('SELECT count(*)::int AS n FROM logistics_webhook_events WHERE id=$1', [event.id])).rows[0].n, 1);
    assert.equal((await database.query('SELECT count(*)::int AS n FROM delivery_proofs WHERE shipment_id=$1', [shipment.id])).rows[0].n, 0);
    scenarios++;
  }
  for (const kind of ['sale', 'donation']) {
    const confirmed = kind === 'sale' ? 'paid' : 'donation_confirmed';
    for (const transactionStatus of [confirmed, 'in_delivery']) {
      for (const shipmentStatus of ['awaiting_pickup', 'assigned', 'picked_up', 'in_transit']) {
        for (const eventType of ['shipment.failed', 'shipment.cancelled']) {
          const ignored = eventType === 'shipment.cancelled' && ['picked_up', 'in_transit'].includes(shipmentStatus);
          await verify({ kind, transactionStatus, shipmentStatus, eventType, ignored,
            expectedTransaction: ignored || kind === 'donation' ? transactionStatus : 'paid',
            expectedShipment: ignored ? shipmentStatus : eventType.split('.')[1] });
        }
      }
    }
    for (const transactionStatus of ['disputed', 'refunded', 'completed', 'cancelled']) {
      for (const eventType of ['shipment.failed', 'shipment.cancelled', 'shipment.in_transit']) {
        await verify({ kind, transactionStatus, shipmentStatus: 'assigned', eventType,
          expectedTransaction: transactionStatus, expectedShipment: eventType.split('.')[1] });
      }
    }
    for (const [shipmentStatus, eventType] of [
      ['awaiting_pickup', 'shipment.picked_up'], ['assigned', 'shipment.in_transit'], ['in_transit', 'shipment.delivered'],
    ]) {
      await verify({ kind, transactionStatus: confirmed, shipmentStatus, eventType,
        expectedTransaction: 'in_delivery', expectedShipment: eventType.split('.')[1] });
    }
    for (const shipmentStatus of ['delivered', 'failed', 'cancelled']) {
      await verify({ kind, transactionStatus: 'in_delivery', shipmentStatus, eventType: 'shipment.failed', ignored: true,
        expectedTransaction: 'in_delivery', expectedShipment: shipmentStatus });
    }
  }
  // The existing exchange fallback must also remain unchanged; this is not an exchange product flow.
  await verify({ kind: 'exchange', transactionStatus: 'in_delivery', shipmentStatus: 'assigned',
    eventType: 'shipment.failed', expectedTransaction: 'paid', expectedShipment: 'failed' });
  assert.equal((await database.query('SELECT count(*)::int AS n FROM payment_intents')).rows[0].n, baseline);
  console.log('BETA_LOGISTICS_WEBHOOKS: ' + scenarios + ' cenários PostgreSQL, falha/cancelamento de doação sem paid, venda preservada, eventos repetidos/concorrentes, eventos fora de ordem e estados finais/disputa preservados; zero nova intenção financeira, mídia ou fornecedor.');
}
