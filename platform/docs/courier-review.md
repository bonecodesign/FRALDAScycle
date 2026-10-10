# Revisão da jornada do entregador

Escopo: consultas de entregas e histórico, seleção, coleta, comprovante e validações do PR #88.

A revisão conferiu identidade obtida da sessão, filtro courier_id, estados operacionais, limites de consulta, projeção mínima sem contatos/endereços/valores, no-store, autorização de coleta/prova no backend e preservação da seleção/foto em respostas antigas. Os controles de atribuição e idempotência do backend permanecem aplicados; não autoriza ativação real.

Correções:

- A interface usava acesso direto ao objeto de estados; respostas com constructor, toString ou __proto__ podiam passar pela validação. Agora aceita somente propriedades próprias do mapa, tanto ao carregar quanto ao revalidar a seleção. Testes cobrem as três respostas inválidas, sem cartões ou navegação.
- A lista explícita de checagem de sintaxe não incluía courier.js, courier-dashboard.js e auth-browser-check.mjs. Os três arquivos foram incluídos; 122 arquivos aprovados.
- A falha de geolocalização sempre orientava conceder permissão. Tempo esgotado e posição indisponível agora explicam o motivo e permitem nova tentativa, preservando a foto.

Continuação: histórico exibe modalidade persistida e data de atualização no formato pt-BR e fuso do navegador. Estado entregue não significa aprovação ou repasse. Dados ausentes/inválidos aparecem como não informados, sem inventar data ou modalidade.

Validação local: 25 testes selecionados aprovados, sem skips, incluindo consultas/HTTP, interfaces de lista/histórico/coleta/prova e beta real Chromium/API/PostgreSQL. A beta percorre lista → coleta → comprovante → histórico e verifica lista, prova e histórico em quatro larguras sem overflow. Sintaxe dos 122 arquivos e diff aprovados.

Comando: `node --test tests/courier-dashboard-ui.test.mjs tests/courier-dashboard.test.mjs tests/courier-proof-ui.test.mjs tests/collection-ui.test.mjs tests/postgres-beta.test.mjs`.

Limites preservados: foto e coordenadas sintéticas, ausência de fornecedor/entrega física, repasse indisponível, paginação limitada às 50 recentes e homologação humana pendente. A revisão e os testes automatizados não equivalem à homologação de produção.
