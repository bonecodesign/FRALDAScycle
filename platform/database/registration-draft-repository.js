export function createRegistrationDraftRepository(database){return Object.freeze({
 async create({tokenHash,encryptedPayload,iv,tag,expiresAt}){await database.query(`DELETE FROM responsible_registration_drafts WHERE expires_at<=now()`);return(await database.query(`INSERT INTO responsible_registration_drafts(token_hash,encrypted_payload,encryption_iv,authentication_tag,expires_at) VALUES($1,$2,$3,$4,$5) RETURNING id,expires_at`,[tokenHash,encryptedPayload,iv,tag,expiresAt])).rows[0];},
 async find(tokenHash){await database.query(`DELETE FROM responsible_registration_drafts WHERE expires_at<=now()`);return(await database.query(`SELECT id,encrypted_payload,encryption_iv,authentication_tag,expires_at FROM responsible_registration_drafts WHERE token_hash=$1 AND expires_at>now()`,[tokenHash])).rows[0]??null;},
 async update({id,encryptedPayload,iv,tag}){return(await database.query(`UPDATE responsible_registration_drafts SET encrypted_payload=$2,encryption_iv=$3,authentication_tag=$4,updated_at=now() WHERE id=$1 AND expires_at>now() RETURNING id,expires_at`,[id,encryptedPayload,iv,tag])).rows[0]??null;},
 async remove(tokenHash){const result=await database.query(`DELETE FROM responsible_registration_drafts WHERE token_hash=$1`,[tokenHash]);return result.rowCount>0;},
 async purgeExpired(){const result=await database.query(`DELETE FROM responsible_registration_drafts WHERE expires_at<=now()`);return{deleted:result.rowCount};},
});}

