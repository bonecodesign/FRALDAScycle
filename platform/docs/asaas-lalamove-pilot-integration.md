# Integração Asaas + Lalamove — piloto BH

Decisão em 2026-10-19: fornecedores escolhidos para homologação, sem contrato, credenciais ou ativação. Os módulos nativos `apps/api/asaas-webhook.js` e `apps/api/lalamove-client.js` são preparatórios e **não estão ligados ao runtime**.

## O que o código já prepara

- Lalamove: requisições HMAC-SHA256 para a API v3 do Brasil, cotação com duas paradas geocodificadas, bloqueio de cotação vencida e pedido com `isPODEnabled: true`. A API genérica de entregas ainda não contém endereços e contatos consentidos suficientes para criar o pedido real.
- Preparação de cotação: `lalamoveQuoteReadiness` aceita somente duas paradas de BH com autorização específica `FC-DELIVERY-QUOTE-1` de comprador e vendedor vinculada à mesma transação, não revogada e referente ao endereço atual, além de coordenadas verificadas. Falha fechada e não envia dados ao fornecedor. A migração `058_delivery_quote_consent_foundation.sql` prepara apenas o armazenamento dessa decisão, sem rota pública ou coleta ativa. O compartilhamento atual `FC-ADDRESS-1` é para o entregador e acontece depois da atribuição; não autoriza cotação externa. A cotação anterior ao pedido exige aprovação do novo aviso/aceite, persistência de coordenadas e revisão de privacidade.
- Asaas: validação do cabeçalho nativo `asaas-access-token` e do envelope mínimo de evento. A rota financeira atual usa outro esquema de assinatura e **não deve receber webhooks Asaas diretamente**. Evento recebido ainda não é pagamento conciliado.
- Conciliação simulada: `asaasEscrowReadiness` exige uma cobrança Asaas única e paga, garantia ativa vinculada à mesma referência, prazo futuro, entrega, aprovação e prova validada. Duplicidade, disputa, estorno, ausência de prova e garantia vencida bloqueiam a simulação. O resultado sempre mantém `payoutAllowed: false`.
- Decisões 1A/2A/3A aprovadas em 2026-10-20: `pilotQuotePresentation` não mostra preço e não permite cotação antes das duas autorizações; `deliveryExceptionReview` exige suporte para cancelamento, ausência de destinatário, falha ou prova contestada e proíbe encerramento automático; `asaasEscrowReadiness` exige consulta recente tanto do pagamento quanto da garantia (até cinco minutos) para uma elegibilidade apenas simulada. O repasse real exigirá conferência atômica imediatamente antes da chamada de liberação.
- As regras internas preservam a exigência de pagamento confirmado antes do contato e de entrega, aprovação do recebedor e validação da prova antes de qualquer repasse. O repasse real continua desabilitado.

## Fechamento técnico local pendente

1. Definir, com a modalidade Asaas homologada, quem emite cada cobrança e qual conta recebe cada parcela; obter identificadores de cliente e carteira sem expor credenciais. Resolver a taxa do processador antes de codificar split, porque o percentual Asaas incide no valor líquido. Para os 8% da venda, 2,5% por parte na troca e 5% do frete, simular valores pequenos e arredondamentos em centavos.
2. Construir o conector nativo de cobrança, consulta, estorno e conciliação. Após timeout, consultar a referência antes de repetir: a chave de idempotência interna, sozinha, não prova que o Asaas deixou de criar uma cobrança.
3. Criar rota separada para eventos Asaas, validar token, deduplicar ID e consultar a cobrança no provedor antes de mudar o estado financeiro. Cobrir eventos fora de ordem, valor divergente, chargeback e estorno.
4. Configurar Conta Escrow por subconta antes de receber valores. Registrar garantia, prazo e estado por pagamento. Liberar manualmente apenas depois da aprovação, prova validada e ausência de disputa; exigir reconciliação antes e depois da liberação. **Expiração automática da garantia não pode preceder o fechamento da entrega/disputa.**
5. Completar o fluxo de endereços compartilhados com consentimento, geocodificação e contatos mínimos para cotação Lalamove. Persistir preço, moeda, validade e rota antes de cobrar frete. Criar pedido somente com cotação válida; mapear pedido, cancelamento, falha, webhook e prova nativa para os estados internos sem concluir transação apenas pelo status do motorista.
6. Tratar a troca como duas pernas logísticas e cobranças próprias, com uma obrigação financeira por parte; manter frete e diferença desligados até o modelo de recebedores e taxas estar aprovado. Não prometer seguro antes de contrato.
7. Executar testes com fixtures de timeout, repetição, atraso, inversão de eventos, preço vencido, entrega cancelada, prova ausente, estorno e disputa. Repetir HTTP/PostgreSQL e CI após a ligação dos conectores.

## Portões externos para o último item

| Fornecedor | Confirmação ou material necessário | Critério de saída |
| --- | --- | --- |
| Asaas | CNPJ e enquadramento do marketplace; possibilidade regulatória de subcontas para vendedores; sandbox; cobrança por Pix/cartão; tarifa por modalidade; custo e prazo da Conta Escrow; webhooks; estorno, disputa e exportação | Fluxo de venda, troca, cancelamento e repasse aprovado em sandbox com valores reconciliados; prazo de garantia compatível com atrasos e disputas |
| Lalamove | Conta de sandbox e produção; CEPs do piloto; tipo de veículo; cotação de rotas reais; saldo/custo; acesso à prova por API; webhook, cancelamento, suporte e proteção dos dados compartilhados | Cotação e pedido em sandbox; prova acessível; rota de BH válida; duas pernas de troca e falhas observadas |
| FraldaCycle | Responsáveis financeiro e operacional; política de prazo, disputa e exceção; revisão jurídica/LGPD e orçamento | Aprovação registrada; segredos apenas no cofre; ativação gradual e rollback ensaiados |

Fontes: [Asaas — subcontas](https://docs.asaas.com/docs/criacao-de-subcontas), [Asaas — split e Escrow](https://docs.asaas.com/docs/split-para-contas-com-conta-escrow), [Asaas — recebimento de webhooks](https://docs.asaas.com/docs/receive-asaas-events-at-your-webhook-endpoint), [Lalamove — API v3](https://developers.lalamove.com/).

## Verificação local

Em 2026-10-19, os testes unitários dos dois componentes nativos e o validador da seleção passaram. A suíte ampliada que inclui rotas HTTP não concluiu neste executor: `listen EPERM` ao abrir `127.0.0.1`; a tentativa com permissão adicional foi interrompida. Portanto, não há evidência de teste HTTP ou integração com sandbox real nesta rodada.
