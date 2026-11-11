# Gate de ativação — Asaas e Lalamove

O manifesto `config/pilot-provider-activation.v1.json` registra, sem credenciais ou documentos privados, as evidências mínimas para homologar os dois fornecedores escolhidos para o piloto de Belo Horizonte.

O estado inicial é deliberadamente `not-ready`. Cada aprovação ou ensaio externo deve produzir uma referência opaca permitida (`approval:`, `contract:`, `test:`, `drill:` ou `decision:`), nunca o documento, dado pessoal, URL privada ou segredo. Uma marcação `true` sem evidência correspondente invalida o manifesto.

Execute:

    npm run providers:activation:validate

O resultado `ready: true` significa somente que todas as evidências exigidas foram registradas e que o projeto pode passar por uma **decisão explícita de ativação**. Ele não ativa produção nem transações reais: as duas permissões continuam falsas até uma mudança separada, revisada e autorizada.

## Asaas

Exige contrato e aprovações jurídica, privacidade, segurança e comercial; tarifas conhecidas; sandbox; webhooks; conciliação; estorno/disputa e rollback. O teste deve cobrir valores em centavos, eventos duplicados e fora de ordem, divergência de valor, estorno e falha após timeout.

## Lalamove

Exige as mesmas aprovações, tarifas conhecidas, sandbox, cobertura real do piloto em Belo Horizonte, webhooks, prova de entrega, cancelamento/falha e rollback. O ensaio deve cobrir cotação, validade, criação, atribuição, coleta, entrega, cancelamento e indisponibilidade sem substituição automática após pagamento.

## Limite

Este gate não substitui contrato, parecer profissional, credenciais em cofre, operação humana ou testes com contas autorizadas. Enquanto qualquer bloqueador permanecer, os requisitos financeiros e logísticos continuam parciais ou bloqueados e o piloto permanece `NO-GO`.
