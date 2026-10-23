# Monitoramento e alertas — preparação anterior à ativação

O contrato `evaluateInfrastructureAlerts` classifica leituras já coletadas segundo os limites aprovados no plano de infraestrutura. Ele não coleta métricas, não envia mensagens e não conecta um fornecedor.

São avaliados CPU, memória, disco, taxa de erros da API, latência comum, idade do backup, validade do certificado e indisponibilidade. Os limites de atenção e crítico permanecem centralizados em `infrastructureAlertThresholds`.

Uma leitura só pode retornar `ok` quando contém as oito métricas, possui valores não negativos e foi observada nos últimos cinco minutos. Campo ausente, valor inválido, horário futuro ou leitura antiga produz `unknown`; portanto, ausência de telemetria nunca é convertida em saúde presumida. Alertas de atenção ou críticos também impedem `launchHealthy`.

Mesmo uma leitura local completa e saudável não autoriza lançamento. Antes da ativação real ainda são necessários: coletor no ambiente homologado, retenção aprovada, canal oficial de alerta, destinatários e escalonamento aceitos, teste humano de recebimento e prova de que dados pessoais e segredos não são exportados.

Validação sintética: `tests/infrastructure-alerts.test.mjs`. Os cenários não representam métricas de produção.
