# Pré-validação técnica do piloto — histórico de 30/10/2026 e retificação de 17/11/2026

**Situação vigente em 17/11/2026:** **16 das 21 evidências aprovadas, cinco pendentes, piloto BH NO-GO.** Fonte atual: [manifesto](../config/pilot-technical-preflight.v1.json), [registro histórico](../config/pilot-evidence.v1.json), [validador](../tools/pilot-technical-preflight.mjs) e [status consolidado](status-atual-2026-11-17.md).

## Correção do relatório anterior

O texto de 30/10 e seus adendos de 07/11 citavam **19/21 evidências** e apenas duas verificações humanas pendentes. Essa avaliação **não representa mais a classificação vigente**. A [PR #300](https://github.com/bonecodesign/FRALDAScycle/pull/300) corrigiu a contagem, pois uma evidência com estado `failed` e quatro com estado `skipped` estavam sendo consideradas tecnicamente cobertas.

O registro original da rodada de 02/10 permanece histórico, **sem aprovação retroativa**: **16 `passed`, 1 `failed` e 4 `skipped`**. A pré-validação atual conta **16 cobertas e 5 pendentes**, exigindo estado `passed` para todas as cobertas. Os cinco IDs ainda pendentes são:

1. `publish-search-negotiate`: publicação completa, moderação, busca e negociação ainda não comprovadas em uma mesma sessão de homologação com mídia válida.
2. `keyboard-check`: o cenário de acessibilidade do manifesto requer nova execução formal e evidência correspondente.
3. `device-matrix`: viewport emulado não substitui dispositivos físicos nem um aceite abrangente de matriz.
4. `screen-reader-check`: faltam sessão com leitor de tela e observação **humana** documentadas.
5. `rollback-owner`: faltam nomeação e aceite reais de responsável técnico e substituto, com segregação de papéis.

## Novas regressões não promovem evidências automaticamente

As PRs [#301](https://github.com/bonecodesign/FRALDAScycle/pull/301)–[#304](https://github.com/bonecodesign/FRALDAScycle/pull/304) corrigiram os preços e ampliaram validação, idempotência, rótulos, navegação por teclado e testes no Chromium. A PR #304 verificou **oito etapas em quatro larguras (32 cenários de navegador)**, consulta negativa de busca, preço informado no rascunho e bloqueio de chat sem pagamento. O CI [#44193763114](https://github.com/bonecodesign/FRALDAScycle/actions/runs/44193763114) aprovou todos os **cinco** jobs exigidos.

Isso é **evidência técnica adicional**, mas não demonstra upload de fotografia por fornecedor homologado, publicação até revisão administrativa, anúncio visível ao comprador, negociação completa, leitor de tela humano nem dispositivo físico. Portanto, **nenhum dos cinco IDs foi reclassificado por este documento**.

## Portões permanentes

`humanValidationComplete=false`, `launchAuthorized=false`, `syntheticDataOnly=true`, `externalIntegrationsAllowed=false`, `realTransactionsAllowed=false` e `publicAccessAllowed=false` permanecem obrigatórios. O requisito **67 continua parcial**. Nenhuma evidência documental ou sintética dispensa validação dos fornecedores, privacidade, jurídico, suporte, segurança, recuperação e decisão formal de GO/NO-GO.

O procedimento para leitores de tela, nomeação/aceite e ensaio humano de rollback permanece em [homologação humana](pilot-bh-human-homologation.md). Não registrar dados identificáveis dos avaliadores no repositório público.
