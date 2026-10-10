# Contato e situação do repasse na interface do entregador

O painel oferece Consultar contato e repasse para entregas ativas da própria conta. Selecionar revalida a atribuição e a integridade da página antes de abrir /courier/job. Consultas são explícitas e GET, usam a sessão e têm limite de 15 segundos. A tela não solicita preparação financeira nem inicia pagamento.

Contato usa /v1/shipments/:id/contact. O servidor continua restringindo o entregador atribuído, telefone verificado, estado ativo da entrega e estado financeiro/operacional admitido. Apenas nome, telefone e finalidade autorizados aparecem, por textContent. A doação em donation_confirmed permanece sem contato nessa consulta antes da coleta; após coleta, in_delivery permite o contato do recebedor quando verificado. Nenhuma autorização nova foi criada.

Repasse usa /v1/shipments/:id/courier-payout. Estados conhecidos not_prepared/provider_pending, pendências e valores registrados são exibidos sem prometer pagamento. Valores nulos aparecem como Não informado. payoutAllowed deve ser false, elegibilidade deve concordar com as pendências e valores devem ser inteiros não negativos. Preparação/transferência financeiras não estão disponíveis nesta tela.

Ao consultar, dados anteriores são removidos. Respostas de entrega trocada ou de consulta anterior à ocultação da página não exibem dados. pagehide e aba oculta limpam contato/valores do DOM; não são persistidos no navegador. Duplicação de consultas é bloqueada e erros/timeout liberam nova tentativa, preservando foto/entrega salvas.

Validação selecionada: 38 testes de interface/HTTP/contratos aprovados. Inclui identidade da sessão, no-store, outra conta sem acesso, preparação financeira recusada ao entregador, respostas inválidas/antigas, ocultação, falha e timeout. Sintaxe de 123 arquivos e 83 verificações do protótipo aprovadas.

Limites: é consulta pontual, sem atualização contínua, chamada/mensagem externa, endereço/trajeto, transferência ou extrato financeiro completo. Histórico permanece somente leitura e não seleciona operações encerradas para esta tela. Homologação humana e telefone/dispositivo reais permanecem pendentes. Percentuais formais da matriz não mudam.

Beta integrada aprovada no PostgreSQL temporário e Chromium: consulta por teclado, bloqueio do contato da doação antes da coleta, telefone sintético do recebedor após coleta, situação do repasse sem autorização financeira e quatro larguras (320/375/768/1280) sem overflow. Jornada de comprovante/histórico e restauração real do banco também passaram. Total selecionado: 39 testes, zero falhas.
