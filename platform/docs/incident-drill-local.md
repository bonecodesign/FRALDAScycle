# Ensaio local de resposta a incidentes — requisito 56

Este roteiro prepara uma sessão interna com dados fictícios. Sua existência não comprova que o ensaio humano ocorreu, nem autoriza operação real.

## Estrutura de responsabilidade aprovada

O modelo interno mínimo foi aprovado em 29 de outubro de 2026 e está registrado em `docs/decisions/FC-DEC-2026-10-29-responsaveis-incidentes.md`: fundador na triagem e decisão final, responsável técnico pela contenção e recuperação, substituto técnico e observador independente. As quatro funções não podem ser acumuladas na sessão validada. O exercício deve ocorrer antes do piloto e, depois, a cada seis meses, com execução extraordinária após mudanças materiais ou incidentes altos/críticos. Nomes, aceites e exercício humano continuam pendentes.

Na fase inicial, a retomada exige aprovação conjunta do fundador e do responsável técnico. A futura autonomia do responsável técnico permanece inativa até dois exercícios humanos aprovados, 90 dias de piloto sem incidente crítico e decisão formal do fundador. A autonomia volta a ser suspensa diante dos gatilhos definidos na decisão operacional.

Na fase madura, o fundador é avisado imediatamente sobre incidente crítico, em até duas horas sobre incidente alto e por relatório em até 24 horas sobre incidente médio ou baixo. Incidente crítico suspende a autonomia técnica e restaura a aprovação conjunta.

O canal crítico previsto é painel interno, e-mail e WhatsApp oficial. No WhatsApp, um botão pode iniciar bloqueio preventivo; qualquer retomada abre a área autenticada da FraldaCycle e exige segundo fator e as aprovações vigentes. Texto livre nunca autoriza ação operacional. Até a contratação e homologação do canal oficial, o WhatsApp permanece inativo.

O painel técnico `/admin/operations` já registra incidentes, atribuição, contenção, monitoramento, resolução e histórico. Também pausa separadamente novas cobranças, reembolsos e preparação de repasses, sem editar saldo ou executar transferência. Aprovação conjunta, segundo fator e WhatsApp permanecem gates posteriores.

## Preparação

Registre, antes da sessão, a versão do código, ambiente isolado, horário de início, pessoa responsável pela triagem, responsável técnico por interrupção e rollback, substituto e canal interno de acionamento. Os papéis precisam ser aceitos pelos participantes; deixe o campo pendente enquanto isso não ocorrer. Use apenas contas, pedidos e identificadores sintéticos.

## Cenários obrigatórios

O exercício abrange três cenários independentes: falha de pagamento com suspeita de cobrança, exposição simulada de dados e falha crítica de entrega. Cada cenário gera evidência e decisão próprias. Nenhum deles pode acionar transação, comunicação, fornecedor, entregador ou usuário real.

### Cenário 1: compra indisponível e suspeita de falha de cobrança

1. Simule uma falha que impeça um comprador fictício de concluir uma compra. Registre rota, horário, identificador sintético, impacto percebido e como reproduzir, sem senha, token, documento ou conteúdo pessoal.
2. Classifique o incidente. Qualquer exposição, acesso indevido, cobrança ou comunicação externa inesperada, ou perda de integridade é crítico e interrompe a sessão. Bloqueio de jornada essencial é alto. Dificuldade com alternativa segura é médio; defeito visual sem impedir tarefa é baixo.
3. Em ambiente isolado, use o controle administrativo de operações para pausar `payments` se houver suspeita de cobrança incorreta, ou `global` se o impacto não puder ser delimitado. Registre justificativa, confirmação, horário, domínio, versão do estado e evento de auditoria `operations.paused`. Não dispare pagamentos reais.
4. Confirme que a criação de novas intenções de pagamento recebe bloqueio, enquanto consulta, suporte e tratamento seguro das operações existentes continuam disponíveis. Se o bloqueio falhar, mantenha a sessão interrompida e registre o defeito.
5. Registre quem foi acionado, horário, hipótese, decisão de contenção, evidência preservada e critério objetivo para recuperação. Para possível incidente de dados pessoais, encaminhe avaliação de comunicação a titulares e autoridades ao responsável de privacidade/jurídico; não presuma prazo ou obrigação sem análise aplicável.
6. Após corrigir a causa em ambiente isolado, registre quem autorizou a retomada. Use o controle administrativo para retomar o domínio, com justificativa e confirmação, e verifique auditoria `operations.resumed`, disponibilidade da jornada fictícia e ausência de cobrança externa.

### Cenário 2: exposição simulada de dados

1. Use somente um registro fictício sem nome, contato, documento, nascimento, credencial ou segredo real.
2. Pause o domínio afetado, preserve referência e hash da evidência e confirme que novas operações de risco foram bloqueadas.
3. Registre o acionamento simulado de privacidade/jurídico e a necessidade de avaliar titulares e autoridades, sem presumir obrigação, prazo aplicável ou enviar comunicação.
4. Retome apenas após confirmar contenção, remoção do acesso indevido sintético e ausência de cópias desnecessárias.

