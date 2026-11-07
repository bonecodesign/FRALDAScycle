# Requisito formal 9 — frete nas duas pernas da troca

**Status: parcial.** A responsabilidade continua individual: o destinatário de cada pacote paga seu próprio frete (valor-base do parceiro/entregador + comissão de 5% da FraldaCycle). Não existe pagamento agregado de frete da troca.

## Nova consulta financeira local

`GET /v1/admin/freight-settlement-plans/exchanges/:transactionId/legs`

A consulta é **somente leitura**, exige conta administrativa do setor financeiro e nível de acesso 3 ou superior, retorna `Cache-Control: no-store` e não expõe endereços, contatos ou cartões. Reutiliza as duas entregas, suas cotações e os planos locais já persistidos. Para cada perna, apresenta a identificação do pagador, o plano, a transportadora, o valor-base, a comissão de 5% e o valor que **seria** cobrado, sem gerar uma cobrança.

A validação reprova pernas ausentes/duplicadas, destinatários/pagadores incompatíveis, cotação não confirmada ou expirada, preço inconsistente e plano local ausente ou divergente. `localReady` significa **somente** correspondência comercial e documental interna. `totals`, quando disponível, é uma soma **exclusivamente contábil**, nunca uma fatura conjunta.

Exemplo fictício: perna 1 R$ 20,00 + R$ 1,00 para FraldaCycle (pagador A); perna 2 R$ 30,00 + R$ 1,50 (pagador B). Total contábil R$ 52,50, mas são **duas obrigações independentes**.

O resultado preserva `providerReconciled: false`, `externalChargeCreated: false` e `payoutAllowed: false`, inclusive quando as duas pernas estiverem `localReady`. As travas de liquidação externa permanecem intactas.

## Provas e limites

`tests/exchange-freight-readiness.test.mjs` cobre legitimidade das duas pernas, segregação de pagadores, preço e tratamento fail-closed de inconsistências. `tests/freight-settlement-postgres.test.mjs` valida consulta financeira por HTTP e PostgreSQL com duas cotações e planos sintéticos.

A contratação e integração de transportadoras, preço cotado externamente, cobrança individual por recebedor, confirmação financeira, reversão, entrega física e homologação operacional permanecem pendentes. **Não habilitar fornecedores, segredos, cobranças nem repasses.**
