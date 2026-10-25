const REGISTRATION_FIELDS = new Set(["fullName", "cpfFingerprint", "birthDate", "address", "truthDeclaration", "terms"]);

function fail(code, status, message) {
  return Object.assign(new Error(message), { code, status });
}

function assertInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)
      || Object.keys(input).some(key => !REGISTRATION_FIELDS.has(key))
      || Object.hasOwn(input, "cpf")) {
    throw fail("invalid_responsible_persistence", 422, "Os dados do cadastro não estão prontos para persistência.");
  }
  if (!Buffer.isBuffer(input.cpfFingerprint) || input.cpfFingerprint.length !== 32) {
    throw fail("invalid_cpf_fingerprint", 422, "A proteção do CPF não foi aplicada.");
  }
  if (input.truthDeclaration?.version !== "FC-RESPONSIBLE-1"
      || !/^[a-f0-9]{64}$/.test(String(input.terms?.contentHash ?? ""))
      || !Array.isArray(input.terms?.documents) || input.terms.documents.length === 0) {
    throw fail("invalid_responsible_evidence", 422, "As evidências do cadastro estão incompletas.");
  }
}

export function createResponsibleRegistrationRepository(database) {
  return Object.freeze({
    async complete(userId, input) {
      assertInput(input);
      return database.transaction(async client => {
        const account = (await client.query(
          "SELECT id,responsible_registration_completed_at FROM users WHERE id=$1 FOR UPDATE", [userId],
        )).rows[0];
        if (!account) throw fail("account_not_found", 404, "Conta não encontrada.");
        if (account.responsible_registration_completed_at) {
          throw fail("responsible_registration_already_completed", 409, "O cadastro do responsável já foi concluído.");
        }

        return persistResponsibleRegistration(client, userId, input);
      });
    },
  });
}

export async function persistResponsibleRegistration(client, userId, input) {
  assertInput(input);
  const registered = (await client.query(
    `UPDATE users SET legal_name=$2,cpf_fingerprint=$3,adult_birth_date=$4,
       responsible_truth_version=$5,responsible_truth_declared_at=now(),
       responsible_registration_completed_at=now(),updated_at=now()
     WHERE id=$1 AND responsible_registration_completed_at IS NULL
     RETURNING id,legal_name,responsible_truth_version,responsible_registration_completed_at`,
    [userId, input.fullName, input.cpfFingerprint, input.birthDate, input.truthDeclaration.version],
  )).rows[0];
  if (!registered) throw fail("responsible_registration_already_completed", 409, "O cadastro do responsável já foi concluído.");

  const address = (await client.query(
    `INSERT INTO addresses
       (user_id,label,postal_code,street,number,complement,district,city,state,
        is_primary,version,postal_verification_fingerprint,postal_verification_provider)
     VALUES($1,'Principal',$2,$3,$4,$5,$6,$7,$8,true,$9,$10,$11)
     RETURNING id,label,is_primary,version,created_at`,
    [userId, input.address.postalCode, input.address.street, input.address.number,
      input.address.complement, input.address.district, input.address.city, input.address.state,
      input.address.version, input.address.verificationFingerprint, input.address.verificationProvider],
  )).rows[0];

  const acceptance = (await client.query(
    `INSERT INTO terms_acceptances(user_id,version,content_hash,document_snapshot)
     VALUES($1,$2,$3,$4::jsonb)
     RETURNING id,version,content_hash,accepted_at`,
    [userId, input.terms.version, input.terms.contentHash, JSON.stringify(input.terms.documents)],
  )).rows[0];

  await client.query(
    `INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata)
     VALUES($1,'account.responsible.registration.completed','user',$1::text,$2::jsonb)`,
    [userId, JSON.stringify({ truthVersion: input.truthDeclaration.version,
      termsVersion: input.terms.version, termsContentHash: input.terms.contentHash,
      addressId: address.id, addressVersion: address.version })],
  );
  return Object.freeze({ account: registered, address, acceptance });
}
