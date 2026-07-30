import test from "node:test";
import assert from "node:assert/strict";
import { blockedContactReason } from "./chat-safety.js";

test("permite negociação normal dentro da plataforma", () => {
  assert.equal(blockedContactReason("Posso retirar amanhã no período da tarde?"), "");
});

test("bloqueia telefone numérico", () => {
  assert.match(blockedContactReason("Meu telefone é (31) 99990-0000"), /telefone/i);
});

test("bloqueia telefone escrito por extenso", () => {
  assert.match(
    blockedContactReason("nove nove nove nove zero zero zero zero"),
    /telefone/i
  );
});

test("bloqueia links, e-mail e redes sociais", () => {
  assert.match(blockedContactReason("acesse https://exemplo.com"), /links/i);
  assert.match(blockedContactReason("contato@exemplo.com"), /e-mail/i);
  assert.match(blockedContactReason("me chama no Instagram @perfil"), /instagram|facebook/i);
});

test("bloqueia referência a QR code", () => {
  assert.match(blockedContactReason("vou mandar um QR code"), /QR codes/i);
});
