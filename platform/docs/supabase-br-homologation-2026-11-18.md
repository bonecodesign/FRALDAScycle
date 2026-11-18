# FraldaCycle — homologação Supabase BR isolada (18/11/2026)

## Escopo e evidência observada

- **Organização:** FraldasCycle `obbaxelloyedifekgrjc`.
- **Ambiente BR:** [FRALDAScycle-BR](https://supabase.com/dashboard/project/urbrtnenrsjvgqjhfhdj), projeto `urbrtnenrsjvgqjhfhdj`, **sa-east-1 (São Paulo)**, PostgreSQL 17, status `ACTIVE_HEALTHY` consultado por conector.
- **Custo cotado pelo provedor no momento da criação:** **US$ 0/mês**. Não é promessa sobre uso futuro ou limites do plano.
- **Ambiente anterior:** [FRALDAScycle Oregon](https://supabase.com/dashboard/project/yemedhhkuwmrojaiukyv), `us-west-2`, estado **INACTIVE (pausa confirmada)** para respeitar o limite gratuito de dois projetos ativos. **Não excluído.** Sua migração administrativa isolada era `fraldacycle_restrict_public_rls_event_trigger`; não havia tabelas de negócio, usuários, buckets, objetos ou Edge Functions. Não houve migração de registros pessoais/infantis.
- **Projeto Salva Motoca:** em outra organização/conta, não alterado.

## Fechamento concreto de segurança — infraestrutura BR

A observação prévia mostrou `public` sem tabelas e funções próprias e **permissões padrão de criação de objetos para `anon`/`authenticated`**. Isso seria inadequado para o FraldaCycle, cuja API de backend controla autenticação, autorização, MFA e dados infantis (sem usar Supabase Auth/Data API).

O arquivo versionado `infra/supabase/fraldacycle-br-homologation-security.sql` foi aplicado **somente ao novo projeto BR** como migração do Supabase `fraldacycle_br_homologation_security_baseline`, versão `20261118222221`.

Controles efetivamente aplicados:
- `anon` e `authenticated` sem USAGE do schema `public`; padrões de grants futuros de objetos criados por `postgres` restringidos.
- Schema administrativo `fraldacycle_internal` inacessível a papéis públicos.
- Gatilho `fraldacycle_enforce_public_rls` (ativo) habilita automaticamente RLS em futuras tabelas `public`, sem fornecer acesso a usuários de Data API.
- Função administrativa `SECURITY DEFINER` no schema **privado** e sem EXECUTE para `anon`/`authenticated`.

**Verificação observada (conector Supabase BR):**
1. `has_schema_privilege('anon','public','USAGE') = false`.
2. `has_schema_privilege('authenticated','public','USAGE') = false`.
3. `has_schema_privilege('postgres','public','CREATE') = true`.
4. `has_schema_privilege('anon','fraldacycle_internal','USAGE') = false`; `has_function_privilege('anon', ..., 'EXECUTE') = false`.
5. Gatilho `fraldacycle_enforce_public_rls` habilitado (`evtenabled='O'`); advisors de segurança **0 avisos antes da importação de tabelas**.
6. Prova isolada, inédita neste ambiente: criar `public.fr_brazil_temporary_rls_probe`, afirmar `relrowsecurity=true` e derrubar tabela dentro da mesma operação. **Passou**, sem dados reais.
7. Não havia migrações de aplicação, contas ou buckets antes desta configuração. A importação posterior das **167 migrações SQL** está comprovada na seção FC-318 abaixo.

## Portões ainda bloqueados — nenhuma promoção artificial

- **Aplicação:** as **167 migrações SQL** de `platform/database/migrations/` foram aplicadas, uma por transação, ao banco hospedado em ordem de filename do migrador, com nomes e checksums SHA-256 gravados em `public.schema_migrations`. A aplicação ainda **não** foi conectada via API ao banco; falta executar `platform/database/migrate.js` em conexão TLS de backend autorizada para verificar idempotência/checksums, configurar cofre e comprovar backup/restauração. Não gravar credenciais em Git, CI, chat ou logs.
- **Configuração de rede:** verificar no painel que Data API e serviços desnecessários estão desativados, sem presumir que revogar privilégios desliga a API administrativamente. TLS e políticas de conexões ainda pendentes de teste de cliente.
- **Conformidade:** revisão do local de processamento e suboperadores (região agora SP), privacidade de perfis infantis, política de retenção, disponibilidade, limites do plano gratuito e portabilidade.
- **Fornecedores:** armazenamento de mídia com OCR, antimalware, exclusão EXIF, revisão independente e signed URLs; PSP, logística e notificações seguem bloqueados.
- **Condição de lançamento:** matriz oficial **48/70** e preflight BH **16/21**, com **NO-GO** inalterado. Nenhuma contratação, produção, pagamento, dado real ou publicação foi autorizada por este pacote.

## Próximo passo sem retrabalho

1. O projeto Oregon está **INACTIVE**; preservar o projeto e acompanhar o plano gratuito.
2. Conectar **somente** a API de homologação ao PostgreSQL BR via TLS, conexão direta/pooler session e cofre externo; não adicionar secrets ao GitHub.
3. Executar o migrador original contra o banco já preparado **para verificação idempotente**, sem reexecutar DDL se os hashes coincidirem; validar a integração API/servidor.
4. Obter evidência independente de backup/restauração, RPO/RTO, segurança e rollback na infraestrutura hospedada, sem promover 57/59/67 antes da prova completa.
5. Investigar índices de chaves estrangeiras com perfil de carga real, evitando criar 177 índices automaticamente por alerta do linter; registrar a diferença na matriz **sem** promoção artificial.

**Regra:** este documento descreve preparação de ambiente. Não equivale a homologação do aplicativo, a decisão de GO ou a revisão jurídica.

## FC-318 — Aplicação real das migrações e segurança pós-esquema

**Origem fixada:** `bonecodesign/FRALDAScycle`, `main` `7b34af9156640eda084787cf5a050e67ebb3ba39`, `platform/database/migrations/`. Este commit era a versão vigente antes da abertura do PR FC-318. Não houve alteração do protótipo.

**Como a importação foi feita:** por conector Supabase, **um arquivo SQL por migração/uma transação por arquivo**, respeitando a ordem `localeCompare(...,'en')` do `platform/database/migrate.js`. A necessidade de separar transações foi confirmada por `ALTER TYPE ... ADD VALUE` nas migrações antigas. Em cada transação houve `pg_advisory_xact_lock(1180162025)` e inserção do nome + `SHA-256(UTF-8 SQL original)` na **mesma** tabela de checkpoint utilizada pela API: `public.schema_migrations`. O painel Supabase também registra suas próprias migrações; as duas tabelas cumprem funções distintas. Não rodamos o processo Node `platform/database/migrate.js` em conexão de servidor externo, pois não configuramos segredos nem conexão da API.

**Resultados observados no projeto BR:**

| Consulta | Resultado |
|---|---|
| `public.schema_migrations` | **167 arquivos**, **167 nomes únicos**, **167 checksums SHA-256 de 64 caracteres** |
| Prefixos legados 044 e 061 | **2 arquivos** por prefixo, preservados por nome completo |
| Tabelas da aplicação no schema `public`, incluindo checkpoint | **164**, todas **164 com RLS habilitado** |
| Tabelas `public` sem RLS | **0** |
| Tabelas `public` com privilégio SELECT para `anon` / `authenticated` | **0 / 0** |
| `USAGE` do schema `public` para `anon` / `authenticated` | **false / false** |
| Usuários da aplicação / anúncios / transações | **0 / 0 / 0** |
| Buckets de armazenamento | **0** |
| Status / região | **ACTIVE_HEALTHY**, **sa-east-1 (São Paulo)** |

**Correção de achado real:** após instalar o esquema, o Security Advisor identificou quatro funções `TRIGGER` em `public` com `search_path` mutável. Apliquei via migração Supabase `fraldacycle_br_post_migration_function_hardening` o SQL versionado em `infra/supabase/fraldacycle-br-post-migrations-function-hardening.sql`. As quatro funções são `SECURITY INVOKER` e agora usam `search_path=pg_catalog, public, pg_temp`, com `EXECUTE` revogado de `PUBLIC`, `anon` e `authenticated`. Consulta direta confirmou todos os quatro `anon_exec=false` e `auth_exec=false`. O Security Advisor deixou de apresentar o **WARN** de search path.

**Achados informativos, sem promoção artificial:**
- Security Advisor: `rls_enabled_no_policy` (**164** tabelas, nível INFO), esperado pelo modelo de **API própria e banco não exposto**. Não criar políticas abertas para silenciar o linter. <https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy>
- Performance Advisor: `unindexed_foreign_keys` (**177** referências, INFO); `unused_index` (**106** índices, INFO), esperado em grande parte em banco recém-criado e sem carga. Priorizar somente se medições/planos de consulta justificarem. <https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys> e <https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index>
- Health Advisor: **0** alertas.
- Sem teste de integração da API hospedada, restauração real, credenciais TLS rotacionadas, homologação de fornecedores, autenticação pública, atendimento humano ou uso de mídia. As funcionalidades de dados infantis continuam **inativas** e dependentes de aprovação jurídica.

**Situação da matriz:** **48/70 (68,57%)**, mantida; evidência adicional ao requisito 57 (backup/infraestrutura) e ao 59 (segredos/controles), mas **não satisfaz suas condições restantes**. Piloto BH **NO-GO**.
