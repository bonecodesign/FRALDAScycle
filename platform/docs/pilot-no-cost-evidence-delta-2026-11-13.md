# FraldaCycle — delta de evidências para piloto sem contratação

**Data:** 2026-11-13. **Status:** plano de execução e revisão, não execução de testes nem aprovação de requisito.

## Fonte e limites
Conferir o HEAD atual de `main` e `platform/docs/requirements-matrix.json` antes de usar. Fotografia consultada: **43/70 concluídos, 16 parciais, 11 bloqueados (61,43%)**, 27 pendências. `platform/config/codex-action-board.v1.json` já reflete esses números. Não reverter o quadro para a fotografia antiga de 42/70.

Este documento **não cria novos requisitos**; especifica o delta verificável de sete requisitos parciais que já possuem testes e runbooks. Reaproveitar os arquivos existentes, evitando duplicação.

| ID | Evidência técnica já descrita na matriz | Próximo trabalho executável sem custos | Impedimento que continua externo/humano |
|---|---|---|---|
| 41 — Contatos nos anúncios | Proteção de texto, contrato de imagem fail-closed | Reexecutar testes de moderação e de ausência/timeout/erro do OCR; anexar saída e SHA; avaliar cobertura de imagens sintéticas | OCR/moderação visual real, qualidade em mídia real, revisão de privacidade |
| 45 — Exclusão da conta | Inventário e plano de retenção | Ensaiar concorrência, idempotência, pendências de purga e recusa de encerramento prematuro no PostgreSQL sintético | Bases/prazos jurídicos, identidade humana, comprovantes externos e purga homologada |
| 49 — Avisos operacionais | Geração, transporte protegido, contrato push | Reexecutar testes de redirecionamento, destinatário, retries e dispositivo ausente; provar nenhuma mensagem externa | Fornecedor, SDK, permissão de SO, dispositivo real e templates aprovados |
| 56 — Incidentes | Console, gates e adaptador Meta inativo | Validar cronologia de aceites sintéticos, trilha de auditoria, falha segura e rollback; preparar roteiro humano sem simular assinaturas | Parecer, canal real, responsáveis e exercício humano independente |
| 57 — Backup | Adaptador protegido, objetivos e runbook | Testar checksum, restauração local, indisponibilidade e URL insegura; registrar RPO/RTO **medidos apenas localmente** | Bucket/KMS/cofre, agenda e restauração em infraestrutura homologada |
| 59 — Credenciais | Allowlist, segregação, rotação/revogação contratual | Testar fail-closed, rejeição de redirecionamento, vazamento em logs e ausência de fallback | Cofre, identidades, rotação e revogação reais |
| 67 — Piloto BH | 19 evidências técnicas sintéticas, piloto desligado | Validar integridade das 21 posições, critérios de sete gates, teclado/contraste automatizáveis e rejeição de GO falso | Leitor de tela real, rollback aceito, responsáveis e GO/NO-GO humano |

## Critério de execução para o Codex

1. Em branch nova, selecionar **um** dos sete IDs e ler a linha completa da matriz, arquivos referenciados e PRs recentes.
2. Executar os testes existentes antes de adicionar outros; anotar comando, resultado, commit SHA e ambiente.
3. Só implementar uma regressão se houver lacuna reproduzível; não criar testes redundantes.
4. Em PR pequeno, registrar evidências **observadas**, limitações e risco residual. Exigir `foundation`, `listing-postgres`, `containers`, `browser-postgres` verdes no head exato.
5. Se restar dependência externa ou humana, manter `parcial`/`bloqueado`. **Não promover** status por documento, teste sintético ou CI isolado.
6. Não ativar provedores, gastar, publicar, enviar notificações, usar credenciais ou dados pessoais reais; alterações apenas em `platform/`. Não implementar orquestração autônoma.
7. Se alguma evidência já existir em PR integrado, **apontar a referência** em vez de refazê-la.

## Ordem sugerida
**Primeiro 59 e 57** (infraestrutura/segurança local), depois **45 e 41** (privacidade e moderação), depois **49 e 56** (comunicação e incidentes), finalmente **67** (agregação de prontidão). Ordem revisável após conferir falhas reais e CI.

## Portões e porcentagem
O piloto BH continua **NO-GO**. A meta planejada de 49/70 = 70% exige **seis novas conclusões comprovadas**, não seis PRs. A aprovação interna do fundador não substitui revisão jurídica/LGPD, aceite operacional, fornecedor homologado ou exercício humano.

## Handoff da conversa
Conferir também a PR #236 (passagem de decisões PRIV-05), que pode ainda não estar integrada. Não presumir merge ou aprovação de seus gates.
