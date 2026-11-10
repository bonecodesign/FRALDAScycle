# FC-LEGAL-AUDIT-004 — Dossiê jurídico-técnico de dados infantis (requisitos 26–28 e 31–33)

**Data:** 09/11/2026. **Estado:** documentação de pré-homologação, não parecer, não execução de teste. **NO-GO para ativação infantil.**

## Fontes verificadas
- `platform/docs/requirements-matrix.json` (main, 07/11): requisitos **26, 27, 28, 31, 32 e 33 = bloqueado**.
- `platform/docs/decisions/FC-DEC-2026-10-22-dados-infantis-retencao.md` (main).
- `platform/docs/decisions/FC-DEC-2026-11-03-governanca-juridica-produto.md` (main).
- `platform/docs/family-profile-foundation-beta.md` (main): evidência histórica de fundação local, não homologação.
- `platform/docs/legal/FC-LEG-01`, `02`, `13`, `15`, `16`, `17`, `19` (PR #227).

## 1. Rastreabilidade por requisito

| ID | Requisito | Decisão aprovada | Prova técnica indicada | Bloqueio jurídico/operacional |
|---|---|---|---|---|
| 26 | Dados do bebê | Somente data de nascimento e emoji; não nome, foto, saúde ou localização | Verificar payload, schema, logs, auditoria e vazamentos para terceiros | Necessidade de data exata, melhor interesse, hipótese legal por finalidade |
| 27 | Obrigatoriedade do dado infantil | Perfil inicial obrigatório no cadastro familiar; possibilidade de remoção posterior | Testar cadastro interrompido, 24h de expiração, ausência de marketing | Proporcionalidade e alternativa menos intrusiva, inclusive opção sem perfil |
| 28 | Parceiros e idade | Data, idade e número de crianças não enviados a terceiros; ranking interno | Inspecionar adaptadores de logística, marketing e observabilidade | DPA, fluxos reais e validação de não compartilhamento |
| 31 | Perfis distintos | 1–5 perfis ativos na conta familiar; emoji exclusivo; datas iguais possíveis | Testar concorrência, unicidade de emoji, segregação por conta | Transparência, minimização e segurança |
| 32 | Mais de um bebê | Até 5 perfis, vitrine única, sem perfis públicos | Testar múltiplos perfis e ranking interno | Justificativa por finalidade e limite |
| 33 | Correção/remoção de datas | Correção sem valor anterior; remoção operacional imediata; backup até 30d | PostgreSQL, logs, worker, backups e restauração | Prova real de expurgo, retenção residual e exercício de direitos |

**Os seis requisitos permanecem BLOQUEADOS.** Documentação e testes sintéticos não promovem estado.

## 2. Regras de segurança e evidência técnica
A fundação registra `CHILD_PROFILES_ENABLED=false` por padrão e exige `CHILD_PROFILES_ACTIVATION_ACKNOWLEDGED=true` para eventual ativação; com feature desligada, endpoint responde `404` antes de acesso ao banco e a interface não é criada. Esses comportamentos são **descritos** na documentação de fundação; nesta rodada não foram executados testes nem verificado ambiente atual.

Testes indicados pelo quadro Codex, ainda **NÃO EXECUTADOS NESTA RODADA**:
- `platform/tests/child-profile-http-postgres.test.mjs`
- `platform/tests/family-profile-foundation.test.mjs`
- `platform/tests/responsible-registration-http-postgres.test.mjs`

Comprovar, em execução futura: feature desligada, isolamento entre contas, ausência de dado infantil em telemetria/marketing, falha segura, exclusão de dado ativo, restauração de backup, exportação e contestação. Guardar SHA, comando, ambiente e saída de cada teste.

## 3. Conflitos e perguntas para parecer
1. **Obrigatoriedade de perfil no cadastro:** demonstrar necessidade e proporcionalidade da data completa para marketplace de fraldas; avaliar cadastro adulto sem dados infantis e alternativa por faixa etária voluntária. A decisão do fundador é de produto, não base legal suficiente.
2. **Estados de conta:** cadastro inicial 1–5 perfis; remoção voluntária do último permite 0 perfis, preserva conta e bloqueia operações dependentes; expiração do último aos 13 anos permite vitrine geral. Evitar regras absolutas como “sempre 1–5 ativos”.
3. **Consentimento e base legal:** a manifestação do responsável não substitui exame de hipótese legal e melhor interesse por finalidade; revisar aviso destacado, revogação, marketing opcional e manutenção de evidências de consentimento por conta + 5 anos.
4. **Marketing:** somente faixa etária ampla, opt-in separado; data completa, identificador infantil e quantidade de crianças não podem ir ao fornecedor de e-mail. Confirmar necessidade da segmentação e risco de inferência.
5. **Geolocalização/ranking:** distância por centros de CEP e faixas 0–5/5–15/15–30/>30 km; avaliar precisão, termos de fornecedor e exposição de padrões familiares. Sem recomendações médicas e sem inferência de peso.
6. **Acesso humano:** excepcional, visualização por 15 minutos, dupla aprovação independente de Segurança e Privacidade, auditoria sem data. Testar expiração e privilégio mínimo.
7. **Disputa de responsabilidade:** escalonamento humano, suspensão somente após plausibilidade, prova opaca, exclusão documental até 30 dias após decisão; testar retenção.
8. **RIPD e piloto:** avaliação preliminar obrigatória antes de qualquer uso real; risco alto pode exigir RIPD completo antes mesmo do piloto restrito; abertura pública só após RIPD concluído e aprovado.
9. **Prazos de retenção:** data operacional apagada na remoção, backups até 30 dias, histórico de alteração 12 meses sem valor antigo, evidência minimizada do aceite durante a conta + 5 anos proposta; validação jurídica dos fundamentos e prova técnica externa pendentes.

## 4. Critérios para fechar cada bloqueio
- [ ] Inventário de campos, finalidade, fluxo, base legal, destinatário e retenção por tratamento.
- [ ] Parecer jurídico/LGPD sobre melhor interesse, necessidade da data exata e obrigatoriedade de perfil.
- [ ] Avaliação preliminar de riscos, RIPD conforme risco, responsáveis identificados e decisão.
- [ ] Termos e avisos versionados, aceites independentes e exercício de direitos acessível.
- [ ] Testes no SHA atual, inclusive fail-closed, exclusão, backup, acessos, fornecedores e logs.
- [ ] Contratos e DPA com operadores realmente selecionados, sem inferir contratação.
- [ ] Revisão profissional, assinatura e autorização de ativação separada.

## 5. Proposta de trabalho Codex sem ativação
Preparar testes adicionais de não regressão para cadastro sem perfil após remoção, expiração por idade, isolamento de sinais de marketing e falha segura de fornecedores; inspecionar código e emitir relatório com resultados reais **somente após executar**. Não alterar flag, contratar fornecedor, usar dados reais, executar pagamentos, nem promover requisito por esta minuta.

**Resultado:** seis bloqueios documentados com decisões, critérios e lacunas; **zero bloqueios liberados**.