### Cenário 3: falha crítica de entrega

1. Simule indisponibilidade do parceiro externo sem chamar sua API e sem designar pessoa real.
2. Pause novos compromissos logísticos e confirme que acompanhamento, suporte e pagamentos já devidos continuam disponíveis.
3. Verifique o caminho seguro para entregador elegível da própria plataforma usando somente identidades sintéticas; o exercício não cria entrega real.
4. Retome apenas após a sonda logística sintética passar; se a verificação posterior falhar, reaplique a pausa e registre o rollback.

## Registro da execução

### Retomada com aprovação conjunta

A retomada operacional começa com proposta autenticada de um responsável interno entre os níveis 2 e 4. A proposta não altera o estado pausado. Somente o fundador nível 5, em sessão separada e com nova confirmação por senha e código de e-mail, pode autorizar ou rejeitar. O fundador não pode propor e autorizar a mesma retomada; mudança concorrente de versão invalida a solicitação.

As funções de responsável técnico, substituto técnico e observador independente são nomeadas pelo fundador com autenticação reforçada. Cada função exige uma pessoa distinta e só fica ativa após aceite pessoal, também com senha e código por e-mail. Nenhuma pessoa é preenchida automaticamente.

O adaptador futuro da Meta WhatsApp Cloud API permanece desligado por padrão. O template crítico contém somente a referência do incidente e um link sem credenciais para o painel. Mensagens de texto recebidas nunca pausam, retomam, aprovam ou rejeitam operações. Mesmo após abrir o link, a decisão exige sessão autenticada, solicitação ainda pendente, senha e código por e-mail no painel.

Ao registrar incidente crítico, o banco cria automaticamente avisos de e-mail somente para o fundador e para as funções de resposta já aceitas, desde que tenham e-mail verificado. O payload contém referência, severidade, domínio e caminho do painel, nunca o resumo potencialmente sensível. A fila não comprova entrega externa.

O registro pode ser validado localmente por `localIncidentDrill` em `packages/contracts/incident-drill.js`. O contrato exige ambiente isolado, dados exclusivamente sintéticos, três papéis definidos, classificação, evidência versionada de pausa, autorização e critério de retomada. Campos com nomes associados a senha, segredo, token, cookie ou documento são recusados para reduzir a captura acidental de dados sensíveis. Essa validação prepara o formulário do exercício; ela não substitui a sessão humana.

O executor `runSyntheticIncidentDrill` em `apps/api/incident-drill-runner.js` encadeia a prova técnica sem efeitos externos. Ele pausa o domínio, confirma o bloqueio de novos compromissos, exige uma sonda separada para continuidade segura e outra para recuperação, retoma somente após autorização e reaplica automaticamente a pausa quando a verificação pós-retomada falha. Falhas anteriores à retomada deixam o domínio pausado. O registro acrescenta explicitamente que nenhum fornecedor, pagamento, usuário ou mensagem real foi acionado.

Depois do ensaio, `createIncidentDrillEvidence` em `apps/api/incident-drill-evidence.js` pode empacotar o registro validado com um resumo SHA-256 determinístico. `verifyIncidentDrillEvidence` detecta alteração posterior do conteúdo. O envelope declara seus próprios limites: é evidência técnica local e não comprova sessão humana, go-live ou operação externa. Na sessão real, preserve também participantes, observação e aceite pelos canais internos aprovados; o hash não substitui esses registros.

`assessIncidentDrillSignoff` em `apps/api/incident-drill-signoff.js` mantém esse limite verificável. O exercício humano só fica `complete` quando há evidência técnica íntegra, aceite individual e datado para triagem, responsável técnico e substituto, observador independente e decisão formal. Papéis acumulados, observação ausente, evidência alterada ou achado alto/crítico aberto impedem uma decisão `passed`. Mesmo completo, o resultado retorna `launchAuthorized: false`: o lançamento possui portão próprio e não é autorizado pelo ensaio.

| Campo | Resultado da sessão |
| --- | --- |
| Versão, ambiente e horário | Pendente |
| Triagem e aceite do responsável | Pendente |
| Interrupção/rollback e substituto | Pendente |
| Três cenários, impactos e classificações | Pendente |
| Pausa, versão e auditoria | Pendente |
| Suporte às operações existentes | Pendente |
| Privacidade/jurídico acionados, se aplicável | Pendente |
| Critério, autorização e prova da retomada | Pendente |
| Achados, responsável e prazo | Pendente |

Os testes `tests/incident-drill-contract.test.mjs`, `tests/incident-drill-runner.test.mjs`, `tests/incident-drill-evidence.test.mjs`, `tests/incident-drill-signoff.test.mjs`, `tests/operational-control.test.mjs` e `tests/operational-control-postgres.test.mjs` verificam o registro, a integridade da evidência, o bloqueio de falso encerramento, a contenção, a retomada e o rollback seguro. A conclusão do requisito exige responsáveis aceitos, exercício observado e registros reais da sessão interna.
