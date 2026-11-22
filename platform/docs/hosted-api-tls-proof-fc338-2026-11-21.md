# FC-338 — Prova TLS do cliente PostgreSQL da API em homologação

**Data:** 21/11/2026. **Estado:** ferramenta segura preparada; prova da sessão da API hospedada **não executada**. Piloto BH e produção seguem `NO-GO`.

## O que já foi observado de verdade

Por consulta **somente leitura** no Supabase-BR (`urbrtnenrsjvgqjhfhdj`, São Paulo) em **21/11/2026 às 23:59:35 UTC**, a sessão do **conector Supabase** retornou:

- `ssl=on`, `ssl_min_protocol_version=TLSv1.2`;
- `pg_stat_ssl.ssl=true`, `version=TLSv1.3`, `bits=256`;
- `171` migrações, `166` tabelas com RLS;
- `0` usuários, `0` anúncios, `0` transações, `0` chamados.

A sessão do conector é distinta da sessão da API FraldaCycle. Não foram verificados o certificado do cliente da API, a CA do backend, um deploy do backend ou imposição global de SSL. A consulta não fornece prova de backup, restauração, RPO ou RTO.

## Prova pendente — cliente original da API sem alterar o banco

O script [`tools/hosted-database-tls-probe.mjs`](../tools/hosted-database-tls-probe.mjs) importa `createDatabase` de `database/client.js` e `loadConfig` de `apps/api/config.js`, isto é, o **mesmo cliente PostgreSQL e a mesma validação de certificado** usados pela API. Executa exatamente um `SELECT` de metadados `pg_stat_ssl`, restrito à **própria sessão PostgreSQL**, sem tocar em tabelas de usuários, anúncios ou transações. Em sucesso retorna `PASS_CLIENT_TLS_ONLY`, versão TLS, bits da cifra e timestamp em UTC; não devolve hostname, nome do operador, senha, CA ou dados de sessão da API.

### Condições obrigatórias para executar

1. Usar **somente** backend privado e isolado de homologação, não o dispositivo de consumidor, página pública, produção ou o Supabase Oregon. Nenhum deployment/serviço novo está autorizado nesta etapa.
2. Em cofre ou injeção privada do backend, configurar `DATABASE_URL` **do projeto BR correto**, `DATABASE_SSL=true`, `DATABASE_SSL_CA` com a **CA oficial** e `SUPABASE_INFRASTRUCTURE_ENABLED=true`. Não salvar nem colar URLs com senha, certificados privados ou logs de conexão no GitHub ou chat. A CA pública não é uma senha, mas deve ser obtida de fonte oficial e mantida atualizada.
3. O comando é opt-in, sem ativação permanente. No ambiente privado, injetar `HOSTED_TLS_PROBE_APPROVED=READ_ONLY_HOMOLOGATION` e executar `npm run db:hosted-tls:probe` a partir de `platform/`. `NODE_ENV=production` e `PILOT_BH_ENABLED=true` são recusados.
4. Usar o endereço real obtido pelo botão **Connect** do projeto. Conforme [documentação Supabase de conexões](https://supabase.com/docs/guides/database/connecting-to-postgres), backend persistente usa conexão **direta** caso tenha IPv6 ou pooler **session** caso possua apenas IPv4. Não usar porta 6543 (pooler transacional). Para **dump/restauração**, priorizar conexão **direta** quando autorizada.
5. A consulta confirma `ssl=true` e TLSv1.2 ou TLSv1.3, cifra de ao menos 128 bits, banco `postgres`. A camada `pg` verifica a CA/identidade do servidor pela configuração `rejectUnauthorized=true`; falhas devem ser tratadas como falhas, **nunca desativando o TLS para fazer o teste passar**.
6. O programa registra erro genérico `HOSTED_TLS_PROBE_FAILED` ao falhar, para não vazar exceções com endereço, senha ou CA. Falhas detalhadas só podem ser analisadas no ambiente privado sob segregação de acesso. **Não imprimir o ambiente nem parâmetros PostgreSQL.**

**Se faltar backend privado, segredo, CA ou rota autorizada**, não se pode executar a prova real. Uma aprovação de testes sintéticos ou a observação do conector não devem ser usadas para preencher este gate.

## Backup/restore: não confundir evidências

As metas de `config/recovery-objectives.v1.json` permanecem **alvos**, não resultados:

| Meta | Estado |
| --- | --- |
| Backup no máximo a cada 60 minutos | Não comprovado |
| RPO até 60 minutos | Não comprovado |
| RTO até 240 minutos | Não comprovado |
| Retenção imutável por 30 dias | Sem armazenamento externo homologado |
| Restauração em destino isolado e observada | Não realizada no Supabase hospedado |
| Operadores e revisores independentes | Ainda sem aceite formal |

O plano Supabase Free **não oferece backup diário automático**. Segundo o [guia de backups](https://supabase.com/docs/guides/platform/backups), são recomendados dumps e cópias off-site. As rotinas locais `database/recovery.js` já exigem `sslmode=verify-full` para hosts remotos (FC-337), verificação SHA-256, confirmação explícita e banco de destino separado. **Isso não é autorização de `pg_restore --clean` em hospedagem real.** Não executar dump hospedado para disco/CI efêmero nem upload de material sem armazenamento protegido e retenção aprovados.

## Evidência do pacote FC-338

- Testes sintéticos com `createDb` injetado: autorização explícita, ausência de CA, projeto incorreto, TLS desligado, URL com override, porta 6543, versão/cifra inadequadas, fechamento do pool e output sem segredo.
- Código não executa qualquer query no banco real sem `HOSTED_TLS_PROBE_APPROVED=READ_ONLY_HOMOLOGATION` e segredos privados.
- Migrations, feature flags, matriz de requisitos, fornecedores, protótipo e projeto Supabase permanecem sem alterações.
- Fonte oficial da matriz: `48/70 (68,57%)`, piloto `16/21` e `NO-GO`. Aprovação técnica de CI não promove requisitos 57/59/67.

**Passo seguinte com um backend privado aprovado:** executar uma única prova do cliente da API, arquivar somente o resultado não sensível, obter observação humana e então programar backup externo e restauração separada com proteção e métricas. A ausência de credenciais e infraestrutura externa nesta etapa não deve ser disfarçada como homologação.
