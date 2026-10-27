import { createOperationalPreferenceRepository } from './operational-preference-repository.js';
export function createAccountConsentRepository(database) {
  return Object.freeze({
    ...createOperationalPreferenceRepository(database),
    async marketingPreferences(userId) {
      const result=await database.query('SELECT email,sms,push,notice_version,updated_at FROM account_marketing_preferences WHERE user_id=$1',[userId]);
      const row=result.rows[0];return row?{enabled:row.email,email:row.email,sms:row.sms,push:row.push,noticeVersion:row.notice_version,updatedAt:row.updated_at}:{enabled:false,email:false,sms:false,push:false,noticeVersion:'FC-CONSENT-1',updatedAt:null};
    },
    async saveMarketingPreferences(userId,input) {
      return database.transaction(async client=>{
        const result=await client.query(`INSERT INTO account_marketing_preferences(user_id,email,sms,push,notice_version)
          VALUES($1,$2,$2,$2,$3) ON CONFLICT(user_id) DO UPDATE SET email=EXCLUDED.email,sms=EXCLUDED.sms,
          push=EXCLUDED.push,notice_version=EXCLUDED.notice_version,updated_at=now() RETURNING email,sms,push,notice_version,updated_at`,[userId,input.enabled,input.noticeVersion]);
        await client.query('INSERT INTO marketing_preference_events(user_id,email,sms,push,notice_version) VALUES($1,$2,$2,$2,$3)',[userId,input.enabled,input.noticeVersion]);
        await client.query(`INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata)
          VALUES($1::uuid,'account.marketing.changed','user',$1::text,$2::jsonb)`,[userId,JSON.stringify({enabled:input.enabled,noticeVersion:input.noticeVersion})]);
        const row=result.rows[0];return{enabled:row.email,email:row.email,sms:row.sms,push:row.push,noticeVersion:row.notice_version,updatedAt:row.updated_at};
      });
    },
    async cookiePreferences(userId){const result=await database.query('SELECT analytics,marketing,policy_version,updated_at FROM account_cookie_preferences WHERE user_id=$1',[userId]);const row=result.rows[0];return row?{necessary:true,analytics:row.analytics,marketing:row.marketing,policyVersion:row.policy_version,updatedAt:row.updated_at}:{necessary:true,analytics:false,marketing:false,policyVersion:'FC-CONSENT-1',updatedAt:null};},
    async saveCookiePreferences(userId,input){return database.transaction(async client=>{const result=await client.query(`INSERT INTO account_cookie_preferences(user_id,analytics,marketing,policy_version) VALUES($1,$2,$3,$4) ON CONFLICT(user_id) DO UPDATE SET analytics=EXCLUDED.analytics,marketing=EXCLUDED.marketing,policy_version=EXCLUDED.policy_version,updated_at=now() RETURNING analytics,marketing,policy_version,updated_at`,[userId,input.analytics,input.marketing,input.policyVersion]);await client.query('INSERT INTO account_cookie_preference_events(user_id,analytics,marketing,policy_version) VALUES($1,$2,$3,$4)',[userId,input.analytics,input.marketing,input.policyVersion]);await client.query(`INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata) VALUES($1::uuid,'account.cookies.changed','user',$1::text,$2::jsonb)`,[userId,JSON.stringify({analytics:input.analytics,marketing:input.marketing,policyVersion:input.policyVersion})]);const row=result.rows[0];return{necessary:true,analytics:row.analytics,marketing:row.marketing,policyVersion:row.policy_version,updatedAt:row.updated_at};});},
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
    async hasTermsAcceptance(userId,{version,contentHash}) {
      const result=await database.query(`SELECT EXISTS(SELECT 1 FROM terms_acceptances
        WHERE user_id=$1 AND version=$2 AND content_hash=$3) AS accepted`,[userId,version,contentHash]);
      return result.rows[0]?.accepted===true;
    },
  });
}
