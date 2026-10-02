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
