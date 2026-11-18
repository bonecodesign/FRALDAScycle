# FraldaCycle — homologação Supabase BR isolada (18/11/2026)

## Escopo e evidência observada

- **Organização:** FraldasCycle `obbaxelloyedifekgrjc`.
- **Ambiente BR:** [FRALDAScycle-BR](https://supabase.com/dashboard/project/urbrtnenrsjvgqjhfhdj), projeto `urbrtnenrsjvgqjhfhdj`, **sa-east-1 (São Paulo)**, PostgreSQL 17, status `ACTIVE_HEALTHY` consultado por conector.
- **Custo cotado pelo provedor no momento da criação:** **US$ 0/mês**. Não é promessa sobre uso futuro ou limites do plano.
- **Ambiente anterior:** [FRALDAScycle Oregon](https://supabase.com/dashboard/project/yemedhhkuwmrojaiukyv), `us-west-2`, colocação em pausa solicitada para respeitar o limite gratuito de dois projetos ativos. **Não excluído.** Sua migração administrativa isolada era `fraldacycle_restrict_public_rls_event_trigger`; não havia tabelas de negócio, usuários, buckets, objetos ou Edge Functions. Não houve migração de registros pessoais/infantis.
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
5. Gatilho `fraldacycle_enforce_public_rls` habilitado (`evtenabled='O'`); advisors de segurança **0 avisos**.
6. Prova isolada, inédita neste ambiente: criar `public.fr_brazil_temporary_rls_probe`, afirmar `relrowsecurity=true` e derrubar tabela dentro da mesma operação. **Passou**, sem dados reais.
7. Não havia migrações de aplicação, contas ou buckets antes desta configuração. **Não** se pode inferir que 167 migrações da aplicação foram executadas.

## Portões ainda bloqueados — nenhuma promoção artificial

- **Aplicação:** as **167 migrações SQL** em `platform/database/migrations/` continuam versionadas no GitHub, **não aplicadas** ao banco hospedado. O migrador proprietário `platform/database/migrate.js` usa `public.schema_migrations` com checksums; não substituir seu histórico por registros genéricos do painel Supabase. A aplicação somente poderá utilizar o banco BR após conexão direta segura/TLS via cofre, execução ordenada do migrador, teste de repetição/checksums, acesso de backend e backup/restauração com evidência. Não gravar credenciais em Git, CI, chat ou logs.
- **Configuração de rede:** verificar no painel que Data API e serviços desnecessários estão desativados, sem presumir que revogar privilégios desliga a API administrativamente. TLS e políticas de conexões ainda pendentes de teste de cliente.
- **Conformidade:** revisão do local de processamento e suboperadores (região agora SP), privacidade de perfis infantis, política de retenção, disponibilidade, limites do plano gratuito e portabilidade.
- **Fornecedores:** armazenamento de mídia com OCR, antimalware, exclusão EXIF, revisão independente e signed URLs; PSP, logística e notificações seguem bloqueados.
- **Condição de lançamento:** matriz oficial **48/70** e preflight BH **16/21**, com **NO-GO** inalterado. Nenhuma contratação, produção, pagamento, dado real ou publicação foi autorizada por este pacote.

## Próximo passo sem retrabalho

1. Confirmar pausa final do Oregon e manutenção exclusiva do BR.
2. Revisar conexão segregada e ambiente de homologação sem segredos no repositório.
3. Executar **uma vez** as migrações ordenadas via migrador já existente, com análise dos 167 SQLs e plano de rollback/restore, nunca aplicar em lote como SQL solto pela Data API.
4. Testar no BR apenas lacunas efetivas não comprovadas pelo CI: segurança de grants/RLS, restauração e diferença de comportamento do Postgres gerenciado.
5. Registrar evidências individuais na matriz **sem** promover requisitos que exigem fornecedor/parecer humano.

**Regra:** este documento descreve preparação de ambiente. Não equivale a homologação do aplicativo, a decisão de GO ou a revisão jurídica.
