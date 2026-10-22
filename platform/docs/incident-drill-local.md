# Ensaio local de resposta a incidentes — requisito 56

Este roteiro prepara uma sessão interna com dados fictícios. Sua existência não comprova que o ensaio humano ocorreu, nem autoriza operação real.

## Preparação

Registre, antes da sessão, a versão do código, ambiente isolado, horário de início, pessoa responsável pela triagem, responsável técnico por interrupção e rollback, substituto e canal interno de acionamento. Os papéis precisam ser aceitos pelos participantes; deixe o campo pendente enquanto isso não ocorrer. Use apenas contas, pedidos e identificadores sintéticos.

## Cenário: compra indisponível e suspeita de falha de cobrança

1. Simule uma falha que impeça um comprador fictício de concluir uma compra. Registre rota, horário, identificador sintético, impacto percebido e como reproduzir, sem senha, token, documento ou conteúdo pessoal.
2. Classifique o incidente. Qualquer exposição, acesso indevido, cobrança ou comunicação externa inesperada, ou perda de integridade é crítico e interrompe a sessão. Bloqueio de jornada essencial é alto. Dificuldade com alternativa segura é médio; defeito visual sem impedir tarefa é baixo.
3. Em ambiente isolado, use o controle administrativo de operações para pausar `payments` se houver suspeita de cobrança incorreta, ou `global` se o impacto não puder ser delimitado. Registre justificativa, confirmação, horário, domínio, versão do estado e evento de auditoria `operations.paused`. Não dispare pagamentos reais.
4. Confirme que a criação de novas intenções de pagamento recebe bloqueio, enquanto consulta, suporte e tratamento seguro das operações existentes continuam disponíveis. Se o bloqueio falhar, mantenha a sessão interrompida e registre o defeito.
5. Registre quem foi acionado, horário, hipótese, decisão de contenção, evidência preservada e critério objetivo para recuperação. Para possível incidente de dados pessoais, encaminhe avaliação de comunicação a titulares e autoridades ao responsável de privacidade/jurídico; não presuma prazo ou obrigação sem análise aplicável.
6. Após corrigir a causa em ambiente isolado, registre quem autorizou a retomada. Use o controle administrativo para retomar o domínio, com justificativa e confirmação, e verifique auditoria `operations.resumed`, disponibilidade da jornada fictícia e ausência de cobrança externa.

## Registro da execução

O registro pode ser validado localmente por `localIncidentDrill` em `packages/contracts/incident-drill.js`. O contrato exige ambiente isolado, dados exclusivamente sintéticos, três papéis definidos, classificação, evidência versionada de pausa, autorização e critério de retomada. Campos com nomes associados a senha, segredo, token, cookie ou documento são recusados para reduzir a captura acidental de dados sensíveis. Essa validação prepara o formulário do exercício; ela não substitui a sessão humana.

| Campo | Resultado da sessão |
| --- | --- |
| Versão, ambiente e horário | Pendente |
| Triagem e aceite do responsável | Pendente |
| Interrupção/rollback e substituto | Pendente |
| Cenário, impacto e classificação | Pendente |
| Pausa, versão e auditoria | Pendente |
| Suporte às operações existentes | Pendente |
| Privacidade/jurídico acionados, se aplicável | Pendente |
| Critério, autorização e prova da retomada | Pendente |
| Achados, responsável e prazo | Pendente |

Os testes `tests/incident-drill-contract.test.mjs`, `tests/operational-control.test.mjs` e `tests/operational-control-postgres.test.mjs` verificam o registro e os controles técnicos. A conclusão do requisito exige responsáveis aceitos, exercício observado e registros reais da sessão interna.
