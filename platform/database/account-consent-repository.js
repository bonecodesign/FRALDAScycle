import { createOperationalPreferenceRepository } from './operational-preference-repository.js';
export function createAccountConsentRepository(database) {
  return Object.freeze({
    ...createOperationalPreferenceRepository(database),
    async marketingPreferences(userId) {
      const result=await database.query('SELECT email,sms,push,updated_at FROM account_marketing_preferences WHERE user_id=$1',[userId]);
      return result.rows[0]??{email:false,sms:false,push:false,updated_at:null};
    },
    async saveMarketingPreferences(userId,input) {
      return database.transaction(async client=>{
        const result=await client.query(`INSERT INTO account_marketing_preferences(user_id,email,sms,push)
          VALUES($1,$2,$3,$4) ON CONFLICT(user_id) DO UPDATE SET email=EXCLUDED.email,sms=EXCLUDED.sms,
          push=EXCLUDED.push,updated_at=now() RETURNING email,sms,push,updated_at`,[userId,input.email,input.sms,input.push]);
        await client.query('INSERT INTO marketing_preference_events(user_id,email,sms,push) VALUES($1,$2,$3,$4)',[userId,input.email,input.sms,input.push]);
        await client.query(`INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata)
          VALUES($1,'account.marketing.changed','user',$1,'{}'::jsonb)`,[userId]);
        return result.rows[0];
      });
    },
    async acceptTerms(userId,terms) {
      return database.transaction(async client=>{
        const result=await client.query(`INSERT INTO terms_acceptances(user_id,version,content_hash,document_snapshot)
          VALUES($1,$2,$3,$4::jsonb) ON CONFLICT(user_id,version,content_hash) DO NOTHING RETURNING id,version,content_hash,accepted_at`,
          [userId,terms.version,terms.contentHash,JSON.stringify(terms.documents)]);
        if(!result.rows[0]) {
          const existing=await client.query(`SELECT id,version,content_hash,accepted_at FROM terms_acceptances
            WHERE user_id=$1 AND version=$2 AND content_hash=$3`,[userId,terms.version,terms.contentHash]);
          return {acceptance:existing.rows[0],reused:true};
        }
        await client.query(`INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata)
          VALUES($1,'account.terms.accepted','terms_acceptance',$2,$3::jsonb)`,
          [userId,result.rows[0].id,JSON.stringify({version:terms.version,contentHash:terms.contentHash})]);
        return {acceptance:result.rows[0],reused:false};
      });
    },
    async termsHistory(userId) {
      const result=await database.query('SELECT id,version,content_hash,accepted_at FROM terms_acceptances WHERE user_id=$1 ORDER BY accepted_at DESC LIMIT 100',[userId]);
      return result.rows;
    },
  });
}
