# FC-DEC-2026-10-29 — Estrutura interna mínima para incidentes

## Estado

Aprovada pelo fundador em 29 de outubro de 2026. Esta decisão define o modelo de papéis; não registra aceite individual, nomeação nominal nem execução do exercício.

## Decisão

O exercício interno e a futura resposta operacional usarão quatro funções segregadas:

1. **Fundador — triagem e decisão final:** recebe a ocorrência, confirma a classificação inicial e registra a decisão de continuidade, repetição ou `no-go`.
2. **Responsável técnico — contenção e recuperação:** pausa o domínio afetado, coordena diagnóstico, aplica a correção e executa a retomada ou o rollback autorizado.
3. **Substituto técnico:** assume integralmente a função técnica quando o titular estiver indisponível.
4. **Observador independente:** acompanha e valida o exercício sem operar os controles de contenção, retomada ou decisão final.

As pessoas que aceitarem triagem, responsabilidade técnica e substituição devem ser distintas. O observador também deve ser diferente desses três participantes. O fundador não acumula a função técnica durante o exercício validado.

## Condições para registrar o exercício como concluído

- aceite individual e datado de cada participante;
- evidência técnica íntegra do ensaio sintético;
- observação humana independente;
- decisão formal com justificativa;
- resolução de todos os achados altos ou críticos antes de resultado `passed`.

O exercício concluído não autoriza lançamento. Produção e piloto financeiro continuam sujeitos aos demais portões de ativação.

## Frequência

- executar um exercício observado antes do piloto;
- repetir a cada seis meses enquanto a plataforma estiver em operação;
- executar um exercício extraordinário após mudança material nos controles de pagamento, autenticação, privacidade ou recuperação, ou depois de incidente real alto ou crítico;
- contar o próximo período semestral a partir da data do último exercício humano concluído, e não de simulações automatizadas.

O exercício extraordinário não elimina o registro da cadência semestral; a equipe pode adotá-lo como novo marco somente quando cumprir integralmente os mesmos critérios de evidência e aceite.

## Cenários obrigatórios

Cada exercício pré-piloto e semestral deve cobrir, em ambiente isolado e com dados exclusivamente sintéticos, os três cenários abaixo:

1. **Falha de pagamento com suspeita de cobrança:** pausar `payments`, impedir novos compromissos financeiros, preservar consulta e suporte às operações existentes, confirmar inexistência de cobrança externa, recuperar e testar rollback.
2. **Exposição simulada de dados:** conter o domínio afetado, preservar evidência sem copiar segredo ou dado pessoal, acionar o fluxo interno de privacidade/jurídico e registrar a avaliação simulada. O exercício não autoriza nem envia comunicação a titular ou autoridade.
3. **Falha crítica de entrega:** pausar novos compromissos logísticos, preservar acompanhamento e suporte das entregas existentes, testar indisponibilidade do parceiro externo e continuidade segura pelo fluxo interno elegível, sem chamar fornecedor ou entregador real.

Os três cenários precisam produzir evidência separada e decisão registrada. Um resultado aprovado em um cenário não compensa falha ou achado alto/crítico aberto nos demais.

## Autorização progressiva de retomada

### Fase inicial — aprovação conjunta

Durante a preparação e o piloto, toda retomada após incidente alto ou crítico exige aprovação conjunta do fundador e do responsável técnico. A ausência, recusa ou indisponibilidade de qualquer um mantém o domínio pausado. O substituto técnico pode ocupar a posição do responsável técnico quando houver indisponibilidade formalmente registrada.

### Fase madura — autonomia técnica controlada

Depois de uma transição formal ainda não autorizada, o responsável técnico — ou seu substituto formal — poderá autorizar a retomada operacional sem aguardar nova aprovação do fundador, desde que:

- o critério técnico de recuperação esteja objetivamente atendido;
- não exista achado alto ou crítico aberto;
- a verificação pós-retomada e o rollback automático estejam disponíveis;
- decisão, evidência e identidade do autorizador sejam auditadas;
- o fundador seja comunicado e a decisão passe por revisão posterior.

