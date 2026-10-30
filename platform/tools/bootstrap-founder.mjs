import { createDatabase } from '../database/client.js';
import { isMainModule } from '../packages/contracts/main-module.js';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const FOUNDER_CONFIRMATION='PROMOTE-ONLY-FRALDACYCLE-FOUNDER';

export async function bootstrapFounder(database,{userId,confirmation}){
  if(!UUID.test(String(userId??'')))throw new Error('A valid founder user UUID is required');
  if(confirmation!==FOUNDER_CONFIRMATION)throw new Error(`Explicit confirmation ${FOUNDER_CONFIRMATION} is required`);
  return database.transaction(async client=>{
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended('fraldacycle:founder-bootstrap',0))");
    const target=(await client.query('SELECT id,role,staff_access_level,disabled_at FROM users WHERE id=$1 FOR UPDATE',[userId])).rows[0];
    if(!target||target.disabled_at)throw new Error('Founder account must exist and be active');
    if(!['admin','moderator'].includes(target.role))throw new Error('Founder account must already be an internal administrative account');
    const existing=(await client.query('SELECT id FROM users WHERE staff_access_level=5 AND disabled_at IS NULL FOR UPDATE')).rows[0];
    if(existing&&existing.id!==userId)throw new Error('An active founder already exists');
    if(existing?.id===userId)return {userId,reused:true,sessionsRevoked:0,accessLevel:5};
    const updated=(await client.query(`UPDATE users SET role='admin',staff_access_level=5,updated_at=now()
      WHERE id=$1 RETURNING id,staff_access_level`,[userId])).rows[0];
    const revoked=await client.query('UPDATE sessions SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL RETURNING id',[userId]);
    await client.query(`INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata)
      VALUES($1,'staff.founder.bootstrapped','user',$1,$2::jsonb)`,[userId,JSON.stringify({previousAccessLevel:target.staff_access_level,accessLevel:5,sessionsRevoked:revoked.rowCount})]);
    return {userId:updated.id,reused:false,sessionsRevoked:revoked.rowCount,accessLevel:Number(updated.staff_access_level)};
  });
}

function argument(name){const prefix=`--${name}=`;return process.argv.slice(2).find(value=>value.startsWith(prefix))?.slice(prefix.length)??null;}
if(isMainModule(import.meta.url)){
  const database=createDatabase();
  try{
    const result=await bootstrapFounder(database,{userId:argument('user-id'),confirmation:argument('confirm')});
    console.log(JSON.stringify({type:'staff.founder.bootstrap.completed',...result}));
  }finally{await database.close();}
}
