# Pré-validação técnica do piloto — 30 de outubro de 2026

O contrato `config/pilot-technical-preflight.v1.json` classifica as 21 evidências do roteiro sem reescrever a execução histórica de 2 de outubro. A cobertura técnica atual é 19/21, exclusivamente com dados sintéticos e serviços locais.

A correção do preço informado na publicação está protegida por testes de interface e validação. O CI remoto #1439 aprovou fundação, PostgreSQL, containers e navegador; o navegador executou comandos de teclado e múltiplas larguras. Isso permite retirar da lacuna técnica a falha antiga de preço, o teste por teclado e a matriz de viewports simulados.

Continuam pendentes `screen-reader-check`, que exige tecnologia assistiva e observação humana, e `rollback-owner`, que exige nomeação e aceite de pessoas distintas. Dispositivo físico e sessão com participantes também não são alegados por esta pré-validação.

O validador mantém `humanValidationComplete=false` e `launchAuthorized=false`. Qualquer tentativa de autorizar lançamento, habilitar integração externa ou remover as duas pendências faz a validação falhar. O resultado não altera o NO-GO nem o estado parcial do requisito 67.

## Validação adicional do registro — 07/11/2026

A pré-validação isolada rejeita agora identificadores ausentes, vazios ou duplicados, tanto no catálogo original de 21 evidências quanto nas listas de 19 itens com cobertura técnica e dois itens pendentes. Um identificador repetido não pode inflar nem mascarar a cobertura por efeito da deduplicação de `Set`. Listas que não sejam arrays também falham fechadas, em vez de serem interpretadas como cobertura válida.

Testes sintéticos exercitam duplicatas, entrada malformada e registro inconsistente. **Não houve aumento de cobertura:** permanecem 19/21 evidências técnicas e pendem observação por leitor de tela e nomeação/aceite do responsável pelo rollback. `humanValidationComplete=false` e `launchAuthorized=false` continuam obrigatórios. O requisito 67 permanece parcial, e o piloto BH continua NO-GO.
