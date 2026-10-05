# Alteração controlada de endereço pelo suporte

Somente platform/. Fluxo de venda já compartilhado; não substitui homologação de troca/doação ou transportadora.

O titular escolhe outro endereço próprio, confirma novamente FC-ADDRESS-1, informa motivo e versão vigente. A solicitação cria protocolo único de suporte e cópia privada do endereço solicitado; o destinatário continua vendo somente o endereço aprovado. Consulta do pedido é restrita ao titular ou suporte autorizado, auditada e sem cache. Não expõe endereço completo em listagens, protocolos ou auditoria.

Suporte com admin:support:write analisa e justifica; o próprio titular não pode aprovar seu pedido mesmo tendo papel administrativo. Aprovação revalida pagamento, ausência de ocorrência financeira, estado antes da coleta, destinatário original e versão sob trava. Registro original imutável, revisão numerada e consentimento preservados; address_shared_at não muda e cancelamento direto continua bloqueado. Repetição de pedido/revisão conserva o histórico; payload divergente ou versão superada conflita. Recusa fica no protocolo e não altera endereço.

Aprovação de retirada antes da coleta pode ser executada sem fornecedor. Entregas que precisam atualizar rota externa retornam indisponibilidade até integração homologada; não se altera só o banco para simular rota atualizada. Após coleta/finalização, o pedido segue análise de ocorrência pelo suporte, sem alteração automática. Não há pagamento, preço de alteração, reembolso, mensagem externa ou transportadora acionada.

Telas de Endereços e Alteração permitem solicitar/acompanhar. Pessoa de suporte autenticada acessa na mesma tela a consulta privada e a análise; permissão efetiva é sempre conferida pela API. Não exige cadastrar telefone, documento ou dados de crianças.

Validação local: dois testes do serviço, sintaxe de 93 arquivos e diff. PostgreSQL/Chrome locais indisponíveis. CI preparado para migração 026, protocolo concorrente, isolamento, revisão independente/idempotente, versão obsoleta, conservação do registro, bloqueio após coleta e auditoria mínima. Chrome preparado para pedido e aprovação com teclado e quatro larguras; execução aprovada no commit 1b0d8c8: 271 testes, 83 verificações e sintaxe de 93 arquivos. PostgreSQL executou as verificações de protocolo, concorrência, isolamento, versões, revisão independente e histórico; Chrome 154 executou pedido e aprovação pelo suporte com Space/Tab/Enter em 320, 375, 768 e 1280 pixels, sem overflow. Evidência: job 111796766311. Testes humanos/leitor de tela/dispositivos não executados.

Retenção e exclusão de cópias/histórico dependem da revisão jurídica/privacidade; nenhum prazo foi inventado. Item 23 continua parcial por troca/doação/fornecedor/retenção. Matriz: 7/70 = 10%; produção bloqueada; item 12 standby e termos reais rascunhos.
