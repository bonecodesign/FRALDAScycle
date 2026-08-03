import { createHash } from "node:crypto";
import { createSessionToken, hashPassword, verifyPassword } from "./security.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class AuthError extends Error {
  constructor(code, status = 400, message = "Não foi possível concluir a autenticação.") {
    super(message);
    this.name = "AuthError";
    this.code = code;
    this.status = status;
  }
}

export function normalizeEmail(value) {
  return String(value ?? "").trim().toLocaleLowerCase("pt-BR");
}

export function hashSessionToken(token) {
  return createHash("sha256").update(token).digest();
}

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    phone: user.phone ?? null,
    displayName: user.display_name,
    role: user.role,
    emailVerified: Boolean(user.email_verified_at),
  };
}

export function createAuthService(repository, { sessionTtlSeconds = 2_592_000 } = {}) {
  return Object.freeze({
    async register(input) {
      const email = normalizeEmail(input?.email);
      const displayName = String(input?.displayName ?? "").trim();
      const password = String(input?.password ?? "");
      if (!EMAIL_PATTERN.test(email)) throw new AuthError("invalid_email", 422, "Informe um e-mail válido.");
      if (displayName.length < 2 || displayName.length > 100) {
        throw new AuthError("invalid_display_name", 422, "Informe seu nome.");
      }
      if (password.length < 12) {
        throw new AuthError("weak_password", 422, "A senha deve ter pelo menos 12 caracteres.");
      }

      try {
        const user = await repository.createUser({
          email,
          displayName,
          passwordHash: await hashPassword(password),
          phone: input?.phone ? String(input.phone).trim() : null,
        });
        return { user: publicUser(user), verificationRequired: true };
      } catch (error) {
        if (error?.code === "23505") {
          throw new AuthError("account_exists", 409, "Já existe uma conta com esses dados.");
        }
        throw error;
      }
    },

    async login(input, context = {}) {
      const email = normalizeEmail(input?.email);
      const password = String(input?.password ?? "");
      const user = await repository.findUserByEmail(email);
      const valid = user && !user.disabled_at && await verifyPassword(password, user.password_hash);
      if (!valid) throw new AuthError("invalid_credentials", 401, "E-mail ou senha inválidos.");

      const token = createSessionToken();
      const expiresAt = new Date(Date.now() + sessionTtlSeconds * 1000);
      await repository.createSession({
        userId: user.id,
        tokenHash: hashSessionToken(token),
        expiresAt,
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
  });
}
