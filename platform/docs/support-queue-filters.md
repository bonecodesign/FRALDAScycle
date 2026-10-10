# Filtros da fila de suporte

As filas de `/admin/operations` e `/admin/launch` permitem filtrar por estado e categoria. Cada mudança consulta a página inicial; paginação e atualização preservam a seleção vigente. Resultados vazios explicam que nenhum protocolo corresponde aos filtros.

A API aceita apenas os três estados persistidos e as cinco categorias conhecidas. Quando solicitados por uma conta sem escopo `admin:support:write`, filtros de fila retornam 403. O banco aplica ambos dentro da consulta parametrizada, junto com o limite de visibilidade por solicitante/administrador. Auditoria registra os filtros da listagem.

## Validação

- 38 testes de interface, contrato e HTTP passaram; cobrem validação dos filtros, bloqueio sem escopo, paginação após seleção e preservação da consulta.
- PostgreSQL com o esquema completo confirmou combinações de estado/categoria e contagens reais.
- A beta PostgreSQL/Chromium abriu a fila administrativa, aplicou estado e categoria, localizou o protocolo filtrado e respondeu por teclado.
- As interfaces permaneceram sem overflow nas quatro larguras verificadas pela beta. Sintaxe: 127 arquivos; verificações do protótipo: 83/83.

A busca por texto, atribuição a atendentes e SLA ainda não fazem parte desta etapa. A prontidão para ativação real não muda.
