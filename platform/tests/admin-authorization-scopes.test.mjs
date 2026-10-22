import assert from "node:assert/strict";
import test from "node:test";
import { hasScope, requireScope } from "../apps/api/authorization.js";

const protectedScopes = [
  "admin:operations:read",
  "admin:finance:read",
  "admin:deliveries:validate",
  "admin:audit:read",
  "admin:users:write",
  "admin:roles:write",
];

test("acesso administrativo exige sessão autenticada", () => {
  for (const scope of protectedScopes) {
    assert.throws(() => requireScope(null, scope), error =>
      error.code === "unauthenticated" && error.status === 401);
  }
});

test("clientes e entregadores não acessam os escopos administrativos", () => {
  for (const role of ["customer", "courier"]) {
    for (const scope of protectedScopes) {
      assert.equal(hasScope({ role }, scope), false);
      assert.throws(() => requireScope({ role }, scope), error =>
        error.code === "forbidden" && error.status === 403);
    }
  }
});

test("moderadores só podem ler auditoria dentre os escopos críticos", () => {
  for (const scope of protectedScopes) {
    assert.equal(hasScope({ role: "moderator" }, scope), scope === "admin:audit:read");
  }
});

test("administradores recebem os escopos críticos declarados", () => {
  for (const scope of protectedScopes) {
    assert.equal(requireScope({ role: "admin" }, scope).role, "admin");
  }
});

test("papéis desconhecidos não recebem permissões por padrão", () => {
  for (const scope of protectedScopes) {
    assert.equal(hasScope({ role: "unknown" }, scope), false);
  }
});
