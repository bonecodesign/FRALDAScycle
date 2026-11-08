# P-01 — Preflight de retenção de certidões legadas (08/11/2026)

**Situação:** preparo técnico para a PR de rascunho #215. A aprovação jurídica/privacidade, o provedor real e a homologação de exclusão externa continuam pendentes. **Não** declarar conformidade LGPD nem serviço ativado a partir desses testes.

## Risco identificado

A migração `150_courier_clearance_verification_retention.sql` anteriormente atualizava `delete_at` com um `UPDATE ... FROM courier_clearance_reviews` sem fixar qual decisão usar quando havia múltiplas revisões do mesmo documento. Também aceitava certidões marcadas como verificadas, rejeitadas ou expiradas sem decisão histórica com data confiável, preservando silenciosamente um prazo calculado pela validade do emissor.

## Critérios técnicos que foram adicionados

- **Decisão ausente** para cópia com status `verified`, `rejected` ou `expired`: a migração falha deliberadamente e é revertida por inteiro pela transação; precisa de investigação privada e deliberação de privacidade antes de qualquer correção histórica. Não inventar `verifiedAt` ou `decidedAt`.
- **Múltiplas decisões:** usar `MIN(decided_at)` sobre decisões aprovadas/rejeitadas com timestamp, evitando resultado dependente da linha escolhida pelo PostgreSQL.
- **Prazo anterior mais curto:** manter o menor entre o prazo já armazenado e a primeira decisão mais trinta dias. Não postergar a obrigação por uma revisão posterior.
- **Prazo vencido:** não mover o vencimento para o futuro. A tarefa `clearance_copy_delete` pode ser agendada pelo mecanismo existente, mas apenas armazenamento homologado com recibo real pode comprovar a exclusão.
- **Rejeição:** cópia rejeitada com data de revisão e `delete_at` originalmente nulo recebe o limite determinístico. Persistência da confirmação e remoção das referências continua coberta pela PR auxiliar #219.
- **Migrações antigas:** não modificar o conteúdo das migrações já existentes (inclusive a 060). A nova salvaguarda #217 na `main` requer numeração única.

## Evidências sintéticas e limites

Teste isolado com PostgreSQL temporário e dados inteiramente fictícios, `tests/courier-clearance-legacy-retention-postgres.test.mjs`: várias decisões, rejeição, decisão ausente, prazo já vencido e agendamento das obrigações. A ausência de decisão é tratada como **bloqueio da migração**, não como permissão para apagar documentos sem orientação. Não executar serviços de armazenamento nem eliminar arquivos reais neste procedimento.

O teste de purga transacional de P-01 está em `tests/courier-clearance-deletion-postgres.test.mjs`. A PR #215 continua em rascunho. Antes de qualquer integração com `main`, reconciliar o head com a `main` atual e repetir quatro jobs CI, além de análise jurídico-privacidade e testes de provedor real; não ativar o piloto BH (NO-GO).
