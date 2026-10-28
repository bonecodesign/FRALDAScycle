# Recálculo e reutilização de cotações de entrega

Estado: política, persistência e confirmação HTTP implementadas; consulta ao fornecedor e cobrança real continuam desligadas.

## Regra aprovada

- estimativas exibidas antes do checkout não podem ser confirmadas diretamente;
- ao entrar no checkout, solicitar uma cotação nova;
- a cotação de checkout pode ser reutilizada por no máximo 10 minutos;
- a validade efetiva é o menor prazo entre 10 minutos e a expiração informada pelo fornecedor;
- mudança de endereço de origem ou destino, versão do endereço, modalidade, anúncio, quantidade ou versão do pacote invalida a cotação;
- cotação vencida ou incompatível exige recálculo e nova confirmação do pagador;
- depois do pagamento processado, não recalcular nem trocar fornecedor automaticamente: encaminhar ao suporte.

O cache é privado (`private, max-age=600`). O identificador de compatibilidade usa somente IDs e versões técnicas; não contém endereço completo, contato ou dados infantis.

## Evidência local

- `delivery_quotes` preserva fornecedor, valor-base, comissão FraldaCycle, total, fingerprint e expiração;
- `POST /v1/delivery-quotes/:id/confirm` exige sessão do comprador e correspondência exata da cotação;
- confirmação repetida idêntica é idempotente;
- tentativa de adulterar o total é recusada;
- após a trava para pagamento, nenhuma nova cotação ou substituição automática é aceita;
- para parceiros externos, o valor integral cotado pelo parceiro é preservado e os 5% da FraldaCycle são adicionados ao total do pagador;
- a prova HTTP/PostgreSQL está em `tests/delivery-quote-http-postgres.test.mjs`.

## Ativação pendente

A integração real ainda deve consultar o fornecedor homologado com os consentimentos e dados mínimos aprovados, ligar a cotação confirmada à criação do pagamento e criar o pedido logístico somente após o evento financeiro correto. O checkout com entrega continua bloqueado até essas integrações externas.
