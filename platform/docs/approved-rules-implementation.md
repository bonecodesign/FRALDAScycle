# Implementação das decisões aprovadas — lote financeiro

Referência: itens 1–70 consolidados no PR #62. Este lote parte do PR #60 e não declara o piloto aprovado.

## Implementado neste lote

- Publicação: preço em reais validado, persistido no rascunho, recuperado ao voltar à etapa e enviado em centavos. Removido preço fixo de R$ 42. Revisão mostra preço, comissão de 8% e líquido antes da tarifa do processador. Rascunho antigo sem preço não publica até corrigir a etapa 5.
- Venda: 8% descontados do vendedor; nenhuma comissão logística sobre o produto. Pagamento aceita `initiated`, estado criado pelo marketplace, ou `payment_pending`.
- Contrato de cálculo: 2,5% por participante sobre pacote oferecido e 5% sobre frete descontados do entregador, com centavos inteiros, arredondamento e rejeição de valores inválidos. Estes dois cálculos ainda não estão conectados ao checkout externo.
- Pagamento de troca, doação/frete ou venda com entrega solicitada falha explicitamente antes de persistir/enviar cobrança. O adaptador atual não representa recebedores independentes; não usar seu split legado para simular a operação aprovada.

## Dependências e próximos lotes

| Frente | Trabalho ainda necessário |
| --- | --- |
| Checkout e split | Recebedores/contas do fornecedor, duas partes da troca, diferença fixa, frete separado, processamento do produto conforme oferta e decisão do item 12 |
| Repasse | Aprovação obrigatória do recebedor, comprovante validado, disputas e prazo homologado; sem liberação por silêncio |
| Premium | Renovação, 3 dias de regularização, pausa de excedentes e escolha de 3 anúncios |
| Entrega/endereço | Confirmação de compartilhamento, cancelamento direto bloqueado após endereço/coleta, encaminhamento ao suporte |
| Moderação/contatos | Aplicar regras a avaliações, chat, títulos, descrições e fotos, com revisão e contestação |
| Privacidade/termos | Preferências separadas, canais e aceites versionados; dados de crianças continuam pendentes de revisão antes de implementar |
| Administração/operação | Dois fatores, revogação, auditoria, incidentes, recuperação e controles do piloto |

Tarifas desconhecidas não são inventadas nem configuradas como zero. Item 12 permanece em standby. Não há ativação de credenciais, serviços pagos ou lançamento.

Validação deste lote: `npm run release:check-local`, 182 testes aprovados e 83 verificações de regressão. Navegação com navegador real permanece pendente pelo bloqueio registrado no piloto. Evidências históricas do piloto não foram reescritas como aprovação; repetir a jornada depois da correção.

Somente `platform/`; desktop e protótipo raiz preservados.

## Lote de proteção da confirmação do recebimento

- O envio do comprovante pelo entregador registra a entrega, mas mantém a transação em `in_delivery`. Foto e webhook não constituem aprovação do recebedor.
- Comprovantes só são aceitos após coleta/trânsito ou entrega registrada; estados anteriores, falhos e cancelados são rejeitados.
- A rota legada de conclusão fica explicitamente indisponível (503), inclusive ao vendedor, até persistir aprovação do recebedor, validação independente do comprovante e verificação de disputas. O suporte acompanha a pendência; não há conclusão automática por silêncio.
- Este lote é uma proteção parcial dos itens 13–20, não a implementação integral: telas de aprovação, validação administrativa, auditoria das duas decisões, troca com duas entregas e repasses em até três dias continuam pendentes. Nenhum repasse foi ativado.

PR encadeado sobre #63. Item 12 permanece em standby; somente `platform/`.

## Lote de registro das decisões de recebimento (venda)

- Migração 019 adiciona registros separados e únicos por comprovante para aprovação do comprador e validação administrativa, com data/hora do banco. Repetição conserva a decisão original e não duplica auditoria.
- `POST /v1/shipments/:id/receipt`: exige `approved: true`, comprador da entrega, comprovante enviado, entrega registrada e transação em andamento.
- `POST /v1/shipments/:id/proof/validate`: exige administrador autorizado, `validated: true` e justificativa de 10–1000 caracteres. Comprador, vendedor e entregador da operação não podem validar seu próprio comprovante.
- `GET /v1/shipments/:id/proof`: metadados restritos às partes, entregador e administrador autorizado; consulta e decisões auditadas. A chave de mídia não é um endereço público.
- Botão de confirmação do aplicativo grava a aprovação pela API e apresenta erros reais; mensagem do entregador informa envio de comprovante, sem afirmar aprovação do recebedor.
- A rota legada de conclusão continua bloqueada. As decisões não concluem transações, não verificam elegibilidade financeira e não acionam repasse. Disputas, prazo de três dias, pagamento externo, trocas com duas entregas e confirmação institucional continuam pendentes. Dados de crianças e item 12 preservam suas pendências.

Validação: testes de serviço/repositório com banco simulado e HTTP local; verificação completa de release. Migração em PostgreSQL real, telas administrativas e navegação em navegador real ainda não homologadas. Sem alteração de migrações antigas, protótipo ou desktop.
