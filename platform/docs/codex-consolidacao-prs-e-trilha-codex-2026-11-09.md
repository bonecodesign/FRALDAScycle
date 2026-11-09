# FraldaCycle — Consolidação de PRs, divergências e trilha de integração para Codex

**Data de fotografia:** 09/11/2026. **Natureza:** roteiro de preparação, revisão e rastreabilidade — não homologação nem autorização de merge/deploy. **Local:** `platform/`. **Piloto BH: NO-GO**.

## 1. Baselines e regras de fonte única

- **Progresso oficial:** `platform/docs/requirements-matrix.json` na `main`, 70 itens: **42 concluídos (60%), 17 parciais, 11 bloqueados**; não atribuir percentual parcial. Data interna da matriz: 07/11/2026. **28 itens ainda não concluídos**.
- **Fila técnica estruturada para Codex:** `platform/config/codex-action-board.v1.json`, com oito frentes, testes e evidências pendentes. Não duplicar ou criar uma segunda máquina de estados.
- **Portões especializados:** `platform/config/cross-functional-decision-gates.v1.json`, 21 gates PRIV/FIN/OPS com `pending_human_review`. Não promover estados por aceite interno do fundador, documentação, testes ou CI.
- **Decisões de produto:** `platform/docs/decisions/FC-DEC-2026-11-03-governanca-juridica-produto.md` é histórico interno. Decisões **mais recentes de 09/11** na [PR #235](https://github.com/bonecodesign/FRALDAScycle/pull/235) retificam o produto nos pontos explicitamente deliberados, **sem homologar o texto jurídico**.
- **Programa jurídico em elaboração:** [PR #227](https://github.com/bonecodesign/FRALDAScycle/pull/227), 30 instrumentos LEG-01..30, auditorias e plano; documentos **não vigentes**, sem parecer profissional. [PR #225](https://github.com/bonecodesign/FRALDAScycle/pull/225) é inventário preliminar anterior a esse conjunto, não uma prova de ausência atual de toda minuta.
- **P-01/P-02:** a [PR #215](https://github.com/bonecodesign/FRALDAScycle/pull/215) **já foi integrada à `main`**, merge `f51e99be03adee9002ea3be5390ae4cdb8e53d31`; CI anterior aprovado em quatro jobs. Teste sintético não equivale a prova de purga em fornecedor real ou de conformidade de dados infantis.

## 2. Inventário de PRs abertas e decisão de tratamento

Consultas a metadados e listas de arquivos no GitHub em 09/11/2026. `mergeable=true` significa apenas ausência de conflitos detectados, **não autorização de merge**.

| PR | Conteúdo / arquivos | Estado técnico observado | Encaminhamento proposto |
| --- | --- | --- | --- |
| [#115](https://github.com/bonecodesign/FRALDAScycle/pull/115) | Ativação explícita de fornecedores, config e testes (10 arquivos) | Aberta, **não mergeável**, não draft | Não integrar; reavaliar diff contra `main`, segredos/flags e CI, separar eventual melhoria segura em PR pequena; sem fornecedor ativo. |
| [#130](https://github.com/bonecodesign/FRALDAScycle/pull/130) | Central de Controle, UI admin e testes (6) | Draft, **não mergeável** | Reaproveitar apenas partes não existentes na `main`, rever RBAC e testes em branch nova; não resolver conflitos por sobrescrita. |
| [#189](https://github.com/bonecodesign/FRALDAScycle/pull/189) | Auditoria das #115 e #130 (1 documento) | Draft, mergeável | Revisar vigência das evidências; documento de referência para decisões de recuperação/fechamento de #115/#130. |
| [#222](https://github.com/bonecodesign/FRALDAScycle/pull/222) | FC-JUR-50, 28 pendências e homologação (1 documento) | Draft, mergeável | **Corrigir histórico desatualizado da #215** (agora integrada), reconciliar com #224/#227/#235, revisar e só depois considerar integração documental. |
| [#224](https://github.com/bonecodesign/FRALDAScycle/pull/224) | Handoff pós P-01/P-02 e **esta trilha** | Draft, mergeável na fotografia | Ponto de entrada para Codex; não integrar até revisão desta trilha, do head atual e CI pertinente. |
| [#225](https://github.com/bonecodesign/FRALDAScycle/pull/225) | Inventário legal prévio e plano Codex (1) | Draft, mergeável | Preservar levantamento como histórico; **atualizar com o surgimento dos 30 instrumentos na #227**, não tratar este inventário como canônico final. |
| [#227](https://github.com/bonecodesign/FRALDAScycle/pull/227) | 30 minutas LEG + 7 arquivos de auditoria/governança (37) | Draft, mergeável | Fazer confronto cláusula a cláusula e revisão humana; **não publicar termos**, não transformar prazos propostos em regras homologadas. |
| [#235](https://github.com/bonecodesign/FRALDAScycle/pull/235) | Quadro de decisões humanas PRIV/FIN/OPS (1) | Draft, mergeável | **PRIV-01/02 retificados, PRIV-03 (5), PRIV-04 (4), PRIV-05 (5) aprovados internamente**; PRIV-06.1 ainda proposto, PRIV-07/FIN/OPS não homologados. Validar contradições legais antes de qualquer implementação. |

**Estratégia:** não fechar nenhuma PR nem efetuar merge nesta rodada. Reconciliar primeiro os documentos e a sequência de dependências; só depois encaminhar decisões específicas de integração, com revisão e CI no head atualizado.

## 3. Divergências localizadas — backlog de reconciliação

| ID | Divergência concreta | Resolução exigida antes de integração/ativação |
| --- | --- | --- |
| D-01 | #222 contém fotografia em que #215 ainda estava atrás da `main` e pedia integração. #224 e GitHub confirmam merge da #215. | Preservar histórico datado; adicionar errata em #222; não executar novamente um merge já realizado. |
| D-02 | #225 lista rascunhos legais anteriores como levantamento preliminar; #227 passou a reunir 30 instrumentos e auditorias. | Mapear antigo→LEG-01..30; revisar duplicações, lacunas e versão canônica **após** revisão profissional; não declarar 50 instrumentos encontrados sem inventário individual. |
| D-03 | #235 retificou a regra: **pelo menos um perfil infantil para ofertas e novas operações dependentes do perfil**. Textos ou telas com “perfil infantil opcional, marketplace normal sem perfil” estão superados. | Ajustar contratos, UX e testes sintéticos, sem bloquear conta, histórico, suporte ou direitos quando o último perfil for apagado. Avaliar eficácia legal do consentimento condicionado e necessidade da data integral (PRIV-01/02/05). |
| D-04 | A decisão antiga prevê que, ao atingir 13 anos, o último perfil encerra e a conta recebe relevância geral. A nova regra exige perfil elegível para operações dependentes. | Produto + jurídico decidir **explicitamente** o tratamento de término automático por idade e se há/qual exceção, sem assumir bloqueio silencioso ou reaproveitar dado excluído. |
| D-05 | #227 LEG-02/13/16 contém **prazos propostos** (incluindo cinco anos para prova de consentimento e 12 meses para mudanças), enquanto PRIV-04.3 exige prazo **fundamentado por classe** e PRIV-04.2 fixa 30 dias de backup como meta sujeita a prova. | Enquadrar prazos como sugestões, não conclusões; análise LGPD/jurídica, mapa de retenção e restore que não ressuscite perfil removido. |
| D-06 | #227 LEG-23 prevê condições para marketing e segmentação; **PRIV-06 item 1 foi somente apresentado, não aprovado**. | Não presumir consentimento/promessa de faixa etária a parceiros; manter veto de publicidade comportamental infantil como proposta de controle e exigir deliberação PRIV-06 + parecer. |
| D-07 | #115 e #130 estão **não mergeáveis**; #189 documenta riscos históricos e diferenças da `main`. | Verificar diffs atuais, segurança, autorizações, RBAC, CI e reaproveitamento mínimo; preparar correções pequenas independentes. |
| D-08 | #227 é programa jurídico pré-operacional e #235 registra diretrizes de fundador; nenhum documento é homologação. | Exigir textos finais, responsáveis reais, aprovações e evidências **fora do repositório público**. Não ativar perfis, pagamentos, atendimento ou marketing. |

## 4. Os 28 requisitos ainda não concluídos — agrupamento sem mudar o estado

| Frente Codex | IDs e estado em 09/11 (`P` parcial; `B` bloqueado) | Evidência/prova próxima |
| --- | --- | --- |
| Pagamentos, fretes e trocas | **2 P, 3 B, 9 P, 10 P, 11 P, 12 B, 17 P** | Conservação/centavos, cobranças e splits sintéticos, negativas de integração; **12 standby**, tarifa do provedor desconhecida. |
| Instituições e suporte | **18 P, 42 P, 50 P, 62 P** | Autorização de representantes, retirada institucional, mediação/sanção humana, suporte por caso; sem operação real. |
| Dados infantis | **26 B, 27 B, 28 B, 31 B, 32 B, 33 B** | Mínimo de dois campos, consentimento, isolamento, exclusão/backup, mudança obrigatoriedade, testes de idade; flag desativada. |
| Infraestrutura e fornecedores | **57 P, 59 P, 60 B, 61 P** | Teste de recuperação sintética, segredos, desligamento/portabilidade contratual, sem seguro fictício. |
| Comunicação e incidentes | **49 P, 51 B, 56 P** | Aviso opcional, falha segura e protocolos; canal oficial, pessoas e fornecedor ainda não definidos. |
| Conta e termos | **45 P, 46 B** | Fechamento/retensão segregada; avisos e aceites versionados; nenhuma minuta jurídica vigente. |
| Moderação visual | **41 P** | OCR/triagem por fornecedor, privacidade e rejeição de contatos em mídia; não presumir homologação externa. |
| Piloto e acessibilidade | **67 P** | Revisões humanas, teclado/leitor de tela/dispositivos, responsáveis designados, critérios GO/NO-GO. |

**Checagem de integridade:** 17 `P` + 11 `B` = 28; nenhum item `B` promovido; todos mapeados às oito frentes existentes em `config/codex-action-board.v1.json`. A contagem total do projeto continua **42/70 = 60%**, não prontidão de produção.

## 5. Plano executável por lotes independentes para Codex

**C0 — Saneamento documental (primeiro, sem código funcional):**
1. Atualizar branch alvo em relação a `main`, verificando diff; não sobrescrever outros trabalhos.
2. Reconciliar D-01 a D-08 com tabela `origem → decisão mais recente → artefatos afetados → responsável humano → gate → evidência`; tratar #222/#225 como histórico até atualização.
3. Criar índice cruzado #227 LEG-01..30 ↔ decisões da #235 ↔ requisitos 26/27/28/31/32/33/45/46/49/50/51/56/57 e status de revisão; não preencher campos pessoais nem criar aceites.

**C1 — Privacidade e perfis (pode trabalhar em PR técnica isolada, recurso OFF):**
1. Testar fluxos de pelo menos um perfil elegível para novas operações, múltiplos perfis, remoção do último, conta/histórico/suporte preservados e status de pedidos. **Não decidir sozinho** D-04 (13 anos).
2. Cobrir privacidade por permissões, campos mínimos, consentimento versionado e negativos de visualização/correção cross-account.
3. Exercitar backup/restore **sintético**, incluindo prevenção de reaparecimento de perfil removido, sem simular prova de fornecedor real.
4. Rodar testes `tests/child-profile-http-postgres.test.mjs`, `tests/family-profile-foundation.test.mjs` e `tests/responsible-registration-http-postgres.test.mjs`; documentar lacunas jurídicas e status PRIV-01..07.

**C2 — Financeiro e frete (independente, provedores OFF):**
1. Revisar contratos dos IDs 2,3,9,10,11,12,17; isolar fornecedor real, tarifa desconhecida, split e autorização de repasse.
2. Manter 12 standby e executar testes locais de idempotência, duplicidade, centavos, divergência, falha e rollback.
3. Usar como base `tests/logistics-commission-conservation.test.mjs`, `tests/delivery-quote-http-postgres.test.mjs`, `tests/exchange-http-postgres.test.mjs`. Encaminhar FIN-01..07 à revisão especializada, sem contratações.

**C3 — Operação, infraestrutura e fornecedores (independente, execução simulada):**
1. Cobrir IDs 18,41,42,49,50,51,56,57,59,60,61,62,67 com cenários de negativa de acesso, erro, fila de suporte, incidente e recuperação.
2. Priorizar testes de `tests/database-recovery.test.mjs`, `tests/backup-storage.test.mjs`, `tests/secret-governance.test.mjs`, `tests/operational-incident-http-postgres.test.mjs`, `tests/pilot-technical-preflight.test.mjs`.
3. Encaminhar OPS-01..07 e dependências de fornecedores/canais/pessoas para responsáveis reais. Sem ativar mensagens, pagamento, cobertura de seguro ou piloto.

**C4 — Homologação e integração (somente com autorização específica e evidência):**
1. Revisar cada PR proposta, diffs, conflitos, testes e CI do **head final**. Reconciliar #115/#130 em pequenas mudanças novas, nunca merge forçado; evitar cherry-pick indiscriminado.
2. Confirmar `foundation`, `listing-postgres`, `containers` e `browser-postgres` quando aplicáveis. Em falha, corrigir/retestar ou bloquear.
3. Solicitar revisão jurídica/LGPD, segurança, financeiro-contábil, infraestrutura, operação, acessibilidade e produto, conforme gate. Evidências pessoais, contratos assinados, relatórios sensíveis e credenciais ficam **fora do GitHub público**.
4. **Somente após** evidência verificável e aprovação humana específica considerar merge/promoção individual da matriz; decisão de piloto GO/NO-GO permanece separada.

## 6. Contrato de saída de cada lote Codex

Cada PR deve informar: **IDs dos requisitos**, decisão aplicável, arquivos alterados, invariantes preservados, testes executados com resultado/ambiente/commit, CI, lacunas, revisão exigida, riscos residuais e se ocorreu merge (padrão **não**). Distinguir `preparado` / `testado sinteticamente` / `revisado por especialista` / `homologado externamente`; não usar “concluído” sem critério oficial.

**Guardrails permanentes:** protótipo original imutável; modificações apenas em `platform/`; não contratar/provisionar serviços pagos, publicar ambiente externo, habilitar perfis infantis, pagamentos, entregas reais ou comunicações externas; não inserir segredos ou dados infantis reais; não iniciar orquestração operacional autônoma/IA; nenhuma integração automática; preservar NO-GO do piloto.

## 7. Ponto de retomada

**Próximo trabalho autorizado sem contratar/ativar:** executar C0 (reconciliação, comparações e documentos de evidência). Ao passar para C1–C3, abrir PRs técnicas independentes e pequenas com recursos desligados; C4 requer revisões e autorização conforme escopo. Esta trilha **não** autoriza o Codex a realizar merges, ativar produção ou presumir aceite profissional.
