# Central de Controle — auditoria inicial (22/10/2026)

## Objetivo
Consolidar os módulos administrativos existentes, sem criar painel paralelo, contratar fornecedores, ativar integrações ou alterar produção. Esta é uma auditoria documental inicial, não homologação funcional.

## Inventário confirmado na main
- `platform/apps/admin/index.html`: dashboard com resumo operacional e dados persistidos.
- `platform/apps/admin/admin-overview.js`: consulta API, formatação de indicadores, tratamento explícito de 401/403 e indisponibilidade sem dados fictícios.
- `platform/apps/admin/finance.html`: consulta financeira somente leitura, sem transferências.
- `platform/apps/admin/operations.html`: fila de suporte e filtros; encerramento não cancela nem reembolsa.
- `platform/apps/admin/alerts.html`: pendências derivadas do banco; resolução ocorre no fluxo operacional correspondente.
- `platform/apps/admin/moderation.html`: moderação e recursos com persistência.
- `platform/apps/admin/data.html`: dados transacionais e CSV existentes; ETL, warehouse, qualidade e linhagem pendentes.
- `platform/apps/admin/infrastructure.html`: health/ready e prontidão PostgreSQL; restauração de backup e telemetria externa não comprovadas.
- `platform/apps/admin/security.html`, `launch.html`, `reports.html`: arquivos identificados, comportamento ainda requer inspeção detalhada.

## Proposta de consolidação
1. Visão geral: KPIs reais, atualização e carimbo de origem/período.
2. Comercial: anúncios, vendas, trocas e doações; não reintroduzir reserva como funcionalidade.
3. Financeiro: conciliação, taxas e repasses; ações financeiras protegidas e auditáveis.
4. Operações: suporte, entregas e instituições; preservar fluxos existentes.
5. Segurança: moderação, alertas e trilhas de auditoria, com permissões por papel.
6. Atendimento: fila, responsável, SLA e encaminhamento, sem cancelamento/reembolso implícito.

## Restrições de execução
- Nenhum push direto na main: branch e PR, revisão e CI antes de merge.
- Não publicar, contratar, gravar credenciais ou habilitar tráfego real.
- Não fabricar métricas; indisponibilidade deve ser explícita.
- Preservar regras comerciais aprovadas, sobretudo ausência de reserva e bloqueios de cancelamento.
- PR #115 sobre ativação explícita de provedores deve ser considerado, sem antecipar sua integração.
- Verificar visibilidade do repositório: consulta retornou 'public', divergente da diretriz de privacidade.

## Próxima rodada de auditoria
- Mapear rotas e endpoints por tela e perfis autorizados.
- Confrontar `requirements-matrix.json` e documentação com comportamento implementado.
- Executar testes existentes e registrar resultados, sem afirmar aprovação antecipadamente.
- Propor primeiro incremento pequeno da Central, preferencialmente somente leitura.
- Medir avanço apenas com evidências; relatório de 09/10 aponta 8/70 requisitos formalmente concluídos, 50 parciais e 12 bloqueados.


## Segunda rodada — contratos e permissões observados
- `admin-overview.js` usa `GET /v1/admin/overview-snapshot?limit=50` por `apiRequest`; popula indicadores de usuários, anúncios, transações, pagamentos e entregas, além de transações recentes e alertas derivados.
- O cliente apresenta mensagens distintas para HTTP 401 e 403; a proteção efetiva do endpoint deve ser confirmada no backend (ocultar links não equivale a autorização).
- `auth.js` define papéis administrativos `admin` e `moderator`, com navegação diferente. O login administrativo requer desafio de segundo fator no fluxo examinado; testes de servidor e sessão ainda não foram executados.
- `finance.html` mantém consultas somente leitura. Não associar consulta a liberação automática de repasses.
- `security.html` oferece consulta de sessões ativas e opção de revogar outras sessões; não inferir localização, identidade do dispositivo ou confiança a partir do agente do cliente.
- `launch.html` declara piloto interno, sem acesso público, dados pessoais reais, transações reais ou integrações externas.
- O resumo administrativo contém o rótulo legado `reserved: "Reservada"`. Investigar origem e estados do backend; **não** reintroduzir a funcionalidade de reserva aprovada para remoção.

## Primeiro incremento recomendado (somente leitura)
1. Exibir origem e momento da última consulta bem-sucedida, distinguindo claramente de atualização do dado na origem.
2. Preservar indisponibilidade e falta de permissão sem converter ausência em zero.
3. Revisar rótulos legados e adicionar regressões para regras comerciais e papéis.
4. Não criar novo endpoint nem ampliar autorização até a auditoria do backend.

