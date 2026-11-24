# FC-355 — Bloqueio de nomes alternativos de dados infantis na saída de marketing

**Projeto único:** FraldaCycle (`bonecodesign/FRALDAScycle`). **Data:** 23/11/2026. **Escopo:** contrato de proteção de payload com provas sintéticas, sem envio externo, coleta, integração de marketing ou ativação de funcionalidade infantil.

## Lacuna identificada

O contrato `packages/contracts/marketing-dispatch-policy.js` já proibia campos como `birthDate`, `child_profile_id`, `ageBand`, `profileId` e `emoji` em metadados enviados a parceiros, inclusive de forma aninhada. No entanto, o bloqueio usava comparação exata de nomes. Uma integração futura que utilizasse variações equivalentes, como `date_of_birth`, `childBirthDate`, `Faixa Etária` ou `dataNascimento`, não seria barrada por esse controle. Além disso, estruturas de objetos não serializáveis ou cíclicas não eram validadas previamente por esse filtro.

## Proteção preparada

- Normalização das chaves (maiúsculas, snake_case, kebab-case, espaços e acentos) antes de confrontá-las com uma lista explícita e conservadora de aliases de nascimento, identificadores, emoji, perfis e idade infantil.
- Busca recursiva pelos valores de metadados, mantendo o bloqueio de estruturas aninhadas e arrays.
- Recusa de referências circulares, instâncias de classes não JSON como `Date`/`Map` e profundidade superior a 32, em vez de retornar um payload para integração.
- Metadados legítimos com campos não infantis permanecem aceitos. Referências compartilhadas sem ciclo também permanecem válidas.
- Os sinais etários internos continuam separados da fronteira externa. O consentimento familiar específico ainda é obrigatório, e a entrega de marketing continua **não ativada**.

### Ensaios sintéticos

O teste `tests/account-consent-policy.test.mjs` recebeu matrizes de aliases em português e inglês, misturando estruturas e arrays aninhados, além de cenários de metadados não serializáveis, ciclos, profundidade excessiva e payload benigno. As provas devem ser validadas integralmente no CI antes do merge.

### Limites e riscos residuais

Este mecanismo reconhece **nomes de campos**, não identifica com segurança dados pessoais codificados em texto livre, chaves inesperadas, imagens ou outras representações. Por isso **não substitui** revisão de payloads reais, minimização por allowlist, homologação de fornecedores, contratos, revisão LGPD, inventário legado nem teste de envio. Não houve eliminação ou consulta de dados infantis históricos.

O PR #333 de inventário agregado de resíduos históricos permanece **aberto e intocado**. Os portões PRIV-01 a PRIV-07 e o requisito 28 continuam sob revisão humana. Matriz oficial: **48 concluídos, 11 parciais, 11 bloqueados (70 no total; 22 restantes)**; piloto BH permanece **NO-GO**. Nenhum outro projeto, banco hospedado ou fornecedor foi modificado.

Referência de acompanhamento: [issue #229](https://github.com/bonecodesign/FRALDAScycle/issues/229).
