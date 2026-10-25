import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../apps/app/finance.js", import.meta.url), "utf8");

test("checkout separa CPF de cobrança dos campos enviados à tokenização", () => {
  assert.match(source, /name=\"billingCpf\"/);
  assert.match(source, /não comprova a titularidade do cartão/);
  assert.match(source, /input:not\(\[name=\"billingCpf\"\]\)/);
  assert.match(source, /billingCpf=cpfField\.value/);
  assert.match(source, /body:\{transactionId,idempotencyKey,method,paymentMethodToken,billingCpf,/);
  assert.doesNotMatch(source, /localStorage.*billingCpf|sessionStorage.*billingCpf/);
});
