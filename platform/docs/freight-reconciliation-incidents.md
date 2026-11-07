# Registro persistente de divergências locais de frete

Esta etapa aproveita a conciliação determinística de `freightSettlementReconciliation` e os planos de frete existentes. Não chama provedores, não realiza cobranças nem liquida repasses.

O setor financeiro autorizado pode registrar uma verificação explícita por `POST /v1/admin/freight-settlement-plans/:id/reconciliation/check` com `{"confirmed":true}`. O endpoint registra em PostgreSQL cada bloqueio **local** identificado, deduplicando incidentes abertos por plano e código. Repetir a verificação atualiza a data de última ocorrência, sem duplicar o incidente. Quando um bloqueio desaparece, a nova verificação resolve o registro aberto, preservando seu histórico. Caso o bloqueio volte, um novo incidente é aberto.

O bloqueio `external_reconciliation_not_homologated` não é resolvido nem registrado como incidente local: permanece como trava estrutural para qualquer repasse, mesmo que não haja divergências locais. A leitura GET original continua sem efeitos colaterais. O endpoint POST devolve o resultado local e os incidentes persistidos, sem dados bancários ou credenciais.

O registro de incidentes é evidência de observação interna, não confirmação de saldo no processador. Integração contratual, verificação externa de pagamentos, chargeback, regras de split e homologação seguem pendentes. Não há alteração de escopo ou de indicadores oficiais.
