import { createHash } from "node:crypto";
import { createSessionToken, createVerificationCode, hashPassword, verifyPassword } from "./security.js";
import { createNotificationService } from "./notifications.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TOKEN_TTL_MS = 30 * 60 * 1000;

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
    ...(user.session_id ? { sessionId: user.session_id } : {}),
  };
}

export function createAuthService(repository, {
  sessionTtlSeconds = 2_592_000,
  notificationService = createNotificationService(),
  maxLoginAttempts = 5,
} = {}) {
  async function issueToken(user, kind) {
    const token = createVerificationCode();
    await repository.createAuthToken({
      userId: user.id,
      kind,
      tokenHash: hashSessionToken(token),
      expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
    });
    if (kind === "email_verification") {
      await notificationService.verification({ email: user.email, phone: user.phone, token });
    } else {
      await notificationService.passwordRecovery({ email: user.email, phone: user.phone, token });
    }
  }

  return Object.freeze({
    async register(input) {
      const { email, phone } = contactFromInput(input);
      const displayName = String(input?.displayName ?? "").trim();
      const password = String(input?.password ?? "");
      if (displayName.length < 2 || displayName.length > 100) throw new AuthError("invalid_display_name", 422, "Informe seu nome.");
      if (password.length < 12) throw new AuthError("weak_password", 422, "A senha deve ter pelo menos 12 caracteres.");

      try {
        const user = await repository.createUser({
          email, phone, displayName, passwordHash: await hashPassword(password),
        });
        await issueToken(user, "email_verification");
        return { user: publicUser(user), verificationRequired: true };
      } catch (error) {
        if (error?.code === "23505") throw new AuthError("account_exists", 409, "Já existe uma conta com esses dados.");
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
      await repository.recordLoginAttempt({ emailHash: identityHash, succeeded: Boolean(valid && user && !user.disabled_at) });
      if (!valid || !user || user.disabled_at) throw new AuthError("invalid_credentials", 401, "E-mail ou senha inválidos.");

      const token = createSessionToken();
      const expiresAt = new Date(Date.now() + sessionTtlSeconds * 1000);
      await repository.createSession({
        userId: user.id, tokenHash: hashSessionToken(token), expiresAt,
        userAgent: context.userAgent ?? null,
      });
      return { token, expiresAt, user: publicUser(user) };
    },

    async session(token) {
      if (!token) return null;
      const record = await repository.findActiveSession(hashSessionToken(token));
      return record ? publicUser(record) : null;
    },

    async logout(token) {
      if (!token) return false;
      return repository.revokeSession(hashSessionToken(token));
    },

    async requestVerification(input) {
      const user = await repository.findUserByContact(contactFromInput(input));
      if (user && !user.email_verified_at && !user.disabled_at) await issueToken(user, "email_verification");
      return { accepted: true };
    },

    async verifyEmail(input) {
      const token = String(input?.token ?? "");
      const userId = token && await repository.consumeAuthToken({
        tokenHash: hashSessionToken(token), kind: "email_verification",
      });
      if (!userId) throw new AuthError("invalid_or_expired_token", 422, "Código inválido ou expirado.");
      return { user: publicUser(await repository.markEmailVerified(userId)) };
    },

    async requestPasswordRecovery(input) {
      const user = await repository.findUserByContact(contactFromInput(input));
      if (user && !user.disabled_at) await issueToken(user, "password_recovery");
      return { accepted: true };
    },

    async resetPassword(input) {
      const password = String(input?.password ?? "");
      if (password.length < 12) throw new AuthError("weak_password", 422, "A senha deve ter pelo menos 12 caracteres.");
      const token = String(input?.token ?? "");
      const userId = token && await repository.consumeAuthToken({
        tokenHash: hashSessionToken(token), kind: "password_recovery",
      });
      if (!userId) throw new AuthError("invalid_or_expired_token", 422, "Código inválido ou expirado.");
      await repository.replacePasswordAndRevokeSessions(userId, await hashPassword(password));
      return { success: true };
    },
  });
}
