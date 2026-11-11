import assert from "node:assert/strict";
import test from "node:test";
import { createDatabase } from "../database/client.js";
import { discoverMigrations, migrate } from "../database/migrate.js";
import { createExchangeRepository } from "../database/exchange-repository.js";
import { createLogisticsRepository } from "../database/logistics-repository.js";
import { nativePostgresTools, withNativeTestPostgres } from "../tools/native-postgres.mjs";

const native=await nativePostgresTools();
const ids={
  requester:"11111111-1111-4111-8111-111111111111",
  owner:"22222222-2222-4222-8222-222222222222",
  courier1:"33333333-3333-4333-8333-333333333333",
  courier2:"44444444-4444-4444-8444-444444444444",
  admin:"55555555-5555-4555-8555-555555555555",
  requested:"66666666-6666-4666-8666-666666666666",
  offered:"77777777-7777-4777-8777-777777777777",
};

test("exchange courier offers preserve one courier across both guarded legs with PostgreSQL", {
  skip:!native&&!process.env.CI?"PostgreSQL local indisponível.":false,
  timeout:90_000,
},async()=>{
  await withNativeTestPostgres(async databaseUrl=>{
    const db=createDatabase({databaseUrl,databaseSsl:false});
    try{
      await migrate(db,await discoverMigrations());
      await db.query(`INSERT INTO users(id,email,password_hash,display_name,role)
        VALUES ($1,'offer-requester@example.test','fixture','Solicitante','customer'),
               ($2,'offer-owner@example.test','fixture','Proprietário','customer'),
               ($3,'offer-courier1@example.test','fixture','Entregador A','courier'),
               ($4,'offer-courier2@example.test','fixture','Entregador B','courier'),
               ($5,'offer-admin@example.test','fixture','Admin','admin')`,
        [ids.requester,ids.owner,ids.courier1,ids.courier2,ids.admin]);
      await db.query(`INSERT INTO listings
        (id,seller_id,title,description,category,brand,model,package_condition,quantity,kind,status,city,state,published_at)
        VALUES
        ($1,$3,'Pacote para troca A','Item lacrado fictício para cenário de atribuição.','infant','Marca','Modelo','sealed',1,'exchange','published','Belo Horizonte','MG',now()),
        ($2,$4,'Pacote para troca B','Item lacrado fictício para cenário de atribuição.','infant','Marca','Modelo','sealed',1,'exchange','published','Belo Horizonte','MG',now())`,
        [ids.requested,ids.offered,ids.owner,ids.requester]);
      const exchange=createExchangeRepository(db);
      const proposed=await exchange.propose({actorId:ids.requester,
        requestedListingId:ids.requested,offeredListingId:ids.offered,
        requesterDeclaredValueCents:8000});
      const transactionId=proposed.transaction_id;
      await exchange.accept({actorId:ids.owner,transactionId,
        expectedVersion:1,ownerDeclaredValueCents:10000});
      const shipments=(await db.query(`SELECT id,exchange_leg,status,logistics_payer_id
        FROM shipments WHERE transaction_id=$1 ORDER BY exchange_leg`,[transactionId])).rows;
      assert.equal(shipments.length,2);
      assert.deepEqual(shipments.map(x=>x.status),["provider_pending","provider_pending"]);
      assert.deepEqual(shipments.map(x=>x.logistics_payer_id),[ids.owner,ids.requester]);

      for(const [index,courierId] of [ids.courier1,ids.courier2].entries()){
        const ref=`synthetic-clearance-${index+1}`;
        await db.query(`INSERT INTO courier_profiles
          (user_id,account_status,identity_status,adult_confirmed_at,email_verified_at,
           phone_verified_at,payout_status,payout_provider_reference,terms_version,
           terms_accepted_at,admin_approval_status,admin_reviewer_id,admin_reviewed_at)
          VALUES($1,'active','verified',now(),now(),now(),'verified',$2,
            'FC-COURIER-1',now(),'approved',$3,now())`,
          [courierId,`synthetic-payout-${index}`,ids.admin]);
        await db.query(`INSERT INTO courier_vehicles
          (courier_id,vehicle_type,status,reviewed_by,reviewed_at)
          VALUES($1,'bicycle','approved',$2,now())`,[courierId,ids.admin]);
        await db.query(`INSERT INTO courier_clearance_documents
          (courier_id,status,issuer,validity_source,issuer_verification_reference,
           issued_at,expires_at,delete_at,encrypted_object_reference,
           encryption_key_reference,access_scope,retention_policy_version,
           retention_legal_approver_id)
          VALUES($1,'verified','police_civil','issuer_document',$2,
            now()-interval '1 day',now()+interval '30 days',
            now()+interval '60 days',$3,$4,
            'courier_clearance_reviewers','FC-PRIVACY-1',$5)`,
          [courierId,ref,`synthetic/encrypted/${index}`,
            `synthetic/key/${index}`,ids.admin]);
      }
      const offers=[];
      for(const shipment of shipments){
        const row=(await db.query(`INSERT INTO courier_delivery_offers
          (shipment_id,courier_id,priority,distance_to_recipient_km,offered_at,expires_at)
          VALUES($1,$2,1,1.2,now(),now()+interval '3 minutes') RETURNING id`,
          [shipment.id,ids.courier1])).rows[0];
        offers.push(row.id);
      }

      const logistics=createLogisticsRepository(db);
      const tryAccept=(index)=>logistics.acceptCourierOffer({
        shipmentId:shipments[index].id,
        courierId:ids.courier1,
        offerId:offers[index],
      });

      // An existing offer must not unlock an exchange before the difference is paid.
      assert.equal(await tryAccept(0),null);
      assert.equal(await tryAccept(1),null);
      await db.query("UPDATE shipments SET status='awaiting_pickup' WHERE id=$1",[shipments[0].id]);
      assert.equal(await logistics.assignCourier({
        shipmentId:shipments[0].id,courierId:ids.courier1,
      }),null);
      assert.equal(await tryAccept(0),null);
      await db.query("UPDATE shipments SET status='provider_pending' WHERE id=$1",[shipments[0].id]);

      await exchange.reserveDifferenceCheckout({actorId:ids.requester,transactionId,method:"pix"});
      await exchange.recordDifferenceProviderPending({transactionId,
        providerReference:"synthetic-exchange-offer-difference"});
      await exchange.recordDifferencePaid({transactionId,
        providerReference:"synthetic-exchange-offer-difference",amountCents:2000});
      assert.deepEqual((await db.query(
        "SELECT status FROM shipments WHERE transaction_id=$1 ORDER BY exchange_leg",
        [transactionId])).rows.map(x=>x.status),["awaiting_pickup","awaiting_pickup"]);

      const concurrent=await Promise.allSettled([
        db.query("UPDATE shipments SET courier_id=$2 WHERE id=$1",[shipments[0].id,ids.courier1]),
        db.query("UPDATE shipments SET courier_id=$2 WHERE id=$1",[shipments[1].id,ids.courier2]),
      ]);
      assert.equal(concurrent.filter(result=>result.status==="fulfilled").length,1);
      assert.equal(concurrent.filter(result=>result.status==="rejected"&&result.reason.code==="23514"&&result.reason.constraint==="exchange_single_courier_cycle").length,1);
      await db.query("UPDATE shipments SET courier_id=NULL WHERE transaction_id=$1",[transactionId]);
      await db.query("DELETE FROM exchange_courier_cycles WHERE transaction_id=$1",[transactionId]);

      await db.query("UPDATE transactions SET status='disputed' WHERE id=$1",[transactionId]);
      assert.equal(await tryAccept(0),null);
      await db.query("UPDATE transactions SET status='in_delivery' WHERE id=$1",[transactionId]);
      await db.query("UPDATE exchange_operations SET status='cancelled' WHERE transaction_id=$1",[transactionId]);
      assert.equal(await tryAccept(0),null);
      await db.query("UPDATE exchange_operations SET status='accepted' WHERE transaction_id=$1",[transactionId]);
      await db.query("UPDATE courier_profiles SET account_status='suspended' WHERE user_id=$1",[ids.courier1]);
      assert.equal(await tryAccept(0),null);
      await db.query("UPDATE courier_profiles SET account_status='active' WHERE user_id=$1",[ids.courier1]);
      const first=await tryAccept(0);
      await db.query("UPDATE courier_delivery_offers SET status='expired',responded_at=now() WHERE id=$1",[offers[1]]);
      const conflicting=(await db.query(`INSERT INTO courier_delivery_offers
        (shipment_id,courier_id,priority,distance_to_recipient_km,offered_at,expires_at)
        VALUES($1,$2,1,1.0,now(),now()+interval '3 minutes') RETURNING id`,
        [shipments[1].id,ids.courier2])).rows[0];
      assert.equal(await logistics.acceptCourierOffer({shipmentId:shipments[1].id,
        courierId:ids.courier2,offerId:conflicting.id}),null);
      await db.query("UPDATE courier_delivery_offers SET status='expired',responded_at=now() WHERE id=$1",[conflicting.id]);
      offers[1]=(await db.query(`INSERT INTO courier_delivery_offers
        (shipment_id,courier_id,priority,distance_to_recipient_km,offered_at,expires_at)
        VALUES($1,$2,1,1.2,now(),now()+interval '3 minutes') RETURNING id`,
        [shipments[1].id,ids.courier1])).rows[0].id;
      const second=await tryAccept(1);
      assert.equal(first.courier_id,ids.courier1);
      assert.equal(second.courier_id,ids.courier1);
      assert.equal(await tryAccept(0),null);
      assert.deepEqual((await db.query(
        "SELECT exchange_leg,courier_id,status FROM shipments WHERE transaction_id=$1 ORDER BY exchange_leg",
        [transactionId])).rows,[
        {exchange_leg:1,courier_id:ids.courier1,status:"assigned"},
        {exchange_leg:2,courier_id:ids.courier1,status:"assigned"},
      ]);
      await assert.rejects(db.query("UPDATE shipments SET courier_id=$2 WHERE id=$1",
        [shipments[1].id,ids.courier2]),error=>error.code==="23514"&&error.constraint==="exchange_single_courier_cycle");
      assert.equal((await db.query(`SELECT count(*)::int AS n FROM audit_events
        WHERE action='shipment.courier.offer_accepted'`)).rows[0].n,2);
      assert.equal((await db.query(`SELECT count(*)::int AS n FROM payment_intents
        WHERE transaction_id=$1`,[transactionId])).rows[0].n,0);
    }finally{await db.close();}
  });
});
