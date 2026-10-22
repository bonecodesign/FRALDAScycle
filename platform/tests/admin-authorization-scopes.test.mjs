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

test("rotas administrativas bloqueiam HTTP lógico antes de acessar serviços", async () => {
  const { Readable } = await import("node:stream");
  const { handleAdmin } = await import("../apps/api/admin-handler.js");
  const actors = {
    admin: { id: "admin-test", role: "admin" },
    moderator: { id: "moderator-test", role: "moderator" },
    customer: { id: "customer-test", role: "customer" },
  };
  const authService = { async session(token) { return actors[token] ?? null; } };
  const routes = [
    ["/v1/admin/overview-snapshot", "moderator"],
    ["/v1/admin/finance-snapshot", "moderator"],
    ["/v1/admin/logistics-snapshot", "moderator"],
    ["/v1/admin/audit-events", "customer"],
    ["/v1/admin/audit-events.csv", "customer"],
    ["/v1/admin/users", "customer"],
  ];
  let invoked = 0;
  const adminService = new Proxy({}, { get() { invoked += 1; throw new Error("service must not be reached"); } });
  for (const [pathname, role] of routes) {
    const request = Readable.from([]);
    request.method = "GET";
    request.headers = { cookie: "fc_session=" + role };
    const response = { writeHead() {}, end() {} };
    await assert.rejects(
      handleAdmin(request, response, {
        url: new URL("http://localhost" + pathname),
        headers: {}, requestId: "security-test", authService, adminService,
      }),
      error => error.code === "forbidden" && error.status === 403,
      pathname + " must reject " + role,
    );
  }
  assert.equal(invoked, 0);
});
