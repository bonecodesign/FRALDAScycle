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

## Tela administrativa de revisão do comprovante

O painel de logística permite consultar uma entrega pelo UUID, visualizar a foto privada e registrar justificativa e confirmação de conferência. O envio permanece bloqueado sem foto carregada, com URL expirada, sem sessão administrativa ou após mudança da entrega consultada. Aprovação do recebedor e validação são mostradas como decisões independentes; nenhuma libera repasse.

`GET /v1/shipments/:id/proof/photo` verifica acesso pela mesma regra do comprovante e solicita leitura assinada ao fornecedor de mídia (`signed-read`, validade máxima de 300 segundos). Resposta sem cache; imagem sem Referer. Fornecedor não configurado ou resposta inválida impedem a visualização. Não são criados endereços públicos a partir da chave de mídia. O contrato precisa de homologação com o fornecedor real.

Testes cobrem controle de revisão, falha/expiração da foto, troca de entrega, permissão e adaptador com respostas sintéticas. Navegador real, PostgreSQL real e fornecedor real continuam pendentes. Somente platform/; item 12 em standby, sem repasses, lançamento ou desktop.

## Consulta das pendências de repasse ao vendedor

`GET /v1/shipments/:id/settlement-status` apresenta uma consulta restrita e auditada para venda com comprovante. Exige entrega registrada, transação em `in_delivery`, exatamente um pagamento pago, valor coerente/referência externa, ausência de pagamento em disputa/reembolsado ou cobrança pendente, ausência de ocorrência financeira não rejeitada e ambas as decisões. Dados ausentes bloqueiam o resultado. Casos falhos, aprovados ou concluídos não são presumidos como liberação financeira; ainda exigem fluxo de resolução/homologação.

O prazo alvo é de 72 horas após a última das duas decisões; é mostrado mesmo com bloqueios para preservar a referência, sem garantir o prazo externo nem reiniciá-lo por disputa. Silêncio e vencimento não autorizam transferência. O painel administrativo traduz as pendências, informa o prazo alvo sujeito ao fornecedor e identifica que a integração de repasse continua pendente.

Consulta não executa nem autoriza repasse: `payoutAllowed` permanece falso. A integração futura precisará revalidar os requisitos de forma atômica; este resultado pode ficar desatualizado após nova ocorrência. Não implementa repasse do entregador, troca ou doação.

Eventos de logística não sobrescrevem disputa, reembolso ou estado final de transação. Eventos financeiros tardios de autorização/falha não regridem pagamento pago; eventos de pagamento não reabrem disputa/reembolso nem retornam uma entrega a `paid`. O encerramento formal das ocorrências continua pendente.

Validação com banco simulado, contratos e HTTP local; banco e fornecedores reais ainda pendentes. Item 12 em standby, sem transferência, contratação, lançamento ou desktop.

## Cancelamento e suporte implementados sem contratação

- Cancelamento direto somente antes da coleta, sem endereço compartilhado e sem intenção de pagamento registrada. Histórico de coleta e comprovantes também bloqueiam o cancelamento, mesmo se o estado atual da entrega tiver mudado. Bloqueios retornam `cancellation_requires_support`, sem cancelar, republicar produto ou prometer reembolso.
- Migração 020 adiciona `transactions.address_shared_at` como requisito para a futura liberação real do endereço. Nenhum endereço é liberado neste lote; esse fluxo deverá gravar o marcador atomicamente antes de conceder acesso. A regra de endereço não está integralmente implementada.
- Nova cobrança revalida e bloqueia a transação no banco antes de persistir a intenção, evitando cobrar uma operação cancelada entre a consulta inicial e a gravação.
- Suporte dentro da plataforma: criação com protocolo `FC-S-<número>`, lista e detalhes privados, histórico de respostas administrativas, estado e auditoria. Chaves de idempotência reutilizam pedido apenas para o titular. Pedidos ligados a operação exigem participação nela; somente administrador autorizado responde/altera estado.
- Telas: formulário e acompanhamento em Ajuda do aplicativo; consulta e resposta em Operações do admin. Cancelamento bloqueado direciona o formulário para atendimento. Encerrar atendimento não cancela operação nem executa reembolso. Pedidos de cancelamento/problema de recebimento em aberto também bloqueiam a consulta de requisitos do vendedor.
- E-mail e horários do suporte aparecem como pendentes de definição, sem divulgar endereço ou prazo não aprovado. Canal externo por e-mail permanece pendente; não foi contratado nem enviado e-mail.

