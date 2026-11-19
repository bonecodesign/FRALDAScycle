# FC-325 — Evidência reproduzível de pré-ativação do suporte no Supabase BR

**Data da coleta:** 19/11/2026, 19:34:22 UTC (16:34:22 BRT). **Escopo:** homologação isolada, somente leitura, sem produção. **Piloto BH:** NO-GO.

## Identidade do ambiente (não confundir os projetos)

- **Ambiente de homologação válido:** [FRALDAScycle-BR](https://supabase.com/dashboard/project/urbrtnenrsjvgqjhfhdj), id `urbrtnenrsjvgqjhfhdj`, região `sa-east-1` (São Paulo), PostgreSQL 17, `ACTIVE_HEALTHY` na consulta de 19/11.
- **Outro ambiente:** [FRALDAScycle](https://supabase.com/dashboard/project/yemedhhkuwmrojaiukyv), id `yemedhhkuwmrojaiukyv`, região `us-west-2`, `INACTIVE`. Não foi reativado, usado ou removido.
- **Fonte de código:** `bonecodesign/FRALDAScycle`, `main` após PRs [#322](https://github.com/bonecodesign/FRALDAScycle/pull/322), [#323](https://github.com/bonecodesign/FRALDAScycle/pull/323) e [#324](https://github.com/bonecodesign/FRALDAScycle/pull/324). Todos integrados. O run `44594115365` do PR #324 concluiu `foundation`, `wallet-postgres`, `listing-postgres`, `containers` e `browser-postgres` com sucesso no SHA `49de0b800d4f3586b0ecc871e71f4a90e1780b4b`.

## Consulta executada de verdade

O arquivo [`infra/supabase/support-duty-hosted-preactivation-readonly.sql`](../infra/supabase/support-duty-hosted-preactivation-readonly.sql) foi executado pelo conector Supabase **somente no projeto BR**, sem comandos de escrita. Devolveu `PASS_PREACTIVATION_ONLY`.

| Controle verificado por SQL direto | Resultado observado |
| --- | --- |
| Checkpoints de migrações em `public.schema_migrations` | 170 registros, 170 nomes distintos, 170 checksums com 64 caracteres |
| Migrações de suporte `173`, `174`, `175` | presentes uma vez cada, nesta ordem histórica |
| Tabelas físicas em `public` / RLS | 166 / 166 habilitado |
| Tabelas com privilégios de DML/SELECT para `anon` / `authenticated` | 0 / 0 |
| `public` sem USAGE/CREATE público; schema privado sem USAGE por `anon` | comprovado |
| Event trigger `fraldacycle_enforce_public_rls` | ativo |
| Restrições de integridade da triagem e revogação | presentes |
| Índices únicos de papel/pessoa em nomeações e propostas | quatro presentes |
| Usuários, tickets, propostas, nomeações, anúncios, transações, intenções de pagamento, notificações | zero em cada tabela |

**Distinção obrigatória:** a consulta verifica os checkpoints e o comprimento dos hashes registrados, **não recalcula** os SHA-256 a partir dos arquivos locais nem prova idempotência do migrador Node em uma conexão TLS externa. A migração 175 **já estava aplicada** no BR antes deste pacote; não executar novamente.

## Advisors do Supabase BR (19/11)

- Segurança: `rls_enabled_no_policy` — 166 achados **INFO**. Compatível com backend próprio sem expor acesso via papéis públicos; **não** criar políticas de abertura para remover avisos. [Referência](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).
- Desempenho: `unindexed_foreign_keys` — 184 **INFO**; `unused_index` — 107 **INFO**. Medir carga e planos de execução antes de propor índices. [Referência](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys).
- Saúde: sem alertas apresentados.

## Limites: não é homologação completa

- O resultado é um **gate de banco inativo/sem dados**, não certifica privacidade, configuração administrativa de Data API, TLS de cliente, backups/restauração, RPO/RTO, rollback, CI integrado a banco remoto, capacidade humana, autenticação real ou rastreio de eventos.
- Exige **zero registros operacionais** deliberadamente. Após onboarding sintético autorizado, `NO_GO_REVIEW_REQUIRED` pode indicar atividade esperada; não apagar dados nem modificar o teste para obter PASS sem revisão.
- Não realizar nomeações, mensagens externas, plantões, contratação, cobranças, cadastros infantis ou release. Não salvar segredos em GitHub/chat/logs.
- Próximas evidências: teste externo de migração/checksum e TLS por backend autorizado; restore isolado comprovado; canais e pessoas reais escaladas; homologação Asaas/Lalamove e LGPD; prova de navegador/leitor de tela e dispositivos; GO/NO-GO humano.

**Matriz preservada:** 48/70 = **68,57%**; preflight do piloto BH **16/21**; produção e piloto **NO-GO**. Nenhum requisito foi promovido por esta consulta. O protótipo original permanece imutável.
