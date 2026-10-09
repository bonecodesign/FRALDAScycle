import { randomBytes, randomInt, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;
const MAX_PASSWORD_LENGTH = 1_024;

export async function hashPassword(password) {
  if (typeof password !== "string" || password.length < 12 || password.length > MAX_PASSWORD_LENGTH) {
    throw new TypeError("Password must contain between 12 and 1024 characters");
  }
  const salt = randomBytes(SALT_LENGTH);
  const key = await scrypt(password, salt, KEY_LENGTH);
  return `scrypt$${salt.toString("base64url")}$${Buffer.from(key).toString("base64url")}`;
}

export async function verifyPassword(password, encoded) {
  const [algorithm, saltValue, keyValue] = String(encoded).split("$");
  if (algorithm !== "scrypt" || !saltValue || !keyValue) return false;
  if (typeof password !== "string" || password.length > MAX_PASSWORD_LENGTH) return false;
  try {
    const salt = Buffer.from(saltValue, "base64url");
    const expected = Buffer.from(keyValue, "base64url");
    if (salt.length !== SALT_LENGTH || expected.length !== KEY_LENGTH) return false;
    const actual = Buffer.from(await scrypt(password, salt, KEY_LENGTH));
    return timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

export function createSessionToken() {
  return randomBytes(32).toString("base64url");
}

export function createVerificationCode() {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}
