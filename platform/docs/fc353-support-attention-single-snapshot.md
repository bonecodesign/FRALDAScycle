# FC-353 — Fila de atenção do suporte com contadores consistentes

**Projeto único:** FraldaCycle (`bonecodesign/FRALDAScycle`). **Data:** 23/11/2026. **Escopo:** leitura interna; nenhuma operação comercial ou execução externa.

## Lacuna identificada sem repetir FC-322/FC-323

A fila `GET /v1/support/attention` e a prévia `GET /v1/support/escalation-preview` já existem, com autenticação, RBAC e proibição de envio. A consulta ao PostgreSQL, porém, buscava até 50 tickets vencidos em uma chamada e os totais em **outra**. Uma resposta humana, reclassificação ou mudança de estado entre as consultas poderia fazer com que o número agregado fosse inferior à quantidade de itens da página — ou que os totais não representassem o mesmo instante dos registros exibidos. A prévia valida essas contagens e poderia falhar pela divergência.

## Alteração restrita ao FraldaCycle

`database/operation-support-repository.js` agora usa **um único SELECT PostgreSQL**, com `count(*) OVER()` e `count(*) FILTER (...) OVER()`. A janela conta a fila toda antes de aplicar `LIMIT`, mantendo os contadores da mesma leitura (snapshot) dos tickets da página. Não existe transação de escrita, atualização de ticket, envio ou pausa. Os campos de contagem são retirados de cada item antes de montar a resposta, preservando a interface existente.

A consulta sem tickets retorna `items=[]`, `overdue_total=0` e `critical_overdue=0`; quando há mais de 50 tickets, o total não se reduz ao tamanho da página. A prévia continua indicando falta de cobertura humana e exigindo decisão real mesmo com pessoas tecnicamente elegíveis.

## Verificação e limites

Novo teste isolado: `tests/support-attention-single-snapshot.test.mjs` valida chamada única ao banco, natureza somente leitura do SQL, contagem total maior que o limite paginado, manutenção do shape público da fila, segurança da prévia e resposta vazia. A suíte HTTP/PostgreSQL preexistente `tests/support-operations-http-postgres.test.mjs` continua provando a integração real contra banco descartável no CI. Só considerar integrado após CI completo aprovado na SHA da PR.

**Não altera:** prioridades FC-322, governança FC-324, cadastros institucionais, canais, escalas, disponibilidade de equipe, contratação, Supabase-BR, Dropbox ou eventuais autorizações de produção. OPS-01 a OPS-07, requisitos 49/51/56/67 e a homologação humana permanecem pendentes. Matriz oficial **48/70 (68,57%)**, piloto BH **NO-GO**.

Referência de acompanhamento: [issue #231](https://github.com/bonecodesign/FRALDAScycle/issues/231).
