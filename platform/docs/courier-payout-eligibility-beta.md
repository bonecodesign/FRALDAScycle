# Elegibilidade de repasse ao entregador — beta local

Esta etapa cria uma obrigação financeira interna, não uma transferência. A preparação exige venda, entrega concluída, comprovante, aprovação do recebedor, validação administrativa independente, pagamento confirmado com referência externa, frete positivo, entregador atribuído e ausência de disputa, reembolso ou chamado financeiro aberto.

O frete registrado no pagamento é a única base aceita. A regra vigente separa 5% para a plataforma e 95% para o entregador, preservando os valores no ledger e na auditoria. Repetições retornam a mesma obrigação por entrega.

Toda obrigação nasce como `provider_pending`. A consulta informa elegibilidade e bloqueios, mas mantém `payoutAllowed=false`. Não existe nesta etapa função que transforme a obrigação em paga, nem chamada de transferência, credencial de recebedor ou referência fictícia de repasse.

Como o checkout atual ainda bloqueia cobrança de frete, operações reais continuarão sem elegibilidade até a homologação financeira e logística. PostgreSQL nativo, testes HTTP, KYC, dados bancários, conciliação e provedor de repasse permanecem pendentes.