Endpoints locais: `GET/POST /v1/support/tickets`, `GET /v1/support/tickets/:id`, `POST /v1/support/tickets/:id/reply` e rota de cancelamento existente. Sem fornecedor externo ou contratação. Testes com banco simulado e HTTP local; migrações em PostgreSQL e navegação em navegador real permanecem pendentes de homologação. Cancelamento com devolução financeira ainda depende de reembolso homologado; item 12 em standby. Somente platform/, sem desktop, credenciais ou lançamento.

## Cadastro manual e compartilhamento privado de endereço (venda)

O aplicativo cadastra e consulta endereços próprios sem geocodificação externa. Na venda com pagamento confirmado, o titular escolhe seu endereço e aceita o aviso `FC-ADDRESS-1`: após compartilhar, cancelamentos seguem pelo suporte. A migração 021 registra destinatário, versão do aviso, horário e cópia imutável dos dados do endereço; a mesma transação grava `address_shared_at`, ativando o bloqueio de cancelamento do lote anterior. Auditoria não copia o endereço completo.

- Entrega: somente entregador atualmente atribuído pode receber os endereços das partes; outro participante não ganha acesso pelo fato de comprar/vender. Sem entregador definido, compartilhamento permanece bloqueado.
- Retirada: somente o endereço de coleta do vendedor é compartilhado com o comprador. O endereço do comprador não é liberado ao vendedor.
- Consulta: titular acessa seus registros; destinatário acessa somente durante a execução e enquanto ainda responsável pela entrega/retirada. Não há acesso administrativo irrestrito. Respostas privadas sem cache e leituras auditadas.
- Aceite explícito, endereço próprio, pagamento confirmado, operação permitida e ausência de ocorrência financeira são verificados. Troca/doação, coleta já realizada e operações disputadas não permitem nova liberação neste lote.
- Repetição preserva o registro; mudança de endereço já liberado exige suporte. Alteração administrativa, retenção/exclusão dos registros e fluxo de troca/doação permanecem pendentes. O novo cadastro manual não é validação postal nem geográfica; não representa homologação do piloto.

Endpoints: `GET/POST /v1/addresses`, `GET/POST /v1/shipments/:id/addresses`. Sem contratar ou chamar geocodificador, entregador ou fornecedor de mensagens. Testes sintéticos de serviço/repositório e HTTP; PostgreSQL real, navegador real e revisão dos prazos de retenção ainda pendentes. Somente platform/, item 12 em standby, sem desktop ou lançamento.

## Preferências promocionais e estrutura de aceite dos termos

Preferências de publicidade são reais, individuais e separadas para e-mail, SMS e push. Sem registro, todos os canais começam desmarcados. A conta pode salvar ou revogar as escolhas; evento histórico e auditoria são gravados junto com o estado atual. Recusa não bloqueia uso da plataforma e não interfere nos avisos de verificação/recuperação da conta. Nenhuma campanha ou mecanismo de envio promocional foi ativado.

O aplicativo substitui a simulação da tela de preferências por carregamento e gravação pela API. Essa tela cuida de publicidade; preferências opcionais de avisos operacionais/horário silencioso ainda não foram implementadas. Conteúdo dos termos é consultável com versão e hash SHA-256 calculado sobre os dois documentos. O material existente permanece em rascunho pré-operacional e o backend bloqueia qualquer aceite até ativação profissionalmente revisada em mudança separada.

Migração 022 prepara aceite por conta/versão/hash, cópia dos documentos, data/hora do banco e auditoria, sem alterar escolhas promocionais. Repetição conserva o registro original. A gravação foi testada somente com catálogo ativo sintético injetado em testes; nenhum termo real entrou em vigor, nenhum cadastro foi condicionado ao rascunho e não houve aceite automático. Histórico privado preserva as versões registradas.

Endpoints autenticados sem cache: `GET/PUT /v1/account/marketing-preferences`, `GET /v1/account/terms`, `GET /v1/account/terms/history`, `POST /v1/account/terms/accept`. CORS passa a permitir PUT. Imagem da API inclui os contratos e documentos necessários ao runtime. Sem cookies de publicidade, dados de crianças, campanhas, contratação ou mensagens externas. Banco/navegador reais, revisão/ativação dos termos e integração promocional continuam pendentes. Somente platform/, item 12 em standby, sem desktop ou lançamento.
