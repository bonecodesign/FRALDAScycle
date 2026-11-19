# FC-323 — Prévia de encaminhamento interno de suporte vencido (sem envio)

**Data:** 19/11/2026. **Proposta técnica aderente à decisão do fundador** em `docs/decisions/FC-DEC-2026-11-14-autoridade-final-fundador.md`; depende de homologação humana, canais, contratos e nova autorização antes de qualquer despacho.

## Diferença real em relação a FC-322

FC-322 já implementou triagem humana e prazos de primeira resposta. FC-323 **não refaz** essas regras: usa exclusivamente a fila de `GET /v1/support/attention` (tickets classificados, vencidos, ativos e sem primeira resposta humana) para planejar, de modo determinístico e somente leitura, quem *precisaria* ser comunicado.

- `GET /v1/support/escalation-preview`: permitido **somente** à liderança com **nível 4+** e setor `support` ou `operations` (nível 5 com setor `founder` conforme política existente). Requer sessão; não recebe IDs, identidades nem escalas por parâmetros do cliente; todas as fontes são consultas privadas do PostgreSQL. Cabeçalho `Cache-Control: no-store`.
- `support_duty_assignments` (migração 174): base **inativa** de indicação de titular e substituto do suporte; FK para contas individuais e solicitações de confirmação de segurança, estados pendente/aceito/recusado/revogado, índices que impedem dois titulares ou a mesma pessoa em dois papéis vigentes. A aceitação exige confirmação individual do titular. **Nenhum endpoint de nomeação/aceite é criado neste pacote; não há escalas nem pessoas designadas.** Uma implementação futura exigirá designação, aceite, autorização final, revogação e supervisão humana antes de preencher linhas reais.
- Na prévia, uma indicação só conta como elegível se estiver **aceita**, com comprovação individual, conta interna ativa, e-mail verificado, nível apropriado e setor `support`. Coordenadores de nível 4 e fundador nível 5 são **candidatos ativos**, não pessoas homologadas para plantão. Nunca usar apenas o setor de um funcionário para presumir que ele é titular/substituto.
- Casos vencidos não críticos planejam `primary` + `substitute`; críticos incluem também `level4` + `level5`. Identidades não podem se repetir em papéis incompatíveis. Ausência de qualquer confirmação produz `missing_coverage`; se todos os papéis estiverem elegíveis, a situação é apenas `prepared_not_activated` — jamais “enviado” ou “plantão real”.
- O resultado lista no máximo 50 tickets ordenados, mas os contadores completos de vencidos e críticos vêm da consulta agregada do banco. A hipótese **3 críticos vencidos** ou **falta de cobertura humana para críticos** aparece somente em `preventionPreview`, como recomendação para revisão, não um comando para pausar operações.

## Bloqueios expressos (fail closed)

A resposta da API permanece com `channelVerified=false`, `staffingVerified=false`, `externalDispatchAuthorized=false`, `internalDispatchAuthorized=false`, `automaticPauseAuthorized=false`, `sendAttempted=false`. O código não escreve em `notification_outbox`, não chama provedor ou Meta/WhatsApp, não dispara push, não gera incidente, não agenda cron e não altera controles operacionais.

A interface em `/admin/operations` oferece o botão **Simular encaminhamento (sem envio)**, mostra lacunas por função e deixa explícito que nenhuma mensagem ou pausa foi realizada. Um cliente comum não recebe o controle na sua tela; a API recusa conta anônima, cliente e administrador de setor indevido. Nenhuma justificativa/descrição de ticket segue para provedor externo.

## Evidência e passos ainda externos

- Testes focados de planejamento: ausência de funções, elegibilidade/aceite, pessoas duplicadas, fundador ausente, prioridade, três críticos, lote maior que 50, payload inválido e invariantes de bloqueio de envio.
- Testes no PostgreSQL já existente: acesso autenticado por setor, tabela vazia (sem nomeação fictícia), nenhum registro de notificação adicionado e prévia vencida com falta de cobertura.
- **Após CI verde e merge**, aplicar **uma vez** a migração 174 ao projeto Supabase-BR, conservando nome e SHA-256 em `public.schema_migrations` e conferindo RLS/grants e ausência de linhas reais. Não utilizar a Data API pública.
- Futuro: fluxo formal de designação e aceites de titular/substituto; escala com cobertura verificável; canal oficial próprio e templates; monitor que emita notificações com deduplicação, tentativas e auditoria; escalonamento supervisionado para níveis 4/5; exercícios humanos e decisões de pausa com controles graduados. Nada disso é ativado em FC-323.

**Matriz 48/70 (68,57%)** mantida; requisitos 49 (notificações), 51 (suporte externo), 56 (incidentes), 59 (segredos) e 67 (piloto) não são promovidos. Piloto BH segue **NO-GO**.
