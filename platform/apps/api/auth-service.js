import { createHash, createHmac } from "node:crypto";
import { createSessionToken, createVerificationCode, hashPassword, verifyPassword } from "./security.js";
import { ADULT_DECLARATION_VERSION, adultDeclaration } from "../../packages/contracts/account-age.js";
import { validateResponsibleRegistration } from "../../packages/contracts/responsible-registration.js";
import { pilotBhInvited } from "./pilot-bh.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TOKEN_TTL_MS = 30 * 60 * 1000;
const ADMIN_MFA_TTL_MS = 5 * 60 * 1000;
const ELEVATED_ROLES = new Set(["moderator", "admin"]);

export class AuthError extends Error {
  constructor(code, status = 400, message = "Não foi possível concluir a autenticação.") {
    super(message);
    this.name = "AuthError";
    this.code = code;
    this.status = status;
  }
}

export function normalizeEmail(value) {
  const normalized = String(value ?? "").trim().toLocaleLowerCase("pt-BR");
  return normalized || null;
}

export function normalizePhone(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 15 ? digits : null;
}

function contactFromInput(input) {
  const email = normalizeEmail(input?.email);
  const phone = normalizePhone(input?.phone);
  if (email && !EMAIL_PATTERN.test(email)) throw new AuthError("invalid_email", 422, "Informe um e-mail válido.");
  if (!email && !phone) throw new AuthError("invalid_contact", 422, "Informe um e-mail ou telefone válido.");
  return { email, phone };
}

function passwordFromInput(value) {
  const password = String(value ?? "");
  if (password.length < 12 || password.length > 1_024 || password.trim().length < 12) {
    throw new AuthError("weak_password", 422, "A senha deve ter entre 12 e 1024 caracteres e não pode conter apenas espaços.");
  }
  return password;
}

export function hashSessionToken(token) {
  return createHash("sha256").update(token).digest();
}

function hashIdentifier(value) {
  return createHash("sha256").update(value).digest();
}

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    phone: user.phone ?? null,
    displayName: user.display_name,
    role: user.role,
    ...(user.staff_access_level ? { staffAccessLevel: Number(user.staff_access_level) } : {}),
    emailVerified: Boolean(user.email_verified_at),
    adultDeclared: Boolean(user.adult_declared_at),
    adultDeclarationVersion: user.adult_declaration_version ?? null,
    ...(user.session_id ? { sessionId: user.session_id } : {}),
  };
}

