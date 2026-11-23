# FC-354 — Restrições de consentimento e idade na personalização infantil

**Projeto:** FraldaCycle, repositório `bonecodesign/FRALDAScycle`. **Data:** 23/11/2026. **Escopo:** código técnico e testes sintéticos, com a funcionalidade infantil ainda desativada por padrão.

## Lacuna distinta do inventário histórico (PR #333)

O PR #333, ainda aberto, prepara uma contagem **somente leitura** de possíveis resíduos infantis antigos. FC-354 não consulta, altera ou apaga esses dados e **não** modifica aquele PR.

O método interno `createChildProfileService().personalizationSignals(actor)` já devolvia apenas faixas etárias únicas, sem nascimento, emoji ou identificador infantil, e exige uma conta familiar adulta com o recurso ativado. Entretanto, a seleção anterior verificava `personalization_enabled` e a inexistência de suspensão, **mas não** a versão vigente do consentimento armazenado. Além disso, um perfil que ultrapassasse 12 anos antes da execução do job de ciclo etário podia fazer `childAgeBand` lançar um erro ao processar a lista, afetando a personalização inteira.

## Proteção implementada

- Requer `consent_version === CHILD_PROFILE_CONSENT_VERSION` em cada linha **antes de derivar a faixa**. Um consentimento legado/desconhecido deixa de produzir sinais até regularização pelo fluxo autorizado.
- Preserva a exigência de `personalization_enabled === true` e ausência de suspensão.
- Usa **um único instante de referência** por consulta, evitando divergências em viradas de idade durante o processamento.
- Ignora datas inválidas, futuras ou fora do limite de 12 anos; não devolve faixa etária para esses registros e não mascara falhas inesperadas de outros tipos.
- Retorna somente objetos `{ ageBand }`, únicos e ordenados. Não gera avisos, rastreamento, campanhas, escrita, alteração de consentimento ou ativação de feature.

## Ensaios locais

`tests/child-personalization-age-signals.test.mjs` valida versões de consentimento atuais e antigas, opt-out, suspensão, deduplicação, corte etário antes do worker, nascimento inválido/futuro, acesso proibido por outros papéis e o estado desligado por padrão. O teste usa datas e identidades **fictícias**.

A suíte existente `tests/family-profile-foundation.test.mjs` continua cobrindo criação/atualização/remoção e `tests/account-consent-policy.test.mjs` permanece responsável pelo consentimento específico de marketing. Essa mudança **não** autoriza campanhas de marketing a partir de sinais internos, nem comprova proteção ponta a ponta com fornecedores.

## Portões que permanecem

PRIV-01...PRIV-07 (melhor interesse, finalidade, hipóteses legais, direitos, retenção, incidente e comunicação com parceiros) continuam pendentes de parecer e homologação humanos. Não alterar `CHILD_PROFILES_ENABLED`, não coletar dados reais e não promover itens da matriz automaticamente. **48/70 (68,57%), piloto BH NO-GO.**

Issue vinculada: [#229](https://github.com/bonecodesign/FRALDAScycle/issues/229).
