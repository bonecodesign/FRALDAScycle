import assert from "node:assert/strict";
import test from "node:test";
import { createApiServer } from "../apps/api/server.js";
import { loadConfig } from "../apps/api/config.js";
import { createAdultDeclarationService } from "../apps/api/adult-declaration-service.js";
import { createDatabase } from "../database/client.js";
import { discoverMigrations, migrate } from "../database/migrate.js";
import { createAdultDeclarationRepository } from "../database/adult-declaration-repository.js";
import { nativePostgresTools, withNativeTestPostgres } from "../tools/native-postgres.mjs";

const native = await nativePostgresTools();
const userId = "11111111-1111-4111-8111-111111111111";

test("adult declaration is versioned, idempotent and gates sensitive HTTP operations in PostgreSQL", {
  skip: !native && !process.env.CI ? "PostgreSQL nativo ausente neste ambiente." : false,
  timeout: 60000,
}, async () => {
  await withNativeTestPostgres(async databaseUrl => {
    const database = createDatabase({ databaseUrl, databaseSsl: false });
    let api;
    try {
      await migrate(database, await discoverMigrations());
      await database.query(`INSERT INTO users(id,email,password_hash,display_name) VALUES($1,'adult-declaration@example.test','synthetic-unusable-hash','Pessoa adulta fictícia')`, [userId]);
      const authService = { async session(token) {
        if (token !== "adult-declaration-session") return null;
        const user = (await database.query("SELECT id,role,display_name,adult_declared_at,adult_declaration_version FROM users WHERE id=$1", [userId])).rows[0];
        return { id:user.id, role:user.role, displayName:user.display_name, adultDeclared:Boolean(user.adult_declared_at), adultDeclarationVersion:user.adult_declaration_version };
      } };
      const marketplaceService = { async create(sellerId) { return { id:"22222222-2222-4222-8222-222222222222", seller_id:sellerId, status:"review", reused:false }; } };
      api = createApiServer({ config:loadConfig({ NODE_ENV:"test", RATE_LIMIT_MAX:"1000" }), authService,
        adultDeclarationService:createAdultDeclarationService(createAdultDeclarationRepository(database)), marketplaceService });
      await new Promise(resolve => api.listen(0,"127.0.0.1",resolve));
      const origin=`http://127.0.0.1:${api.address().port}`;
      const headers={cookie:"fc_session=adult-declaration-session","content-type":"application/json"};
      const initial=await fetch(`${origin}/v1/account/adult-declaration`,{headers});
      assert.equal(initial.status,200);assert.deepEqual((await initial.json()).declaration,{declared:false,version:null,declaredAt:null});
      const blocked=await fetch(`${origin}/v1/listings`,{method:"POST",headers,body:"{}"});
      assert.equal(blocked.status,403);assert.equal((await blocked.json()).error.code,"adult_declaration_required");
      const invalid=await fetch(`${origin}/v1/account/adult-declaration`,{method:"PUT",headers,body:JSON.stringify({confirmed:true,version:"FC-AGE-OLD"})});
      assert.equal(invalid.status,422);assert.equal((await invalid.json()).error.code,"adult_declaration_required");
      const declare=()=>fetch(`${origin}/v1/account/adult-declaration`,{method:"PUT",headers,body:JSON.stringify({confirmed:true,version:"FC-AGE-1"})});
      const accepted=await declare(),acceptedPayload=await accepted.json();
      assert.equal(accepted.status,200,JSON.stringify(acceptedPayload));assert.equal(acceptedPayload.declaration.declared,true);assert.equal(acceptedPayload.declaration.version,"FC-AGE-1");assert.equal(acceptedPayload.declaration.reused,false);
      const repeated=await declare();assert.equal(repeated.status,200);assert.equal((await repeated.json()).declaration.reused,true);
      const released=await fetch(`${origin}/v1/listings`,{method:"POST",headers,body:"{}"});assert.equal(released.status,201);assert.equal((await released.json()).listing.seller_id,userId);
      const persisted=(await database.query("SELECT adult_declaration_version,adult_declared_at FROM users WHERE id=$1",[userId])).rows[0];
      assert.equal(persisted.adult_declaration_version,"FC-AGE-1");assert.ok(persisted.adult_declared_at instanceof Date);
      const audit=await database.query("SELECT metadata FROM audit_events WHERE actor_user_id=$1 AND action='account.adult.declared'",[userId]);
      assert.equal(audit.rows.length,1);assert.equal(audit.rows[0].metadata.version,"FC-AGE-1");
    } finally { if(api?.listening)await new Promise(resolve=>api.close(resolve));await database.close(); }
  });
});
