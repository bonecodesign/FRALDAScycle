# FC-328 — Recuperação protegida: observação BR e bloqueios reais (20/11/2026)

## Identidade e execução

- Projeto exclusivo de homologação: [FRALDAScycle-BR](https://supabase.com/dashboard/project/urbrtnenrsjvgqjhfhdj), referência `urbrtnenrsjvgqjhfhdj`, `sa-east-1`; status `ACTIVE_HEALTHY` confirmado em 20/11/2026.
- A organização `obbaxelloyedifekgrjc` informou `plan=free` na consulta por conector em 20/11. O outro projeto `yemedhhkuwmrojaiukyv` não foi usado.
- A consulta versionada [`infra/supabase/recovery-hosted-readonly-fc328.sql`](../infra/supabase/recovery-hosted-readonly-fc328.sql) foi **executada** no projeto BR em **20/11/2026 às 14:59:20 UTC**. Apenas SELECT, nenhuma escrita, migração ou criação de recurso.

### Resultado registrado

| Inspeção realizada | Evidência hospedada |
| --- | --- |
| `public.schema_migrations` | 171 registros, 171 nomes distintos, 171 campos SHA-256 com 64 caracteres |
| Migração `176_required_operational_notification_kind.sql` | 1 registro |
| Tabelas públicas / RLS habilitado | 166 / 166 |
| Tabelas visíveis via SELECT a `anon` ou `authenticated` | 0 / 0 |
| Permissão USAGE de `public` para esses papéis | revogada para ambos |
| `users`, `listings`, `transactions`, `support_duty_assignments` | 0 / 0 / 0 / 0 |
| `pg_settings.ssl` | `on` — apenas suporte SSL no servidor, **não comprova imposição de TLS** |
| Backup externo, retenção, restauro hospedado, RPO/RTO e CA do cliente | **não verificados** |
| Resultado de ativação | **NO_GO_RECOVERY** |

O registro de checksums com 64 caracteres **não significa** comparação integral do conteúdo de cada uma das 171 migrações. Não alegar auditoria integral ou backup automático.

## Segurança de recuperação acrescentada pelo FC-328

`database/recovery.js` já exigia `CONFIRM_DATABASE_RESTORE=RESTORE`, checksum SHA-256 do dump e banco diferente da origem. Agora **destinos remotos exigem também** `CONFIRM_REMOTE_RESTORE_TARGET` igual à identidade **exata** do banco de destino `host:porta/banco` (DNS normalizado, porta 5432 por padrão). O erro não imprime usuário, senha nem URL completa.

- Restaurações no cluster temporário local `localhost/127.0.0.1/::1` continuam seguindo o ensaio sintético já aprovado, sem confirmação remota adicional.
- A confirmação de identidade **não concede** autorização para restaurar um projeto real. Se futuramente for usado destino hospedado, exige-se autorização operacional/jurídica, banco **separado, descartável e vazio**, cofre de segredos, snapshot do destino, controle de manutenção, verificação de projeto, RLS e revisão humana.
- Não usar como confirmação um endereço do projeto BR de homologação nem da futura produção. A ferramenta técnica não detecta aliases DNS, túneis ou destinos reencaminhados e não substitui revisão humana da configuração.
- `pg_restore --clean` pode apagar objetos existentes no destino; **não realizar em ambiente hospedado neste estágio**.
- Um exemplo ilustrativo da confirmação (sem segredo) é `CONFIRM_REMOTE_RESTORE_TARGET=isolado.example.test:5432/restore_ficticio`. Não adicionar credenciais a GitHub, chat ou logs.

## Plano Free: diferença entre teste real local e restauração hospedada

Segundo [Supabase — FAQ Free plan backups](https://supabase.com/kb/faqs/platform/free-plan-backups) (30/10/2026), **não existem backups diários automáticos** no plano Free. O [guia oficial de backups](https://supabase.com/docs/guides/platform/backups) recomenda dump manual pela CLI e cópias fora do projeto. Isso é um ponto de risco, não um portão solucionado: objetivos atuais de backup **a cada 60 minutos**, RPO **≤ 60 minutos**, RTO **≤ 240 minutos**, retenção **imutável de 30 dias** e ensaio a cada 30 dias não estão provados.

O projeto já possui um **ensaio real sintético de PostgreSQL descartável**, acionado por `tests/postgres-beta.test.mjs` → `tools/beta-recovery-check.mjs`: `pg_dump`, checksum, `pg_restore` em `beta_restore`, comparação de todas as tabelas/sequências, segunda restauração e idempotência de migrações. Isso comprova as rotinas locais, **não** uma cópia utilizável do banco BR ou recuperação após desastre externo.

## Etapas para homologar os portões 57/59 sem confundir simulação com ativação

1. **Sem contratar nada agora:** conservar `main` com CI verde, teste PostgreSQL sintético e preflight read-only. Manter as flags de backup e fornecedores desativadas. Nenhum dado pessoal.
2. **Conexão TLS da API:** obter no painel a cadeia/CA atual do projeto e host real do pooler session (não adivinhar host); testar cliente servidor com verificação de hostname/certificado (`verify-full`) a partir do backend isolado e comprovar no painel a imposição de SSL. Não copiar URL/senha aqui. [Guia Supabase de conexão](https://supabase.com/docs/guides/database/connecting-to-postgres).
3. **Backup externo privado:** realizar uma exportação com `pg_dump` por conexão backend autorizada e credenciais no cofre, gerar/verificar checksum, testar proteção de armazenamento e retenção, depois instrumentar periodicidade/alertas. Um backup manual não comprova RPO de 60 min.
4. **Restauração isolada:** usar um banco novo em infraestrutura previamente aprovada, nunca sobrescrever o BR; conferir integridade de tabelas, sequências, migrações, privilégios e dados autorizados, medir RPO/RTO e repetir ensaio sob observação independente.
5. **Responsáveis e aprovação:** nomear/aceitar titulares, substituto e avaliador independente segundo governança aprovada, registrar tempo, incidentes, falhas, atas e aceite final. Nenhum destes portões foi promovido por FC-328.

**Estado preservado:** matriz 48/70 = **68,57%**; preflight BH 16/21; piloto e produção **NO-GO**. Nenhuma contratação, custo adicional, serviço externo, publicação, banco restaurado ou backup verdadeiro do Supabase BR foi criado nesta entrega. Protótipo fora de `platform/` inalterado.