A aprovação desta política não ativa a fase madura. Até que o marco de transição seja escolhido, documentado e cumprido, prevalece exclusivamente a aprovação conjunta da fase inicial.

### Marco aprovado para a fase madura

A autonomia técnica somente poderá ser considerada quando as duas condições cumulativas forem comprovadas:

1. dois exercícios humanos completos, observados e aprovados, cobrindo os três cenários obrigatórios; e
2. pelo menos 90 dias de piloto sem incidente crítico.

Cumprir o marco não altera a autorização automaticamente. O fundador deve registrar a decisão formal de transição, a data de vigência e as identidades do responsável técnico e do substituto. Incidente crítico durante a janela reinicia a contagem de 90 dias após sua resolução formal. Exercício reprovado ou com achado alto/crítico aberto não conta para o total de dois.

Depois da transição, um incidente crítico, evidência adulterada, rollback indisponível ou exercício semestral vencido suspende a autonomia técnica e restaura a aprovação conjunta até nova decisão formal.

## Comunicação ao fundador na fase madura

- **Crítico:** aviso imediato e acompanhamento direto do fundador desde a contenção; a autonomia técnica é suspensa e volta a valer a aprovação conjunta.
- **Alto:** aviso ao fundador em até duas horas, sem aguardar o relatório final.
- **Médio ou baixo:** registro em relatório operacional em até 24 horas.

Os prazos são limites máximos, não justificativa para atrasar aviso quando houver risco crescente. Todo aviso deve referenciar o incidente e sua severidade sem incluir senha, token, documento, dado infantil ou outra informação sensível desnecessária.

## Canais e ações pelo WhatsApp

Os avisos ficam registrados no painel interno e são enviados por e-mail. Incidentes críticos também devem acionar o número autorizado do fundador pelo WhatsApp, após contratação e homologação de um canal oficial.

O WhatsApp pode oferecer ações estruturadas, nunca comandos por texto livre:

- **Bloquear agora:** confirma uma pausa preventiva do domínio indicado. Por ser uma ação conservadora, pode ser iniciada no botão assinado da mensagem, com idempotência, validade curta e auditoria da identidade, horário, incidente e resultado.
- **Analisar/autorizar retomada:** abre um link universal de uso único para a área autenticada da FraldaCycle. A retomada exige login, segundo fator, incidente ainda válido e o modelo de aprovação vigente — conjunto na fase inicial ou técnico na fase madura.
- **Manter bloqueado:** registra a decisão sem retomar o domínio.

Não será permitido enviar `retomar`, `resolver`, senhas, códigos ou justificativas sensíveis como texto no WhatsApp. O canal não executa diagnóstico nem correção técnica; ele alerta, permite contenção segura e encaminha a decisão autenticada. A mensagem deve mostrar apenas referência opaca, severidade, domínio afetado, horário e link oficial.

Falha, atraso ou indisponibilidade do WhatsApp não altera o estado operacional nem autoriza retomada. Painel interno e e-mail continuam como registro principal. Número, provedor, template, webhook assinado, segundo fator e homologação real permanecem pendentes de ativação externa.

### Provedor escolhido

A integração futura usará **Meta WhatsApp Cloud API**. O código deve permanecer atrás de um adaptador interno e feature flag, sem credenciais ou envio habilitado por padrão. Antes da ativação serão necessários conta empresarial, número oficial, templates aprovados, webhook verificado e assinado, segredo em cofre, política de rotação, contato autorizado, teste de entrega e homologação do fluxo completo.

O painel técnico atual está em `/admin/operations`. Ele já oferece pausa e retomada por domínio com justificativa e auditoria. A gestão completa do incidente, aprovação conjunta, segundo fator, tokens de ação e vínculo com WhatsApp ainda precisa ser implementada; a escolha do fornecedor não significa integração ativa.

## Pendências humanas

- indicar as pessoas que ocuparão as quatro funções;
- registrar o aceite de cada uma;
- agendar e executar a sessão observada com dados exclusivamente sintéticos.
