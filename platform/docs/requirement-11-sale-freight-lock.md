# Requisito formal 11 — proteção de cotação e trava de frete na venda

**Status: parcial.** A preparação comercial de frete permanece sem chamadas financeiras externas. A cotação do comprador exibe o preço-base do parceiro ou entregador, a comissão de 5% da FraldaCycle e o total de pagamento; as tarifas reais de processamento não são presumidas.

## Endurecimento da transição de cotação para pagamento

A rotina interna `deliveryQuoteRepository.lockForPayment` agora só pode travar uma cotação de **venda** que simultaneamente:

- pertence a uma transação de venda em estado elegível;
- não pertence a nenhuma das duas remessas de uma troca (`shipment_id IS NULL`);
- está confirmada, ainda válida e foi confirmada pelo **comprador da própria transação**.

Nenhuma das cotações independentes de uma troca pode ser travada por essa rotina. A transição altera somente a linha correta, mantém o evento de auditoria existente e falha de modo fechado quando não há cotação de venda apta. A rotina continua interna e não habilita checkout financeiro de frete.

## Validação de validade

O serviço de registro rejeita valores `expiresAt` ausentes, inválidos ou vencidos com erro de domínio antes da persistência. Não aceita datas inválidas que seriam convertidas acidentalmente em `Invalid Date` nem mantém uma cotação sem prazo utilizável.

## Evidências

- `tests/delivery-quote-http-postgres.test.mjs`: teste real em PostgreSQL, cobrindo comprador confirmado, confirmação adulterada, bloqueio de vendedor como confirmador, trava da venda e impedimento de travar as duas cotações de troca.
- `tests/delivery-quote-persistence.test.mjs`: rejeição de expiração malformada e vencida sem registrar cotação.
- `tests/freight-payment-readiness-postgres.test.mjs`: pagamento de venda com frete ainda bloqueado contra bypass do comprador.

## O que permanece pendente

Cotações consultadas efetivamente em fornecedores homologados, operação logística externa e garantia do valor entregue; processador de pagamento e termos comerciais de split/tarifa; cobrança única corretamente distribuída; conciliação verificável por recebedor, reversões e repasses. **Não foram ativados contratação, credenciais, pedidos de entrega, cobrança, repasse ou publicação externa.** A matriz permanece com o item 11 `parcial`, sem alterar os outros requisitos.
