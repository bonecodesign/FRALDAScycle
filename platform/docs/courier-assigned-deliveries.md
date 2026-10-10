# Entregas ativas atribuídas ao entregador

A tela inicial consulta `GET /v1/courier/shipments`, com sessão autenticada e resposta `no-store`. Apenas contas de entregador ou administrador consultam a própria atribuição; a identidade vem da sessão, nunca de parâmetros do cliente. A consulta usa `courier_id`, estados assigned/picked_up/in_transit e limite de 50 registros mais recentes.

A resposta contém somente identificador, estado, modalidade, seguro e estimativa de entrega quando existente. Não contém endereços, contatos, participantes, referência de fornecedor ou valores de repasse. Não apresenta ganhos, prazo novo ou dados simulados.

Selecionar uma operação reconsulta a atribuição, usa o estado atualizado e encaminha à coleta ou ao comprovante. Foto de outra entrega é removida; uma resposta antiga não sobrescreve seleção alterada. Consulta e seleção bloqueiam repetição. Lista vazia, sessão expirada, erro ou resposta inválida não deixam cartões antigos selecionáveis.

Validação local: três testes de repositório/serviço/HTTP, três da interface e uma beta integrada com Chromium/API/PostgreSQL passaram (7/7). Os testes HTTP comprovam 401 sem sessão, 403 para cliente, identidade da sessão apesar de parâmetro de outra conta e no-store. A beta usa a lista real para selecionar a operação, abre coleta com identificador preenchido e continua ao comprovante. Os 24 contratos de fundação e sintaxe de produção também passaram. A validação de quatro larguras da lista está incluída no CI.

Comando: `node --test tests/courier-dashboard.test.mjs tests/courier-dashboard-ui.test.mjs tests/postgres-beta.test.mjs`.

Não consulta histórico ou ganhos, não lista oportunidades ainda sem atribuição e não atribui entregas automaticamente. Mais de 50 operações exige evolução da paginação. Foto e coordenadas da beta são sintéticas; fornecedores, câmera/GPS físicos, entrega presencial e homologação permanecem pendentes. Percentuais formais não mudaram; produção não foi ativada.
