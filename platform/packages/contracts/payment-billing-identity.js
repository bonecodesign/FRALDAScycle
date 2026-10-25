import { createHmac, timingSafeEqual } from "node:crypto";
import { normalizeCpf } from "./responsible-registration.js";

function fail(code, status, message) {
  return Object.assign(new Error(message), { code, status });
}

export function verifyBillingCpf(value, storedFingerprint, secret) {
  if (typeof secret !== "string" || secret.length < 32) {
    throw fail("billing_identity_not_configured", 503, "A validação da identidade de cobrança não está configurada.");
  }
  const cpf = normalizeCpf(value);
  const expected = Buffer.isBuffer(storedFingerprint) ? storedFingerprint : Buffer.from(storedFingerprint ?? []);
  const actual = createHmac("sha256", secret).update(cpf).digest();
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    throw fail("billing_cpf_mismatch", 422, "O CPF da cobrança deve ser o mesmo CPF cadastrado na conta.");
  }
  return cpf;
}
