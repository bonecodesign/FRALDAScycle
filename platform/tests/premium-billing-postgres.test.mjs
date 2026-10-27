import assert from 'node:assert/strict';
import test from 'node:test';
import {nativePostgresTools,withNativeTestPostgres} from '../tools/native-postgres.mjs';

const native=await nativePostgresTools();
const configuredDatabaseUrl=process.env.FC_PREMIUM_BILLING_TEST_DATABASE_URL;

test('PostgreSQL reconciles Premium renewal and failure exactly once without initiating billing',{
  skip:!native&&!configuredDatabaseUrl&&!process.env.CI?'PostgreSQL temporário ausente; nenhuma evidência persistente alegada.':false,
  timeout:process.env.CI?600000:240000,
},async()=>{
  const exercise=async databaseUrl=>{
    const [{createDatabase},{discoverMigrations,migrate},{createPremiumBillingRepository},{createPremiumBillingService}]=await Promise.all([
      import('../database/client.js'),import('../database/migrate.js'),import('../database/premium-billing-repository.js'),import('../apps/api/premium-billing-service.js'),
    ]);
    const database=createDatabase({databaseUrl,databaseSsl:false});
    try{
      await migrate(database,await discoverMigrations());
      const userId='71000000-0000-4000-8000-000000000001';
      await database.query("INSERT INTO users(id,email,password_hash,display_name) VALUES($1,'premium-renewal@example.test','synthetic-unusable','Conta Premium sintética')",[userId]);
      const now=Date.parse('2030-01-01T12:00:00Z');
      const service=createPremiumBillingService(createPremiumBillingRepository(database),{clock:()=>now});
      const paid={userId,provider:'asaas',providerReference:'premium-cycle-2030-01',eventType:'period_paid',amountCents:1290,
        paidPeriodStart:'2030-01-01T12:00:00Z',paidPeriodEnd:'2030-02-01T12:00:00Z',providerCheckedAt:'2030-01-01T11:59:00Z',evidenceSha256:'a'.repeat(64)};
      const first=await service.applyReconciled(paid),retry=await service.applyReconciled(paid);
      assert.equal(first.reused,false);assert.equal(first.billingInitiated,false);
      assert.equal(retry.reused,true);assert.equal(retry.billingInitiated,false);
      await assert.rejects(service.applyReconciled({...paid,evidenceSha256:'b'.repeat(64)}),error=>error.code==='premium_billing_key_conflict');
      const subscription=(await database.query('SELECT * FROM premium_subscriptions WHERE user_id=$1',[userId])).rows[0];
      assert.equal(new Date(subscription.paid_period_start).toISOString(),'2030-01-01T12:00:00.000Z');
      assert.equal(new Date(subscription.paid_period_end).toISOString(),'2030-02-01T12:00:00.000Z');
      assert.equal(subscription.renewal_enabled,true);assert.equal(subscription.renewal_failed_at,null);
      const failed={...paid,providerReference:'premium-cycle-2030-02',eventType:'renewal_failed',amountCents:null,paidPeriodStart:null,paidPeriodEnd:null,
        providerCheckedAt:'2030-02-01T12:00:00Z',evidenceSha256:'c'.repeat(64)};
      const failureService=createPremiumBillingService(createPremiumBillingRepository(database),{clock:()=>Date.parse(failed.providerCheckedAt)});
      assert.equal((await failureService.applyReconciled(failed)).billingInitiated,false);
      const after=(await database.query('SELECT renewal_failed_at FROM premium_subscriptions WHERE user_id=$1',[userId])).rows[0];
      assert.equal(new Date(after.renewal_failed_at).toISOString(),'2030-02-01T12:00:00.000Z');
      assert.equal((await database.query('SELECT count(*)::int AS count FROM premium_billing_events WHERE user_id=$1',[userId])).rows[0].count,2);
      assert.equal((await database.query("SELECT count(*)::int AS count FROM audit_events WHERE action='premium.billing.reconciled' AND entity_type='premium_billing_event'")).rows[0].count,2);
    }finally{await database.close();}
  };
  if(configuredDatabaseUrl){
    const url=new URL(configuredDatabaseUrl);
    assert.ok(['127.0.0.1','localhost'].includes(url.hostname));
    assert.equal(url.pathname,'/fc_premium_billing_test');
    await exercise(configuredDatabaseUrl);
  }else await withNativeTestPostgres(exercise);
});
