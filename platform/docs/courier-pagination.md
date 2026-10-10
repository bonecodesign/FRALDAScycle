# Paginação das entregas e do histórico

As consultas `/v1/courier/shipments` e `/v1/courier/history` aceitam page a partir de 1 e retornam items, page e hasMore. Cada página contém até 50 registros. A consulta busca 51 para identificar a próxima página; identidade vem da sessão, offset/limit usam parâmetros SQL e páginas inválidas recebem 400 antes da consulta. Limite defensivo: página 100000.

Anterior/Próxima usam a página atual. Atualizar volta à primeira página. Selecionar revalida a atribuição na página exibida, sem trocar a operação ativa ao navegar entre páginas. Botões ficam bloqueados durante a consulta; nova página só é confirmada após resposta válida. Falhas não deixam cartões antigos selecionáveis.

Ordenação: entregas ativas por created_at/id decrescentes; histórico por updated_at/id decrescentes. Os dados são atuais, não um snapshot: operações novas ou mudanças de estado podem deslocar registros entre páginas. Atualizar reinicia a consulta. Não promete paginação sem repetição/omissão sob alterações concorrentes.

Validação local: 16 testes de consulta/HTTP/interface/beta integrada, um teste adicional PostgreSQL e 29 contratos/consulta aprovados. PostgreSQL isolado verifica 60 registros ativos e 60 históricos (páginas 50 + 10, terceira vazia), metadados de continuação e isolamento de outra conta. Esse teste usa uma tabela simplificada; a beta integrada verifica separadamente o esquema migrado real e a jornada no Chromium. Interface cobre avançar, voltar, reiniciar e selecionar na segunda página. HTTP cobre página inválida, sessão e no-store. Sintaxe dos 122 arquivos e diff aprovados.

Comandos: `node --test tests/courier-dashboard.test.mjs tests/courier-dashboard-ui.test.mjs tests/postgres-beta.test.mjs`; `node --test tests/courier-pagination-postgres.test.mjs`.

Mantém as restrições de dados privados e não ativa operação, repasse ou produção. Foto/coordenadas e entrega da beta são sintéticas. Homologação humana e fornecedores permanecem pendentes.
