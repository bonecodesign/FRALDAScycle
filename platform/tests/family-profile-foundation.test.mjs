import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { adultDeclaration, ADULT_DECLARATION_VERSION } from "../packages/contracts/account-age.js";
import { childAgeBand, childAgeDisplay, CHILD_PROFILE_CONSENT_VERSION, CHILD_PROFILE_EMOJIS } from "../packages/contracts/child-age-band.js";
import { loadConfig } from "../apps/api/config.js";
import { createAdultDeclarationService, requireAdultDeclaration } from "../apps/api/adult-declaration-service.js";
import { createAdultDeclarationRepository } from "../database/adult-declaration-repository.js";
import { createChildProfileService } from "../apps/api/child-profile-service.js";

test("adult declaration is explicit, versioned and accepts no injected identity", () => {
  assert.deepEqual(adultDeclaration({ confirmed: true, version: ADULT_DECLARATION_VERSION }), { confirmed: true, version: "FC-AGE-1" });
  for (const input of [null, {}, { confirmed: false, version: "FC-AGE-1" }, { confirmed: true, version: "old" }, { confirmed: true, version: "FC-AGE-1", userId: "other" }]) {
    assert.throws(() => adultDeclaration(input));
  }
});

test("child age derivation returns only a band and rejects future or adult dates", () => {
  const reference = new Date("2026-10-07T12:00:00Z");
  assert.equal(childAgeBand("2026-09-07", reference), "newborn_0_2");
  assert.equal(childAgeBand("2026-04-07", reference), "infant_6_11");
  assert.equal(childAgeBand("2025-04-07", reference), "toddler_12_23");
  assert.equal(childAgeBand("2023-01-01", reference), "child_36_plus");
  assert.equal(childAgeDisplay("2026-01-07", reference), "9 meses");
  assert.equal(childAgeDisplay("2023-08-07", reference), "3 anos e 2 meses");
  assert.deepEqual(CHILD_PROFILE_EMOJIS, ["🍼", "🧸", "⭐", "🌙", "🌈"]);
  assert.throws(() => childAgeBand("2027-01-01", reference));
  assert.throws(() => childAgeBand("2008-10-07", reference));
});

test("child profiles stay off by default and production requires a second explicit activation acknowledgment", () => {
  assert.equal(loadConfig({ NODE_ENV: "test" }).childProfilesEnabled, false);
  assert.equal(loadConfig({ NODE_ENV: "test", CHILD_PROFILES_ENABLED: "false" }).childProfilesEnabled, false);
  assert.equal(loadConfig({ NODE_ENV: "test", CHILD_PROFILES_ENABLED: "true" }).childProfilesEnabled, true);
  const production = { NODE_ENV: "production", DATABASE_URL: "postgres://fixture", SESSION_SECRET: "s".repeat(32), NOTIFICATION_WEBHOOK_URL: "https://notify.example.test", NOTIFICATION_WEBHOOK_SECRET: "synthetic-only" };
  assert.equal(loadConfig(production).childProfilesEnabled, false);
  assert.throws(() => loadConfig({ ...production, CHILD_PROFILES_ENABLED: "true" }), /CHILD_PROFILES_ACTIVATION_ACKNOWLEDGED=true/);
  assert.equal(loadConfig({ ...production, CHILD_PROFILES_ACTIVATION_ACKNOWLEDGED: "true" }).childProfilesEnabled, false);
  assert.equal(loadConfig({ ...production, CHILD_PROFILES_ENABLED: "true", CHILD_PROFILES_ACTIVATION_ACKNOWLEDGED: "true" }).childProfilesEnabled, true);
});

test("schema keeps adult and child consent separate and exact birth date private", async () => {
  const migration = await readFile(new URL("../database/migrations/033_age_and_child_profile_foundation.sql", import.meta.url), "utf8");
  assert.match(migration, /adult_declaration_version = 'FC-AGE-1'/);
  assert.match(migration, /CREATE TABLE child_profiles/);
  assert.match(migration, new RegExp(CHILD_PROFILE_CONSENT_VERSION));
  assert.match(migration, /personalization_enabled boolean NOT NULL DEFAULT false/);
  assert.match(migration, /birth_date.*Dado privado/);
  assert.doesNotMatch(migration, /partner|advertis/i);
  const minimization = await readFile(new URL("../database/migrations/053_child_profile_data_minimization.sql", import.meta.url), "utf8");
  assert.match(minimization, /UPDATE child_profiles SET label = NULL/);
  assert.match(minimization, /DROP COLUMN label/);
  const retention = await readFile(new URL("../database/migrations/061_child_profile_active_only_retention.sql", import.meta.url), "utf8");
  assert.match(retention, /birth_date DROP NOT NULL/);
  assert.match(retention, /deleted_at IS NOT NULL AND birth_date IS NULL/);
  assert.match(retention, /child_profiles_account_active_emoji_idx/);
});

