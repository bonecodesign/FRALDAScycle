# Doação institucional e coleta local no beta

Somente platform/. A doação parte de anúncio próprio já destinado a uma instituição. Doador confirma e assume frete/comissão logística; representante atualmente autorizado confirma separadamente. Snapshot da instituição/representante e avisos FC-DONATION-1 preservados. Transação tem produto de valor zero e estado donation_confirmed próprio, sem simular produto pago ou intenção financeira.

Retirada local exige ambas confirmações, instituição ativa e autoridade atual. Cria uma entrega, evento e auditoria, com logistics_payer_id do doador. Repetição concorrente conserva a entrega; não há pedido a transportadora/seguro/cobrança. Tarifa de processamento do frete não é atribuída: item 12 permanece standby. Entrega por fornecedor e preço/cobrança de logística dependem de homologação.

Doador escolhe endereço próprio, confirma FC-ADDRESS-1 e libera somente ao representante indicado para retirada. A gravação revalida autoridade sob trava institucional; revogação/suspensão impede nova consulta pelo representante. Original, revisões administrativas pelo suporte e marcador de cancelamento preservados. Troca ainda sem fluxo completo de endereços. Operações com autoridade alterada/instituição inativa seguem análise do suporte, sem substituir silenciosamente o recebedor ou apagar registros.

Somente entregador atribuído registra coleta, com confirmação FC-COLLECTION-1, verificação do estado/pagamento da venda ou confirmações/autoridade da doação e ausência de ocorrência. Evento é idempotente, inicia in_delivery e impede cancelamento direto. Também usado na validação de venda; não representa coleta física executada pelo teste.

Recebimento de doação exige representante atual autorizado e comprovante entregue. Validação administrativa é separada e independente das partes/entregador. Consulta distingue operacionalRequirementsMet (aprovação e validação) de requirementsMet financeiro; payoutAllowed=false sempre. Comprovante/foto e identidades usados nos testes são fixtures; leitura privada de mídia/validação humana real continuam pendentes. Nenhuma operação é finalizada financeiramente, nenhum repasse/reembolso é executado.

Instituição fora de active pausa anúncios de doação ainda sem operação, filtra consulta pública e bloqueia publicação/retomada sob trava. Não reativa anúncios automaticamente e não apaga operações já confirmadas. Cancelamento antes do endereço/coleta e sem pagamento pode preservar anúncio pausado se instituição/cota não permitir publicar; depois do endereço/coleta continua pelo suporte.

Tela Doações permite confirmar, acompanhar, registrar retirada, compartilhar/consultar endereço e aprovar recebimento. Entregador usa Registrar coleta da entrega atribuída. Sem chat de doação ou mensagem externa. Responsabilidade pela logística não inventa preço nem tarifa de processamento.

Local: cinco testes novos de consentimento/permissões/readiness, sintaxe 117 e diff aprovados. CI preparado para migração 030, concorrência/idempotência/isolamento/autoridade/revogação/endereço/coleta/aprovação/validação/pausa em PostgreSQL. Chrome preparado para doador, representante e entregador com teclado e quatro larguras; resultado aguardando CI. Não registrar dispositivo, teste humano, leitor de tela, pagamento, foto real ou entrega física como executados.

Matriz: 8/70 = 11,43%; doação/parcela logística e institucional continuam parciais pelas dependências financeiras, mídia/homologação e equipe. Produção bloqueada; termos reais rascunhos e dados de crianças não coletados. Troca aguarda definição documentada da seleção do segundo pacote, sem reintroduzir propostas ou supor uma decisão do fundador.
