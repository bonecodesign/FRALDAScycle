import assert from "node:assert/strict";
import test from "node:test";
import { createAuthService } from "../apps/api/auth-service.js";
import { loadConfig } from "../apps/api/config.js";
import { createApiServer } from "../apps/api/server.js";
import { createDatabase } from "../database/client.js";
import { createAuthRepository } from "../database/auth-repository.js";
import { discoverMigrations, migrate } from "../database/migrate.js";
import { nativePostgresTools, withNativeTestPostgres } from "../tools/native-postgres.mjs";

const native = await nativePostgresTools();
const contentHash = "d".repeat(64);
const terms = { status: "active", version: "terms-integration-1", contentHash,
  documents: [{ name: "terms.md", content: "approved synthetic terms" }] };
const postalCodeService = { async lookup(postalCode) {
  assert.match(String(postalCode), /30110-?028/);
  return { address: { postalCode: "30110028", street: "Avenida Afonso Pena", district: "Centro", city: "Belo Horizonte", state: "MG" },
    evidence: { postalCode: "30110028", addressVersion: 1, provider: "viacep", placeId: "30110028",
      partialMatch: false, exactMatch: true, city: "Belo Horizonte", state: "MG" } };
} };

function registration(email = "responsible@example.test") {
  return {
    email, password: "uma frase senha segura", displayName: "Maria",
    responsible: {
      fullName: "Maria da Silva", cpf: "529.982.247-25", birthDate: "1990-05-12",
      address: { id: "signup-main", version: 1, postalCode: "30110-028", street: "Avenida Afonso Pena",
        number: "1000", complement: "Apto 10", noComplement: false, district: "Centro", city: "Belo Horizonte", state: "MG" },
      truthDeclaration: { confirmed: true, version: "FC-RESPONSIBLE-1" },
      terms: { accepted: true, version: terms.version, contentHash },
    },
  };
}

test("cadastro completo é atômico via HTTP e minimizado no PostgreSQL", {
  skip: !native && !process.env.CI ? "PostgreSQL nativo ausente neste ambiente." : false,
  timeout: 60_000,
}, async () => {
  await withNativeTestPostgres(async databaseUrl => {
    const database = createDatabase({ databaseUrl, databaseSsl: false });
    let api;
    try {
      await migrate(database, await discoverMigrations());
      const authService = createAuthService(createAuthRepository(database), { responsibleRegistration: {
        enabled: true, cpfHmacSecret: "responsible-postgres-hmac-secret-0001", terms, postalCodeService,
      } });
      api = createApiServer({ config: loadConfig({ NODE_ENV: "test", RATE_LIMIT_MAX: "1000" }), authService });
      await new Promise(resolve => api.listen(0, "127.0.0.1", resolve));
      const origin = `http://127.0.0.1:${api.address().port}`;

      const configResponse = await fetch(`${origin}/v1/auth/registration-config`);
      const configBody = await configResponse.json();
      assert.equal(configResponse.status, 200);
      assert.deepEqual(configBody.terms, { version: terms.version, contentHash });
      assert.equal("documents" in configBody.terms, false);

      const postalResponse = await fetch(`${origin}/v1/auth/registration-postal-code/30110-028`);
      assert.equal(postalResponse.status, 200);
      assert.equal((await postalResponse.json()).address.city, "Belo Horizonte");

      const response = await fetch(`${origin}/v1/auth/register`, { method: "POST",
        headers: { "content-type": "application/json" }, body: JSON.stringify(registration()) });
      const body = await response.json();
      assert.equal(response.status, 201, JSON.stringify(body));
      assert.match(body.challenge, /^[A-Za-z0-9_-]{43}$/);

      const account = (await database.query(`SELECT id,legal_name,encode(cpf_fingerprint,'hex') AS cpf_fingerprint,
        adult_birth_date,responsible_truth_version,responsible_registration_completed_at FROM users WHERE email=$1`,
      ["responsible@example.test"])).rows[0];
      assert.equal(account.legal_name, "Maria da Silva");
      assert.match(account.cpf_fingerprint, /^[a-f0-9]{64}$/);
      assert.notEqual(account.cpf_fingerprint, "52998224725");
      const adultBirthDate = account.adult_birth_date instanceof Date
        ? account.adult_birth_date.toISOString().slice(0, 10)
        : String(account.adult_birth_date);
      assert.equal(adultBirthDate, "1990-05-12");
      assert.equal(account.responsible_truth_version, "FC-RESPONSIBLE-1");
      assert.ok(account.responsible_registration_completed_at instanceof Date);

      const address = (await database.query(`SELECT postal_code,street,number,complement,district,city,state,
        is_primary,version,postal_verification_provider FROM addresses WHERE user_id=$1`, [account.id])).rows[0];
      assert.equal(address.is_primary, true);
      assert.equal(address.postal_verification_provider, "viacep");
      assert.equal(address.version, 1);

      const acceptance = (await database.query("SELECT version,content_hash,document_snapshot FROM terms_acceptances WHERE user_id=$1", [account.id])).rows[0];
      assert.equal(acceptance.version, terms.version);
      assert.equal(acceptance.content_hash, contentHash);
      assert.deepEqual(acceptance.document_snapshot, terms.documents);

      const audit = (await database.query("SELECT metadata::text AS metadata FROM audit_events WHERE actor_user_id=$1 AND action='account.responsible.registration.completed'", [account.id])).rows[0];
      assert.ok(audit);
      assert.doesNotMatch(audit.metadata, /52998224725|1990-05-12|Avenida Afonso Pena/);

      const duplicate = await fetch(`${origin}/v1/auth/register`, { method: "POST",
        headers: { "content-type": "application/json" }, body: JSON.stringify(registration("other@example.test")) });
      assert.equal(duplicate.status, 409);
      assert.equal((await duplicate.json()).error.code, "cpf_already_registered");
      const counts = await database.query(`SELECT
        (SELECT count(*)::int FROM users) AS users,
        (SELECT count(*)::int FROM addresses) AS addresses,
        (SELECT count(*)::int FROM terms_acceptances) AS acceptances`);
      assert.deepEqual(counts.rows[0], { users: 1, addresses: 1, acceptances: 1 });
    } finally {
      if (api?.listening) await new Promise(resolve => api.close(resolve));
      await database.close();
    }
  });
});