test("existing account can declare adulthood only for itself with idempotent audit", async () => {
  const changes = [];
  const service = createAdultDeclarationService({
    async status() { return { adult_declaration_version: null, adult_declared_at: null }; },
    async declare(input) { changes.push(input); return { adult_declaration_version: input.version, adult_declared_at: new Date("2026-10-07T12:00:00Z"), reused: false }; },
  });
  assert.deepEqual(await service.status({ id: "account-1" }), { declared: false, version: null, declaredAt: null });
  const result = await service.declare({ id: "account-1" }, { confirmed: true, version: "FC-AGE-1" });
  assert.equal(result.declared, true);
  assert.deepEqual(changes[0], { actorUserId: "account-1", version: "FC-AGE-1" });
  await assert.rejects(service.declare({ id: "account-1" }, { confirmed: true, version: "FC-AGE-1", userId: "other" }));
});

test("sensitive operation requires declaration while account access remains separate", () => {
  assert.throws(() => requireAdultDeclaration({ id: "account-1", adultDeclared: false }), error => error.code === "adult_declaration_required" && error.status === 403);
  assert.equal(requireAdultDeclaration({ id: "account-1", adultDeclared: true }).id, "account-1");
});

test("adult declaration repository updates user and audit atomically", async () => {
  const statements = [];
  const client = { async query(text, values) {
    statements.push({ text, values });
    if (/SELECT adult_declaration_version/.test(text)) return { rows: [{ adult_declaration_version: null, adult_declared_at: null }] };
    if (/UPDATE users/.test(text)) return { rows: [{ adult_declaration_version: "FC-AGE-1", adult_declared_at: new Date() }] };
    return { rows: [] };
  } };
  const repository = createAdultDeclarationRepository({ async transaction(work) { return work(client); } });
  const state = await repository.declare({ actorUserId: "11111111-1111-4111-8111-111111111111", version: "FC-AGE-1" });
  assert.equal(state.reused, false);
  assert.equal(statements.length, 3);
  assert.match(statements[0].text, /FOR UPDATE/);
  assert.match(statements[2].text, /account\.adult\.declared/);
});

test("child profile service stays hidden while feature flag is disabled", async () => {
  const service = createChildProfileService({ async list() { throw new Error("must not read"); } });
  await assert.rejects(service.list({ id: "account-1", adultDeclared: true }), error => error.code === "child_profiles_disabled" && error.status === 404);
});

test("new operations require an active family profile only when the feature is enabled", async () => {
  const actor = { id: "account-1", role: "customer", adultDeclared: true };
  const disabled = createChildProfileService({ async hasActive() { throw new Error("must not read"); } });
  assert.equal(await disabled.requireForNewOperation(actor), actor);
  const enabled = createChildProfileService({ async hasActive() { return false; } }, { featureEnabled: true });
  await assert.rejects(enabled.requireForNewOperation(actor), error => error.code === "child_profile_required" && error.status === 403);
  const ready = createChildProfileService({ async hasActive() { return true; } }, { featureEnabled: true });
  assert.equal(await ready.requireForNewOperation(actor), actor);
});

test("owner can manage multiple private profiles with explicit consent and versioning", async () => {
  const rows = [];
  const reference = new Date("2026-10-07T12:00:00Z");
  const repository = {
    async list() { return rows; },
    async create(input) { const row = { id: crypto.randomUUID(), birth_date: input.birthDate, emoji: input.emoji, consent_version: input.consentVersion, personalization_enabled: true, version: 1, created_at: reference, updated_at: reference }; rows.push(row); return row; },
    async update(input) { const row = rows.find(item => item.id === input.profileId); if (!row) return null; if (row.version !== input.expectedVersion) return { conflict: true }; Object.assign(row, { birth_date: input.birthDate, emoji: input.emoji, version: row.version + 1, updated_at: reference }); return row; },
    async remove(input) { const row = rows.find(item => item.id === input.profileId); if (!row) return null; if (row.version !== input.expectedVersion) return { conflict: true }; if (rows.filter(item => item.personalization_enabled).length <= 1) return { lastProfile: true }; row.version += 1; row.personalization_enabled = false; return { id: row.id, version: row.version }; },
  };
  const service = createChildProfileService(repository, { featureEnabled: true, now: () => reference });
  const actor = { id: "account-1", role: "customer", adultDeclared: true };
  const first = await service.create(actor, { birthDate: "2026-04-07", emoji: "🍼", consentConfirmed: true, consentVersion: "FC-CHILD-PROFILE-1", personalizationEnabled: true });
  const second = await service.create(actor, { birthDate: "2025-04-07", emoji: "🧸", consentConfirmed: true, consentVersion: "FC-CHILD-PROFILE-1", personalizationEnabled: true });
  assert.equal((await service.list(actor)).length, 2);
  assert.deepEqual(await service.personalizationSignals(actor), [{ ageBand: "infant_6_11" }, { ageBand: "toddler_12_23" }]);
  for (const signal of await service.personalizationSignals(actor)) {
    assert.deepEqual(Object.keys(signal), ["ageBand"]);
  }
  const corrected = await service.update(actor, first.id, { birthDate: "2026-05-07", emoji: "⭐", expectedVersion: 1 });
  assert.equal(corrected.version, 2);
  await assert.rejects(service.update(actor, first.id, { birthDate: "2026-05-07", emoji: "⭐", expectedVersion: 1 }), error => error.code === "child_profile_version_conflict");
  assert.deepEqual(await service.remove(actor, second.id, { confirmed: true, expectedVersion: 1 }), { id: second.id, removed: true, personalizationEnabled: false, version: 2 });
  await assert.rejects(service.remove(actor, first.id, { confirmed: true, expectedVersion: 2 }), error => error.code === "last_child_profile_required");
});