## Evidências ainda necessárias
- Definições de rota, middleware de autenticação/autorização e contratos de `overview-snapshot`.
- Matriz de requisitos atualizada e diferenças desde 09/10.
- Testes unitários/integração, CI da branch e resultado do PR.
- Confirmação da visibilidade privada do repositório e resolução de eventual divergência.

## Terceira rodada — implementação e evidências de CI
- A Central permanece baseada no endpoint persistido `GET /v1/admin/overview-snapshot?limit=50`, sem API paralela ou integração externa.
- O dashboard agora diferencia consulta bem-sucedida de atualização dos dados na origem; em falha, limpa indicadores, transações e alertas e impede exportação do resultado anterior.
- Valores nulos ou ausentes são mostrados como `—`, sem confundir indisponibilidade com zero confirmado.
- Os elementos `verified-alert-list`, `verified-alert-empty` e `alert-count` foram incluídos no HTML para que os alertas derivados sejam realmente visíveis.
- O teste de integração de entregadores passou a usar datas de submissão coerentes com o relógio fixo da decisão, eliminando a violação de integridade reproduzida na CI.
- Evidência de CI aprovada no commit `8408ae84321c08cbdc6eddb48d90b193022a016f`: execução GitHub Actions #1353, jobs `foundation`, `listing-postgres`, `containers` e `browser-postgres` com sucesso.
- **A aprovação da execução #1353 não homologa commits posteriores.** A CI do commit `250968dc7ea91951e6a3f6a4033db12ce5d05190` foi detectada como pendente (execução #1355) na consulta inicial; aguardar resultado antes de considerar merge.
- Revisão de permissão, comportamento no navegador, consistência financeira e visibilidade privada do repositório continuam pontos de decisão.

## Quarta rodada — verificação de autorização no backend
- A rota `GET /v1/admin/overview-snapshot` exige `admin:operations:read` no servidor antes da consulta.
- A rota `GET /v1/admin/finance-snapshot` exige `admin:finance:read`; a rota logística exige `admin:deliveries:validate`.
- `GET /v1/admin/audit-events` e a exportação CSV exigem `admin:audit:read`.
- Alterações de usuário e papel exigem, respectivamente, `admin:users:write` e `admin:roles:write`.
- Esses controles foram verificados no roteador `platform/apps/api/admin-handler.js`; a efetividade depende também da implementação de `requireScope`, sessão e matriz de papéis, que precisam de teste de autorização negativa.
- A CI #1356 passou nos quatro jobs (foundation, listing-postgres, containers, browser-postgres) para o commit `68b7b6f86181a2d151d022c326fbfbd3d2025316`.
- A soma de `payment_intents.amount_cents` em estado `paid` é volume de pagamentos confirmados, **não** receita líquida, comissão auferida ou repasse efetivado.

## Quinta rodada — homologação automatizada e revisão pré-merge
- A CI #1359, referente ao commit `c0a117d89050d2385246f5128e9a73aaaf755e01`, foi aprovada após nova execução: `foundation`, `containers`, `listing-postgres` e `browser-postgres` concluíram com sucesso. Evidência: https://github.com/bonecodesign/FRALDAScycle/actions/runs/39868651600
- Na primeira tentativa, `browser-postgres` falhou por não iniciar o Chrome DevTools; a repetição do job foi aprovada. Não classificar esse incidente como defeito comprovado nas permissões.
- Os testes de escopo verificam respostas de autorização 401/403 e impedimento de invocação do serviço em rotas administrativas para perfis não autorizados; são testes automatizados com sessões simuladas, **não** substituem homologação humana nem auditoria de segurança independente.
- Comparação com `main` antes desta atualização: 15 commits à frente, zero atrás, seis arquivos modificados/adicionados. Não há reviews nem threads formais registrados no PR #130.
- Os seis arquivos são: `admin-overview.js`, `index.html`, este relatório, `admin-authorization-scopes.test.mjs`, `admin-overview-consultation.test.mjs` e `courier-eligibility-http-postgres.test.mjs`.
- Pendências de decisão: revisão humana formal do PR, confirmação de privacidade do repositório, investigação do rótulo legado `reserved`, validação funcional com contas/perfis de teste e checagem da matriz de requisitos. Não efetuar merge nem publicação por aprovação de CI isoladamente.
