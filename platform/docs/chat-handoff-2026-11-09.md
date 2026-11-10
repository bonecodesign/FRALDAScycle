# FraldaCycle — passagem de contexto e decisões para Codex (09/11/2026)

> Registro de continuidade oriundo das conversas de planejamento. **Não é homologação, parecer jurídico, aceite de gate ou autorização de produção.** Verificar a matriz e o HEAD atuais antes de executar.

## Fontes oficiais
- `platform/docs/requirements-matrix.json` — única fonte de status dos 70 requisitos.
- `platform/config/codex-action-board.v1.json` — fila de 28 pendências em oito trilhas.
- `platform/config/cross-functional-decision-gates.v1.json` — 21 gates PRIV/FIN/OPS.
- `platform/docs/codex-fast-track-2026-11-08.md` — instruções de execução.
- Pacotes em `platform/docs/approval-packets/` e documentação jurídica versionada.

## Fotografia histórica (08/11/2026; reconferir)
42/70 concluídos = 60%; 17 parciais, 11 bloqueados. Piloto Belo Horizonte: **NO-GO**. Não promover itens sem prova individual e avaliação humana. Não interpretar PR, teste sintético, aprovação interna ou minuta como homologação.

## Decisões internas recentes — PRIV-05 (a refletir nos artefatos aplicáveis)
1. **Consentimento e perfil infantil:** o responsável deve manter **ao menos um perfil infantil** para que a plataforma recomende produtos adequados à faixa etária. Projetar aviso/consentimento claro, específico e compreensível, coleta mínima, melhor interesse e base legal adequada. A obrigatoriedade funcional **não dispensa** consentimento válido quando exigido nem autoriza forçar consentimento para tratamento opcional. Definir solução de recusa sem violar direitos; submeter a revisão jurídica/LGPD. **Não ativar `CHILD_PROFILES_ENABLED` nem usar dados reais.**
2. **Documentos e alterações:** versionar instrumentos e avisar previamente mudanças relevantes; colher novo consentimento quando necessário; distinguir mudanças editoriais de materiais; preservar direitos em caso de recusa.
3. **Direitos e revisão:** permitir consulta e correção dos perfis infantis, acompanhamento de solicitações, contestação e revisão humana, com autenticação e auditoria mínima.
4. **Canal de privacidade:** canal acessível, protocolo e confirmação, acompanhamento, prazos legais, alertas e revisão humana de casos complexos.

Esses pontos representam **decisões internas do fundador**, não aprovação externa dos gates PRIV-01…07. Verificar a redação e numeração dos subitens já existentes antes de atualizar outros documentos; evitar duplicação ou contradições.

## Outras diretrizes já estabelecidas
- Protótipo original imutável; **alterações exclusivamente sob `platform/`**.
- Sem contratação, provisionamento pago, publicação externa, credenciais em GitHub, pagamentos reais, cadastro de crianças reais ou operação com instituições reais sem autorização.
- CNPJ próprio pretendido; campos de identificação empresarial ainda **em branco**, sem inventar dados.
- Fornecedores financeiros/logísticos apenas candidatos a homologação; nenhuma contratação presumida. Requisito 12 permanece standby até decisão expressa.
- Anúncios de 30 dias; preço de referência atualizado no dia 1º de cada mês; aviso e pausa quando houver necessidade de ajuste; republicação após expiração somente se atender às regras vigentes.
- Pagamento protegido e chat pós-pagamento; taxas e fluxos dependem de evidência contratual e homologação.
- Orquestração autônoma é **possibilidade futura**, não implementação aprovada. Arquitetura preferida: automações determinísticas primeiro, IA assistiva opcional depois, supervisão humana em decisões críticas.
- Priorizar redução de exposição jurídica, financeira e operacional sem sacrificar direitos de consumidores, crianças e titulares.

## Continuidade: evitar retrabalho
1. Verificar HEAD, PRs abertos/integrados, matriz, testes e CI; aproveitar código e evidências existentes.
2. Conferir se decisões PRIV-05 acima já constam dos pacotes e requisitos; propor ajustes documentais mínimos, sem marcar gate aprovado.
3. Distinguir: implementado, testado em commit identificado, homologado externamente e autorizado operacionalmente.
4. Identificar lacunas reais nos 28 requisitos, priorizando tarefas técnicas sem fornecedores, com PRs pequenos.
5. Para cada tarefa registrar IDs, arquivos, testes/comandos, SHA, quatro jobs obrigatórios de CI, risco residual, dependências e responsável a designar.
6. Não fazer merge sem CI e revisão aplicáveis; não alterar percentuais por mera produção de documentos ou testes.
7. Antes do piloto, exigir pareceres/revisões pertinentes, validação financeira/logística, infraestrutura, suporte humano, testes E2E integrados e decisão GO/NO-GO expressa.

## Observação sobre segurança
O repositório foi identificado como público em consulta anterior. Verificar visibilidade e exposição de dados/segredos antes de anexar material sensível. Este arquivo não contém dados pessoais reais, chaves ou credenciais.
