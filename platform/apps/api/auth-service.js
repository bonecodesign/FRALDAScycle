import { createHash } from "node:crypto";
import { createSessionToken, createVerificationCode, hashPassword, verifyPassword } from "./security.js";
import { adultDeclaration } from "../../packages/contracts/account-age.js";
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
} = {}) {
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
      try { age = adultDeclaration({ confirmed: input?.adultConfirmed, version: input?.adultDeclarationVersion }); }
      catch { throw new AuthError("adult_declaration_required", 422, "Confirme que você tem 18 anos ou mais."); }
      const { email, phone } = contactFromInput(input);
      if (!pilotBhInvited(pilotBh, email)) throw new AuthError("pilot_invitation_required", 403, "O piloto está disponível somente para contas convidadas.");
      const displayName = String(input?.displayName ?? "").trim();
      const password = passwordFromInput(input?.password);
      if (displayName.length < 2 || displayName.length > 100) throw new AuthError("invalid_display_name", 422, "Informe seu nome.");

      try {
        const token = createVerificationCode();
        const challenge = createSessionToken();
        const user = await repository.createUserWithVerification({
          email, phone, displayName, passwordHash: await hashPassword(password), adultDeclarationVersion: age.version,
          verification: { token, tokenHash: hashSessionToken(`account-verification:${challenge}.${token}`),
            identityHash: hashIdentifier(`account-verification-request:${email ? 'email' : 'phone'}:${email ?? phone}`),
            expiresAt: new Date(Date.now() + TOKEN_TTL_MS) },
        });
        return { user: publicUser(user), verificationRequired: true, challenge };
      } catch (error) {
        if (error?.code === 'verification_request_limited') throw new AuthError('verification_request_limited', 429, 'Muitas solicitações de verificação. Aguarde antes de solicitar outro código.');
        if (error?.code === "23505" && ['users_email_unique', 'users_phone_unique'].includes(error.constraint)) {
          throw new AuthError("account_exists", 409, "Já existe uma conta com esses dados.");
        }
        throw error;
      }
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
      await repository.recordLoginAttempt({ emailHash: identityHash, succeeded: Boolean(valid && user && !user.disabled_at && pilotBhInvited(pilotBh, user.email)) });
      if (!valid || !user || user.disabled_at || !pilotBhInvited(pilotBh, user.email)) throw new AuthError("invalid_credentials", 401, "E-mail ou senha inválidos.");

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
      if (!pilotBhInvited(pilotBh, result.user.email)) throw new AuthError("invalid_mfa_code", 422, "Código de segurança inválido ou expirado.");
      return {token,expiresAt,user:publicUser(result.user)};
    },

    async session(token) {
      if (!token) return null;
      const record = await repository.findActiveSession(hashSessionToken(token));
      return record && pilotBhInvited(pilotBh, record.email) ? publicUser(record) : null;
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
