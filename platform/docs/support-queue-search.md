# Busca na fila administrativa de suporte

As telas de operações e lançamento permitem buscar atendimentos por protocolo, assunto e descrição, combinando o termo com estado e categoria. A busca é submetida pela equipe administrativa e reinicia a paginação na primeira página. Cada página retorna no máximo 50 itens, mantendo a ordenação mais recente primeiro.

O servidor exige o escopo `admin:support:write` para aplicar os filtros administrativos e executa a busca no PostgreSQL com parâmetros. O termo é uma substring literal, sem curingas: `%` e `_` não alteram a interpretação da consulta. Termos acima de 100 caracteres e caracteres de controle são rejeitados. O acesso de clientes continua limitado aos próprios protocolos e não aceita estes filtros.

A consulta compara protocolo, assunto e descrição. Ela não pesquisa mensagens de resposta. A paginação limita o resultado, mas a busca ainda pode examinar registros da fila; um índice especializado para busca textual pode ser avaliado quando o volume real justificar essa otimização.

## Validação local

- Interface administrativa, contrato HTTP e autorização: testes de fila de suporte.
- PostgreSQL: termo contendo `%` e `_` encontra apenas a descrição literal correspondente.
- Navegador Chromium: submissão por teclado na tela administrativa, filtros combinados e consulta persistida no PostgreSQL; layouts de 320 a 1280 px sem overflow horizontal.

Essas evidências são de ensaio local com dados sintéticos. Não representam UAT humano, conexão de fornecedor nem ativação em produção.
