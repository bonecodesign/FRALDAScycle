# Plano financeiro de frete vinculado às obrigações de repasse

## Reuso e escopo

A implementação reaproveita `freight_settlement_plans` (migração 139), `delivery_quotes`, `payment_intents` e os módulos de repasse local já existentes. A migração 140 acrescenta referências **opcionais** ao plano em `seller_payout_obligations` e `courier_payout_obligations`, mantendo a compatibilidade de registros legados sem plano.

Nenhum requisito foi excluído, nenhum fornecedor foi ativado e não existe transferência automática. Os estados preparados permanecem `provider_pending`, sem referência de pagamento externo.

## Regras da ligação

Ao preparar uma obrigação para uma venda com cotação ativa, **o plano correspondente à própria cotação é obrigatório**. A cotação precisa estar travada para pagamento, confirmada pelo comprador e corresponder ao fornecedor, pagador, valor-base, comissão e total do plano. O sistema compara a intenção de pagamento com a composição comercial completa:

- Preço-base do produto: R$ 100,00;
- Comissão sobre o produto (8%): R$ 8,00;
- Valor do vendedor: R$ 92,00;
- Preço-base do entregador: R$ 20,00;
- Comissão logística (5% adicionados ao preço-base): R$ 1,00;
- Total confirmado pelo comprador: R$ 121,00.

A obrigação do vendedor registra **R$ 100,00 de produto, R$ 8,00 de comissão e R$ 92,00 ao vendedor**. No caso de entregador FraldaCycle, a obrigação do entregador registra **R$ 21,00 de frete total, R$ 1,00 de comissão e R$ 20,00 de valor devido ao entregador**. O campo `freight_cents` é o total do frete, compatível com a restrição SQL de que comissão + entregador = total.

Para entrega por parceiro externo (Lalamove, Loggi, Uber Direct), **não** se prepara um repasse da FraldaCycle a um entregador local. A obrigação do vendedor continua podendo ser preparada após o controle de elegibilidade; a contraprestação financeira ao parceiro externo segue condicionada a integração e contrato específicos.

Preparações legadas **sem cotação de frete ativa e sem plano** mantêm o comportamento anterior; a regra nova não migra ou modifica obrigações já registradas. Para vendas com plano, dados incorretos ou ausência do plano bloqueiam a preparação; é proibido fazer fallback para a fórmula legada.

## Elegibilidade, histórico e falhas

As telas de situação financeira para vendedor e entregador também refletem bloqueios de plano inexistente ou inconsistência de valores; nunca afirmam que existe um repasse executável. A preparação exige, além da integridade contábil, pagamento marcado como pago, apenas uma intenção paga, comprovação de entrega, aceite do recebedor, validação independente e ausência de disputa financeira ou chamado de cancelamento pendente.

A gravação preserva a referência à cotação e ao plano na obrigação e no registro de auditoria. Repetições da mesma preparação reutilizam a obrigação existente. O banco protege contra referência duplicada por obrigação e por plano.

## Limites ainda pendentes

Os registros locais **não comprovam dinheiro no provedor**. Não houve criação de cobranças, acionamento de API financeira, retenção/custódia, liquidação, consulta bancária, autorização de repasse ou validação de contratos. Ainda são necessárias conciliação externa, tarifas reais, regras do processador, tratamento de chargeback, homologação e integração logística. As duas pernas de troca continuam com seus planos independentes, mas não são liberadas por esse fluxo de venda.

A validação usa testes unitários e PostgreSQL isolado, mantendo os 70 requisitos na matriz e sem mudar os estados de parcial para concluído.
