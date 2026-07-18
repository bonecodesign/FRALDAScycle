import {
  createHmac,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const TOKEN_DURATION_MS = 1000 * 60 * 60 * 24 * 7;

export class AuthenticationError extends Error {
  constructor(message, statusCode = 401) {
    super(message);
    this.name = "AuthenticationError";
    this.statusCode = statusCode;
  }
}

function normalizeEmail(email) {
  if (typeof email !== "string") {
    throw new AuthenticationError("Email is required", 400);
  }

  const normalized = email.trim().toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new AuthenticationError("Email is invalid", 400);
  }

  return normalized;
}

function validatePassword(password) {
  if (typeof password !== "string" || password.length < 8) {
    throw new AuthenticationError(
      "Password must contain at least 8 characters",
      400,
    );
  }
}

async function hashPassword(password, salt = randomBytes(16).toString("hex")) {
  const derivedKey = await scrypt(password, salt, 64);

  return {
    passwordHash: Buffer.from(derivedKey).toString("hex"),
    passwordSalt: salt,
  };
}

function sign(value, secret) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    createdAt: user.createdAt,
  };
}

export class AuthService {
  constructor({ userRepository, secret }) {
    if (!secret || secret.length < 32) {
      throw new Error("AUTH_SECRET must contain at least 32 characters");
    }

    this.userRepository = userRepository;
    this.secret = secret;
  }

  async register({ email, password }) {
    const normalizedEmail = normalizeEmail(email);
    validatePassword(password);

    if (await this.userRepository.findByEmail(normalizedEmail)) {
      throw new AuthenticationError("Email is already registered", 409);
    }

    const passwordData = await hashPassword(password);
    const user = await this.userRepository.create({
      email: normalizedEmail,
      ...passwordData,
    });

    return {
      token: this.createToken(user),
      user: publicUser(user),
    };
  }

  async login({ email, password }) {
    const normalizedEmail = normalizeEmail(email);
    validatePassword(password);

    const user = await this.userRepository.findByEmail(normalizedEmail);

    if (!user) {
      throw new AuthenticationError("Invalid email or password");
    }

    const { passwordHash } = await hashPassword(password, user.passwordSalt);
    const expectedHash = Buffer.from(user.passwordHash, "hex");
    const receivedHash = Buffer.from(passwordHash, "hex");

    if (
      expectedHash.length !== receivedHash.length ||
      !timingSafeEqual(expectedHash, receivedHash)
    ) {
      throw new AuthenticationError("Invalid email or password");
    }

    return {
      token: this.createToken(user),
      user: publicUser(user),
    };
  }

  async authenticate(token) {
    if (typeof token !== "string") {
      throw new AuthenticationError("Authentication token is required");
    }

    const [payload, signature, ...remainingParts] = token.split(".");

    if (!payload || !signature || remainingParts.length > 0) {
      throw new AuthenticationError("Authentication token is invalid");
    }

    const expectedSignature = Buffer.from(sign(payload, this.secret));
    const receivedSignature = Buffer.from(signature);

    if (
      expectedSignature.length !== receivedSignature.length ||
      !timingSafeEqual(expectedSignature, receivedSignature)
    ) {
      throw new AuthenticationError("Authentication token is invalid");
    }

    try {
      const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));

      if (
        typeof claims.sub !== "string" ||
        typeof claims.exp !== "number" ||
        claims.exp <= Date.now()
      ) {
        throw new AuthenticationError("Authentication token has expired");
      }

      const user = await this.userRepository.findById(claims.sub);

      if (!user) {
        throw new AuthenticationError("Authentication token is invalid");
      }

      return publicUser(user);
    } catch (error) {
      if (error instanceof AuthenticationError) {
        throw error;
      }

      throw new AuthenticationError("Authentication token is invalid");
    }
  }

  createToken(user) {
    const payload = Buffer.from(
      JSON.stringify({
        exp: Date.now() + TOKEN_DURATION_MS,
        sub: user.id,
      }),
    ).toString("base64url");

    return `${payload}.${sign(payload, this.secret)}`;
  }
}
