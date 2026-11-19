# FC-322 — Triagem humana de suporte e atenção aos prazos de primeira resposta

**Data:** 18/11/2026. **Autoridade:** política aprovada em `docs/decisions/FC-DEC-2026-11-14-autoridade-final-fundador.md`. **Escopo:** sistema técnico interno, sem plantão humano real, disparos de mensagens, criação automática de incidentes ou pausa operacional.

## Entregue em `platform/`

- O ticket existente ganha `priority` (`critical`, `high`, `normal`, `low`), classificação `priority_classified_at/by`, `first_response_due_at` e `first_response_at`. **Default normal não equivale a uma classificação realizada**: enquanto `priority_classified_at IS NULL`, o item é exibido como `Triagem pendente` e não tem prazo fictício de escalonamento.
- `POST /v1/support/tickets/:id/priority`, **restrito a pessoal autorizado (nível >=1)**, exige justificativa, armazena a justificativa no repositório de **notas internas** e registra evento de auditoria sem texto sensível. Alterar a criticidade não reabre ticket resolvido nem muda seu estado de pagamento, entrega ou incidente. Repetição da mesma classificação não gera novo evento.
- O vencimento nasce de **created_at original do ticket**, inclusive se a prioridade mudar mais tarde; não reinicia relógios em reclassificação ou mensagem do solicitante. Atendimento humano pelo backend grava `first_response_at` na primeira resposta efetiva. O cliente **não pode** escolher ou modificar o estado, a prioridade ou a identidade da equipe.
- Metas matemáticas versionadas em `packages/contracts/support-priority.js`: **crítico 30 min corridos** (inclusive fora do horário de atendimento); **alto 4 h de janela operacional**; **normal 1 dia operacional (12 h de janela)**; **baixo 2 dias operacionais (24 h de janela)**. A janela é **segunda–sábado 08:00–20:00 em America/Sao_Paulo**; domingos são excluídos dos três últimos níveis. Os cálculos preservam segundos e evitam criar prazo fictício antes de triagem humana. A equivalência de dia operacional a 12h é uma **regra técnica de cálculo sujeita a validação de aderência** antes da operação real, não um SLA contratado.
- `GET /v1/support/attention` consulta casos **classificados, ativos, não respondidos e vencidos** com acesso restrito ao suporte; ordena prioritariamente criticidade e vencimento. Traz `critical_overdue` e `overdue_total` para **avaliação humana**, sem enviar mensagens ou pausar novas operações. `externalDispatchAuthorized=false` e `automaticPauseAuthorized=false` fazem parte do contrato.
- As telas `/admin/operations` e `/admin/launch` apresentam classificação e ordenação por criticidade. `/admin/operations` inclui consulta de prazos vencidos com encaminhamento ao protocolo. Informações internas e nome de quem classificou não vazam para o solicitante, e o chat de suporte continua separado do chat de negociação.

## Relação com o console de incidentes

`operational_incidents`, as notificações críticas, papéis de responsáveis e a pausa/reabertura com aprovação em níveis **já existem**. FC-322 **não** replica esse console ou cria incidentes sintéticos como se fossem reais. Em uma futura integração supervisionada, suporte poderá solicitar avaliação de incidente e ativação de alertas para titulares/substitutos, nível 4 e nível 5. **Sem pessoas nomeadas, canais externos homologados, evidências de plantão e política de prevenção de alarmes**, não haverá expedição, plantão falso, triagem automática por IA ou pausa do marketplace.

## Cenários novos a verificar uma única vez

- Primeiro prazo atravessando horário de fechamento, sábado/domingo e limite dos segundos, inclusive crítico fora de expediente;
- usuário comum não altera prioridade e não consulta fila administrativa; prioridade/justificativa não são aceitas por mensagem do cliente;
- justificativa e revisão da criticidade em transação auditada, sem reinício do relógio; duplicate/replay não duplica evento;
- primeiro retorno humano elimina item da fila de atrasados; os clientes não recebem dados privados da pessoa classificadora;
- UI administrativa apresenta a classificação, prazos e atenção sem ligar avisos externos;
- toda aplicação de migração 173 no banco hospedado deve ocorrer **após** CI verde/merge, com histórico/checksum preservados, e verificação de segurança RLS.

## Limites / gates

Esta entrega não conclui os requisitos **49** (avisos externos), **51** (suporte externo), **56** (incidentes com pessoas), **57** (backup) ou **67** (piloto BH). A matriz permanece **48/70 = 68,57%** e o lançamento em **NO-GO**, até a prova independente exigida em cada requisito. Não existem mensagens, reembolsos, pagamentos, decisões de incidente ou interrupções operacionais automáticas neste pacote.