export function createAuthService(repository, {
  sessionTtlSeconds = 2_592_000,
  maxLoginAttempts = 5,
  pilotBh = null,
  responsibleRegistration = Object.freeze({ enabled: false }),
} = {}) {
  if (responsibleRegistration.enabled && String(responsibleRegistration.cpfHmacSecret ?? "").length < 32) {
    throw new Error("Responsible registration requires a dedicated CPF HMAC secret");
  }
  if (responsibleRegistration.enabled && typeof responsibleRegistration.postalCodeService?.lookup !== "function") {
    throw new Error("Responsible registration requires a server-side postal code service");
  }
  if (responsibleRegistration.addressGeocoder && typeof responsibleRegistration.addressGeocoder.geocodeBh !== 'function') {
    throw new Error('Responsible registration address geocoder is invalid');
  }
  async function pilotAccountAllowed(user) {
    if (!pilotBh?.enabled || pilotBhInvited(pilotBh, user?.email)) return true;
    return Boolean(user?.id && repository.pilotAdmissionForUser && await repository.pilotAdmissionForUser(user.id));
  }

  async function createSession(user, context) {
    const token = createSessionToken();
    const expiresAt = new Date(Date.now() + sessionTtlSeconds * 1000);
    await repository.createSession({
      userId: user.id, tokenHash: hashSessionToken(token), expiresAt,
      userAgent: context.userAgent ?? null,
    });
    return { token, expiresAt, user: publicUser(user) };
  }

  return Object.freeze({
    async register(input) {
      let age;
      let responsible = null;
      if (responsibleRegistration.enabled) {
        const postal = await responsibleRegistration.postalCodeService.lookup(input?.responsible?.address?.postalCode);
        const validated = validateResponsibleRegistration({
          ...input?.responsible,
          postalCodeEvidence: postal.evidence,
        }, {
          expectedTerms: responsibleRegistration.terms,
        });
        const { cpf, ...safeResponsible } = validated;
        let geocode=null;
        if(responsibleRegistration.addressGeocoder){const address=safeResponsible.address;geocode=await responsibleRegistration.addressGeocoder.geocodeBh([address.street,address.number,address.district,address.city,address.state,address.postalCode].filter(Boolean).join(', '));if(geocode.partialMatch)throw new AuthError('address_geocode_partial',422,'Confirme um endereço completo e exato.');}
        responsible = Object.freeze({
          ...safeResponsible,
          address:Object.freeze({...safeResponsible.address,...(geocode?{geocode:Object.freeze({...geocode,verifiedAt:new Date().toISOString()})}:{})}),
          cpfFingerprint: createHmac("sha256", responsibleRegistration.cpfHmacSecret).update(cpf).digest(),
          terms: Object.freeze({ ...validated.terms, documents: responsibleRegistration.terms.documents }),
        });
        age = { version: ADULT_DECLARATION_VERSION };
      } else {
        try { age = adultDeclaration({ confirmed: input?.adultConfirmed, version: input?.adultDeclarationVersion }); }
        catch { throw new AuthError("adult_declaration_required", 422, "Confirme que você tem 18 anos ou mais."); }
      }
      const { email, phone } = contactFromInput(input);
      const staticInvitation = pilotBhInvited(pilotBh, email);
      const pilotInvitationToken = String(input?.pilotInvitationToken ?? "");
      if (pilotBh?.enabled && !staticInvitation && !/^[A-Za-z0-9_-]{43}$/.test(pilotInvitationToken)) {
        throw new AuthError("pilot_invitation_required", 403, "O piloto está disponível somente para contas convidadas.");
      }
      const displayName = String(input?.displayName ?? "").trim();
      const password = passwordFromInput(input?.password);
      if (displayName.length < 2 || displayName.length > 100) throw new AuthError("invalid_display_name", 422, "Informe seu nome.");

      try {
        const token = createVerificationCode();
        const challenge = createSessionToken();
        const create = pilotBh?.enabled && !staticInvitation
          ? repository.createInvitedUserWithVerification?.bind(repository)
          : repository.createUserWithVerification.bind(repository);
        if (!create) throw new AuthError("pilot_invitation_required", 403, "O piloto está disponível somente para contas convidadas.");
        const user = await create({
          email, phone, displayName, passwordHash: await hashPassword(password), adultDeclarationVersion: age.version,
          verification: { token, tokenHash: hashSessionToken(`account-verification:${challenge}.${token}`),
            identityHash: hashIdentifier(`account-verification-request:${email ? 'email' : 'phone'}:${email ?? phone}`),
            expiresAt: new Date(Date.now() + TOKEN_TTL_MS) },
          ...(responsible ? { responsibleRegistration: responsible } : {}),
          ...(pilotBh?.enabled && !staticInvitation ? { invitation: { tokenHash: hashSessionToken(pilotInvitationToken) } } : {}),
        });
        return { user: publicUser(user), verificationRequired: true, challenge };
      } catch (error) {
        if (error?.code === 'verification_request_limited') throw new AuthError('verification_request_limited', 429, 'Muitas solicitações de verificação. Aguarde antes de solicitar outro código.');
        if (error?.code === 'pilot_invitation_unavailable') throw new AuthError('pilot_invitation_required', 403, 'Convite inválido, expirado, revogado ou já utilizado.');
        if (error?.code === "23505" && ['users_email_unique', 'users_phone_unique'].includes(error.constraint)) {
          throw new AuthError("account_exists", 409, "Já existe uma conta com esses dados.");
        }
        if (error?.code === "23505" && error.constraint === "users_cpf_fingerprint_unique") {
          throw new AuthError("cpf_already_registered", 409, "Este CPF já está vinculado a uma conta.");
        }
        throw error;
      }
    },

    registrationConfiguration() {
      return Object.freeze({
        enabled: responsibleRegistration.enabled,
        truthDeclarationVersion: "FC-RESPONSIBLE-1",
        terms: responsibleRegistration.enabled && responsibleRegistration.terms?.status === "active"
          ? Object.freeze({ version: responsibleRegistration.terms.version, contentHash: responsibleRegistration.terms.contentHash })
          : null,
      });
    },

    async lookupRegistrationPostalCode(postalCode) {
      if (!responsibleRegistration.enabled) throw new AuthError("responsible_registration_unavailable", 404, "Cadastro indisponível.");
      return responsibleRegistration.postalCodeService.lookup(postalCode);
    },

    async login(input, context = {}) {
      const contact = contactFromInput(input);
      const identityHash = hashIdentifier(contact.email ?? contact.phone);
      if (await repository.countRecentFailedAttempts(identityHash) >= maxLoginAttempts) {
        throw new AuthError("too_many_attempts", 429, "Muitas tentativas. Aguarde alguns minutos.");
      }
      const user = await repository.findUserByContact(contact);
      const candidateHash = user?.password_hash ?? await hashPassword("fraldacycle-dummy-password");
      const valid = await verifyPassword(String(input?.password ?? ""), candidateHash);
      const pilotAllowed = user ? await pilotAccountAllowed(user) : false;
      await repository.recordLoginAttempt({ emailHash: identityHash, succeeded: Boolean(valid && user && !user.disabled_at && pilotAllowed) });
      if (!valid || !user || user.disabled_at || !pilotAllowed) throw new AuthError("invalid_credentials", 401, "E-mail ou senha inválidos.");

      if (ELEVATED_ROLES.has(user.role)) {
        const challenge = createSessionToken();
        const code = createVerificationCode();
        const issued = await repository.createAuthToken({
          userId: user.id,
          kind: "admin_login_mfa",
          tokenHash: hashSessionToken(`${challenge}.${code}`),
          expiresAt: new Date(Date.now() + ADMIN_MFA_TTL_MS),
          notification: { token: code },
        });
        if (!issued) throw new AuthError("invalid_credentials", 401, "Não foi possível iniciar o acesso administrativo.");
        return { mfaRequired: true, challenge, expiresAt: new Date(Date.now() + ADMIN_MFA_TTL_MS) };
      }
      return createSession(user, context);
    },

    async confirmAdminMfa(input, context = {}) {
      const challenge = String(input?.challenge ?? "");
      const code = String(input?.code ?? "");
      if (!/^[A-Za-z0-9_-]{43}$/.test(challenge) || !/^\d{6}$/.test(code)) {
        throw new AuthError("invalid_mfa_code", 422, "Código de segurança inválido ou expirado.");
      }
      const attemptHash = hashIdentifier(`admin-mfa:${challenge}`);
      const token=createSessionToken(),expiresAt=new Date(Date.now()+sessionTtlSeconds*1000);
      const result=await repository.confirmAdminMfaSession({tokenHash:hashSessionToken(`${challenge}.${code}`),attemptHash,maxAttempts:maxLoginAttempts,sessionTokenHash:hashSessionToken(token),expiresAt,userAgent:context.userAgent??null});
      if (result.limited) {
        throw new AuthError("too_many_attempts", 429, "Muitas tentativas. Inicie o acesso novamente.");
      }
      if (!result.user) {
        throw new AuthError("invalid_mfa_code", 422, "Código de segurança inválido ou expirado.");
      }
      if (!await pilotAccountAllowed(result.user)) throw new AuthError("invalid_mfa_code", 422, "Código de segurança inválido ou expirado.");
      return {token,expiresAt,user:publicUser(result.user)};
    },

    async session(token) {
      if (!token) return null;
      const record = await repository.findActiveSession(hashSessionToken(token));
      return record && await pilotAccountAllowed(record) ? publicUser(record) : null;
    },

    async logout(token) {
      if (!token) return false;
      return repository.revokeSession(hashSessionToken(token));
    },

    async requestVerification(input) {
      const supplied = contactFromInput(input);
      const contact = supplied.email ? { email: supplied.email, phone: null } : supplied;
      const identityHash = hashIdentifier(`account-verification-request:${contact.email ? 'email' : 'phone'}:${contact.email ?? contact.phone}`);
      if (!await repository.reserveVerificationRequest(identityHash)) throw new AuthError('verification_request_limited', 429, 'Muitas solicitações de verificação. Aguarde antes de solicitar outro código.');
      const challenge = createSessionToken();
      const user = await repository.findUserByContact(contact);
      if (user && !user.email_verified_at && !user.disabled_at) {
        const token = createVerificationCode();
        await repository.createAuthToken({ userId: user.id, kind: 'email_verification',
          tokenHash: hashSessionToken(`account-verification:${challenge}.${token}`),
          expiresAt: new Date(Date.now() + TOKEN_TTL_MS), notification: { token } });
      }
      return { accepted: true, challenge };
    },

    async verifyEmail(input) {
      const token = String(input?.token ?? "");
      const challenge = String(input?.challenge ?? '');
      if (!/^[A-Za-z0-9_-]{43}$/.test(challenge) || !/^\d{6}$/.test(token)) throw new AuthError('invalid_or_expired_token', 422, 'Código inválido ou expirado. Solicite um novo código se necessário.');
      const result = await repository.confirmVerificationToken({
        tokenHash: hashSessionToken(`account-verification:${challenge}.${token}`),
        attemptHash: hashIdentifier(`account-verification:${challenge}`), maxAttempts: maxLoginAttempts,
      });
      if (result.limited) throw new AuthError('too_many_attempts', 429, 'Muitas tentativas. Solicite um novo código de verificação.');
      if (!result.user) throw new AuthError("invalid_or_expired_token", 422, "Código inválido ou expirado.");
      return { user: publicUser(result.user) };
    },

    async requestPasswordRecovery(input) {
      const suppliedContact = contactFromInput(input);
      const contact = suppliedContact.email ? { email: suppliedContact.email, phone: null } : suppliedContact;
      const identityHash = hashIdentifier(`password-recovery-request:${contact.email ? 'email' : 'phone'}:${contact.email ?? contact.phone}`);
      if (!await repository.reservePasswordRecoveryRequest(identityHash)) {
        throw new AuthError("recovery_request_limited", 429, "Muitas solicitações de recuperação. Aguarde antes de solicitar outro código.");
      }
      const challenge = createSessionToken();
      const user = await repository.findUserByContact(contact);
      if (user && !user.disabled_at) {
        const token = createVerificationCode();
        await repository.createAuthToken({ userId: user.id, kind: "password_recovery",
          tokenHash: hashSessionToken(`password-recovery:${challenge}.${token}`),
          expiresAt: new Date(Date.now() + TOKEN_TTL_MS), notification: { token } });
      }
      return { accepted: true, challenge };
    },

    async resetPassword(input) {
      const password = passwordFromInput(input?.password);
      const token = String(input?.token ?? "");
      const challenge = String(input?.challenge ?? "");
      if (!/^[A-Za-z0-9_-]{43}$/.test(challenge) || !/^\d{6}$/.test(token)) {
        throw new AuthError("invalid_or_expired_token", 422, "Código inválido ou expirado. Solicite um novo código se necessário.");
      }
      const userId = await repository.resetPasswordWithToken({
        tokenHash: hashSessionToken(`password-recovery:${challenge}.${token}`),
        attemptHash: hashIdentifier(`password-recovery:${challenge}`), maxAttempts: maxLoginAttempts,
        passwordHash: await hashPassword(password),
      });
      if (userId?.limited) throw new AuthError("too_many_attempts", 429, "Muitas tentativas. Solicite um novo código de recuperação.");
      if (!userId) throw new AuthError("invalid_or_expired_token", 422, "Código inválido ou expirado.");
      return { success: true };
    },
  });
}
