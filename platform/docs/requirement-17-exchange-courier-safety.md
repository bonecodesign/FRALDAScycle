# Requisito formal 17 — entregadores nas duas pernas da troca

**Status: parcial.** O código existente já mantém duas remessas independentes, confirmação financeira da diferença, atribuição de entregadores distintos nos testes sintéticos, comprovante e validação por destinatário. Nenhuma entrega, cobrança ou repasse de fornecedor foi habilitado.

## Lacuna corrigida nesta etapa

O aceite de uma oferta de entrega já revalidava cadastro, identidade, veículo, antecedentes, prazo e suspensão do entregador, mas não verificava todas as condições da transação e da troca. Uma oferta ainda válida não pode substituir o bloqueio da operação.

No método `logisticsRepository.acceptCourierOffer`, além da elegibilidade documental e do prazo de três minutos, são verificadas **na mesma atualização condicional**:

- **Venda:** transação de venda em `paid` ou `in_delivery`, sem disputa financeira nem chamados operacionais impeditivos. Mantém a situação `provider_pending` de remessa de venda para o fluxo já existente.
- **Troca:** remessa associada a uma perna de troca, já em `awaiting_pickup` ou `assigned`, transação `in_delivery`, operação de troca `accepted` ou `in_delivery`, sem disputa/atendimento impeditivo. Se existe obrigação de diferença, ela deve ter estado `paid`; uma diferença `not_charged` ou `provider_pending` impede a atribuição.
- **Atribuição direta:** aplica também a condição de diferença paga na própria autorização de atribuição, reforçando a trava mesmo se alguém alterar incorretamente o estado da remessa.

Todos os bloqueios recusam a atribuição e não geram evento `shipment.courier.offer_accepted`. Não há consulta a credenciais, endereço, documento policial bruto ou cobrança.

## Evidências de validação

`tests/exchange-courier-offer-guards-postgres.test.mjs`: cria troca e duas pernas fictícias com dois entregadores sintéticos aptos. Tenta aceitar ofertas antes do pagamento da diferença, com estado de remessa artificialmente alterado, com transação disputada, operação cancelada e cadastro suspenso. Somente depois da liberação local da diferença admite as duas atribuições independentes; verifica que os eventos de auditoria não se duplicam e que não existe `payment_intent`.

## Bloqueios de produção

Disponibilidade real dos entregadores, documentos/consentimentos verificados pelo processo competente, frete cotado e liquidado, repasses, coleta/entrega físicas, fornecedores e operação supervisionada ainda exigem homologação. Esta etapa não ativa orquestração operacional autônoma, contratação, publicação ou transferências reais.
