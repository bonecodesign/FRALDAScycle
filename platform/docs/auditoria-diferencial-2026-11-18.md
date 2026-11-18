# FraldaCycle — auditoria diferencial sem retrabalho (18/11/2026)

**Fonte normativa:** [matriz oficial](requirements-matrix.json) de 17/11/2026. **Fonte da execução:** [quadro Codex](../config/codex-action-board.v1.json). **HEAD observado:** `a6573baa1ab30cd42041b6f7648933ab38cdabff` (PR #314 integrado). Documento de rastreabilidade; **não** é execução de teste, homologação humana, parecer jurídico, contratação ou autorização de piloto.

## Resultado da conferência

- **70 requisitos:** 48 `concluido` (**68,57%**), 11 `parcial`, 11 `bloqueado`. Os 48 concluídos e suas evidências por arquivo permanecem registrados na matriz; não é necessário duplicar sua descrição nem executar testes sem alteração.
- **Piloto interno BH:** **NO-GO**. Preflight vigente: **16/21**; cinco pendências (`publish-search-negotiate`, `keyboard-check`, `device-matrix`, `screen-reader-check`, `rollback-owner`). Testes locais em navegador, HTTP e PostgreSQL não encerram evidência humana.
- **CI:** PR #314 teve os cinco jobs obrigatórios verdes na revisão; a execução `push` da `main` passou com três jobs executados e dois intencionalmente ignorados pelas condições do workflow. Para **novo merge** exigir cinco jobs verdes no **head exato do PR**; não interpretar `skipped` de push como cinco aprovações.
- O código da aplicação evolui **somente em `platform/`**, protótipo da raiz preservado. Nenhum provedor, gateway, pagamento, logística, telemetria, dado infantil real, publicação, credencial, contratação ou produção foi ativado por esta auditoria.

## Escopo já entregue — não repetir

| Frente | Evidência incorporada | O que isto **não** comprova |
| --- | --- | --- |
| Jornada de anúncios | PRs [#304](https://github.com/bonecodesign/FRALDAScycle/pull/304), [#308](https://github.com/bonecodesign/FRALDAScycle/pull/308) e [#309](https://github.com/bonecodesign/FRALDAScycle/pull/309): navegador, publicação, moderação, busca, transação e chat bloqueado em testes sintéticos | Mídia homologada, dispositivo/leitor de tela humano e compra real |
| Segurança de mídia e adaptadores | [#310](https://github.com/bonecodesign/FRALDAScycle/pull/310), [#312](https://github.com/bonecodesign/FRALDAScycle/pull/312), [#313](https://github.com/bonecodesign/FRALDAScycle/pull/313), [#314](https://github.com/bonecodesign/FRALDAScycle/pull/314) | Qualidade real de OCR, política de rede/egress e fornecedor conectado |
| Financeiro | [#305](https://github.com/bonecodesign/FRALDAScycle/pull/305), `tests/finance-preactivation-reconciliation-matrix.test.mjs`, `tests/product-processing-cost.test.mjs`: comissão e conservação de centavos, tarifa desconhecida distinta de zero, bloqueio de repasse | Tarifa homologada, split, cobrança, reconciliação externa |
| Família e privacidade | `docs/child-profile-dataflow-audit-2026-11-09.md`, `tests/child-profile-http-postgres.test.mjs`, `tests/child-profile-notification-minimization.test.mjs`, `tests/account-consent-policy.test.mjs` | Parecer, eliminação de registros legados, autorização de coleta |
| Suporte/instituições | `tests/support-operations-http-postgres.test.mjs`, `tests/institution-receipt-http-postgres.test.mjs`, `tests/donation-institutional-pickup-postgres.test.mjs` | Pessoas reais, capacidade/escala, representante verificado em campo |
| Preparação de piloto | [#311](https://github.com/bonecodesign/FRALDAScycle/pull/311), `config/pilot-human-session-preparation.v1.json` com 17 tarefas **não executadas** | Validação humana, rollback e GO |
| Incidentes | [#287](https://github.com/bonecodesign/FRALDAScycle/pull/287) já substituiu o [#286](https://github.com/bonecodesign/FRALDAScycle/pull/286) | Exercício humano real e canais de comunicação homologados |

## Delta por requisito ainda aberto (22/70)

**Rótulos:** `EXT` depende de fornecedor/infraestrutura; `HUM` depende de pessoa/parecer/aceite; `DEC` decisão ainda não autorizada. Um rótulo não substitui a razão individual da matriz.

| ID | Estado | Evidência técnica já disponível; **não recriar** | Delta efetivamente pendente |
| --- | --- | --- | --- |
| 2 | parcial | Comissão logística e conservação de frete; testes `logistics-commission-conservation`, `finance-preactivation-reconciliation-matrix` | Split e reconciliação/repasse real (**EXT/HUM**) |
| 3 | bloqueado | Prévia `product-processing-cost` com tarifa `null` e repasse bloqueado | Tarifa e contrato do processador, teste autorizado, conciliação (**EXT/HUM**) |
| 10 | parcial | Cálculo, diferença, disputa, fila e testes de troca | Retenção/cobrança/repasse externo homologado (**EXT/HUM**) |
| 12 | bloqueado | Regra de escopo preservada | **STANDBY (DEC):** não atribuir custo do processamento de frete |
| 26 | bloqueado | Fluxo infantil minimizado e inativo, inventário 09/11 | Parecer LGPD, retenção histórica e autorização (**HUM**) |
| 27 | bloqueado | Cadastro familiar obrigatório tecnicamente condicionado a feature flag | Melhor interesse, base legal e autorização antes de coleta (**HUM**) |
| 28 | bloqueado | Seleção por faixa interna e filtro de saída externa, testes de consentimento | Revisão de marketing/consentimento e fornecedor (**HUM/EXT**) |
| 31 | bloqueado | Separação de perfil familiar e operacional sob teste local | Revisão jurídica e ativação expressa (**HUM/DEC**) |
| 32 | bloqueado | Múltiplos perfis familiares implementados, desativados por padrão | Parecer e autorização de uso real (**HUM/DEC**) |
| 33 | bloqueado | Correção, exclusão de nascimento no ciclo, versão e contestação | Purga/retention de histórico e direitos homologados (**HUM/EXT**) |
| 41 | parcial | Texto e gates fail-closed de mídia; PR #310 | OCR/QR, falso-negativo e revisão real de imagem (**EXT/HUM**) |
| 45 | parcial | Fluxo e plano local de encerramento e retenção | Parecer por categoria, purga e comprovantes efetivos (**HUM/EXT**) |
| 46 | bloqueado | Aceites e versões técnicas, políticas ainda em minuta | Documentos aprovados e comunicação material autorizada (**HUM**) |
| 49 | parcial | Geração/filas e falha segura de notificações | Provedor, device, permissão, templates e entrega real (**EXT/HUM**) |
| 51 | bloqueado | Fila de suporte interno (não cria atendimento externo) | Canal oficial, SLA, escala de atendimento (**HUM/EXT**) |
| 56 | parcial | Incidentes, decisão de comunicação, guarda transacional #287 | Pessoas/canal/parecer/exercício independente (**HUM/EXT**) |
| 57 | parcial | Backup, checksum, restauração local, objetivos e runbooks | Infra autorizada, KMS/bucket e RPO/RTO medidos em homologação (**EXT/HUM**) |
| 59 | parcial | Cofre simulado, segredo, bloqueios e #314 para URLs com credenciais | Cofre/identidades/rotação/revogação reais e egress/DNS (**EXT/HUM**) |
| 60 | bloqueado | Documentos de diligência e seleção | Saída/portabilidade e condições contratuais reais (**EXT/HUM**) |
| 61 | parcial | Linguagem de seguro sem cobertura ativa | Cotação, riscos/exclusões e aprovação de contratação (**EXT/HUM**) |
| 62 | parcial | Autorização/atestação institucional, RBAC e idempotência | Representante, poderes e capacidade real verificados (**HUM**) |
| 67 | parcial | Navegador/HTTP/Postgres e roteiro FC-311 | Cinco evidências pendentes, mídia, humano, rollback, autorização (**EXT/HUM/DEC**) |

**Checagem do delta:** 11 parciais + 11 bloqueados; nenhum `concluido` promovido ou rebaixado. Em qualquer possível reclassificação, exigir evidência individual e revisão humana por meio separado.

## Saneamento da fila — sem trabalho duplicado

| Item | Conferência | Encaminhamento |
| --- | --- | --- |
| [Issue #229](https://github.com/bonecodesign/FRALDAScycle/issues/229) | Auditoria de fluxo infantil de 09/11, minimização e testes já registrados | **Manter aberta somente para lacunas de histórico, retenção e pareceres**; não recriar inventário |
| [Issue #230](https://github.com/bonecodesign/FRALDAScycle/issues/230) | Matriz de centavos, tarifa desconhecida e proibição de payout já testadas | **Manter aberta para prova faltante específica**, eventualmente eventos externos autorizados; não repetir combinatória |
| [Issue #231](https://github.com/bonecodesign/FRALDAScycle/issues/231) | Suporte/instituições e roteiro de piloto já existem | **Manter aberta para discrepância demonstrável e aceite operacional/humano**; sem identidades fictícias tratadas como aceites |
| [PR #286](https://github.com/bonecodesign/FRALDAScycle/pull/286) | Substituído por #287 integrado | **Encerrado sem merge** em 18/11; sem repetição de correção |
| [PR #265](https://github.com/bonecodesign/FRALDAScycle/pull/265) | Documento isolado de 13/11 cita **43/70**, **19/21** e **quatro jobs**; suas sete trilhas estão cobertas aqui e no quadro atualizado | **Substituir/encerrar sem merge**, após aceitar este documento e verificar que não há delta técnico único |
| PRs #222 e #224 | Fechados sem merge; referências históricas do quadro anterior | **Não restaurar** como pré-requisitos de trabalho |

## Protocolo obrigatório antes de qualquer novo teste ou PR

1. Confirmar `main` HEAD e matriz oficial; localizar PR/commit e arquivo de teste **já existentes** para o caso concreto.
2. Citar **uma lacuna reproduzível** (com entrada, comportamento esperado, observado e risco) antes de propor novo código ou regressão. Se não houver lacuna, **não criar teste novo**.
3. Reaproveitar evidência de CI e testes já executados **na mesma SHA de origem** quando o código não mudou; não executar suites idênticas somente para aumentar contagem. Um novo PR requer seus cinco gates automáticos verdes em `head_sha`; não bypassar CI.
4. Usar PR pequeno, somente `platform/`, sem tocar no protótipo. Ações críticas, dados infantis, pagamentos, fornecedores, acesso público, identidade real, credenciais e piloto permanecem bloqueados.
5. Atualizar a matriz apenas por prova individual, parecer aplicável e decisão humana. Nunca promover por documentação, quantidade de PRs ou testes sintéticos.

## Ordem racional da próxima entrega

**A.** Resolver pendências **administrativas** #265/#286 e comentários nas #229–231, sem reimplementar.  
**B.** Solicitar responsáveis humanos e critérios de revisão PRIV/FIN/OPS (nenhuma identidade preenchida no GitHub); preparar pacote único de questões ainda não respondidas para futura avaliação.  
**C.** Escolher **um gap técnico reproduzível** remanescente, se identificado, preferindo a falha com maior risco e não coberta por testes existentes. Se for puramente dependência externa, registrar `BLOQUEADO` sem criar código fictício.  
**D.** Somente após homologações e autorização separada, retestar meios físicos/fornecedores conforme a matriz, sem assumir que o piloto está liberado.

**Governança:** sem serviços pagos, contratação, publicação externa, transações reais, dados pessoais/infantis reais, credenciais, alteração do protótipo, migração de produção ou implantação de IA autônoma.