test("child profile rejects missing consent, injected account and non-child date", async () => {
  const service = createChildProfileService({ async create() { throw new Error("must not write"); } }, { featureEnabled: true, now: () => new Date("2026-10-07T12:00:00Z") });
  const actor = { id: "account-1", role: "customer", adultDeclared: true };
  const base = { birthDate: "2026-04-07", emoji: "🍼", consentConfirmed: true, consentVersion: "FC-CHILD-PROFILE-1", personalizationEnabled: true };
  await assert.rejects(service.create(actor, { ...base, consentConfirmed: false }), error => error.code === "child_profile_consent_required");
  await assert.rejects(service.create(actor, { ...base, birthDate: undefined }), error => error.code === "invalid_child_birth_date");
  await assert.rejects(service.create(actor, { ...base, accountId: "other" }), error => error.code === "invalid_child_profile");
  await assert.rejects(service.create(actor, { ...base, label: "Dado não permitido" }), error => error.code === "invalid_child_profile");
  await assert.rejects(service.create(actor, { ...base, birthDate: "2000-01-01" }), error => error.code === "invalid_child_birth_date");
  await assert.rejects(service.create(actor, { ...base, birthDate: "2013-10-07" }), error => error.code === "invalid_child_birth_date");
  await assert.rejects(service.create(actor, { ...base, emoji: "👶" }), error => error.code === "invalid_child_profile_emoji");
  for (const role of ["courier", "moderator", "admin"]) {
    await assert.rejects(service.create({ ...actor, role }, base), error => error.code === "family_profile_not_available" && error.status === 403);
  }
});

test("child profile service reports account limit and repeated emoji", async () => {
  const actor = { id: "account-1", role: "customer", adultDeclared: true };
  const base = { birthDate: "2026-04-07", emoji: "🍼", consentConfirmed: true, consentVersion: "FC-CHILD-PROFILE-1", personalizationEnabled: true };
  const limited = createChildProfileService({ async create() { return { limit: true }; } }, { featureEnabled: true, now: () => new Date("2026-10-07T12:00:00Z") });
  await assert.rejects(limited.create(actor, base), error => error.code === "child_profile_limit_reached");
  const repeated = createChildProfileService({ async create() { return { emojiConflict: true }; } }, { featureEnabled: true, now: () => new Date("2026-10-07T12:00:00Z") });
  await assert.rejects(repeated.create(actor, base), error => error.code === "child_profile_emoji_in_use");
});

test("account interface requires adulthood and keeps child UI hidden on disabled feature", async () => {
  const [auth, settings, controller, handler] = await Promise.all([
    readFile(new URL('../apps/app/auth.js', import.meta.url), 'utf8'),
    readFile(new URL('../apps/app/settings.html', import.meta.url), 'utf8'),
    readFile(new URL('../apps/app/family-profile.js', import.meta.url), 'utf8'),
    readFile(new URL('../apps/api/child-profile-handler.js', import.meta.url), 'utf8'),
  ]);
  assert.match(auth, /Confirmo que tenho 18 anos ou mais/);
  assert.match(auth, /adultDeclarationVersion: "FC-AGE-1"/);
  assert.match(settings, /\/apps\/app\/family-profile\.js/);
  assert.match(controller, /if \(error\.status === 404\) return/);
  assert.match(controller, /Coletamos somente a data de nascimento/);
  assert.match(controller, /FC-CHILD-PROFILE-1/);
  assert.match(controller, /Excluir perfil/);
  assert.doesNotMatch(handler, /personalizationSignals/);
});
