# Acesso privado ao comprovante

O comprovante não é público. A API exige sessão e limita metadados e foto às partes da operação, ao entregador atribuído e ao suporte com escopo administrativo. Terceiros recebem resposta sem revelar a existência do registro. Toda leitura autorizada gera auditoria mínima.

Os metadados retornados ao cliente não incluem a chave interna de armazenamento. As respostas usam `no-store`; a foto passa por autorização antes do fornecedor e é entregue somente por URL HTTPS assinada, com validade máxima de cinco minutos. O fornecedor não é consultado quando a autorização falha.

`tests/delivery-proof-http-postgres.test.mjs`, `tests/receipt-records.test.mjs` e `tests/admin-proof-review.test.mjs` comprovam o contrato em HTTP/PostgreSQL e nas camadas de serviço/revisão. Dados, mídia e contas são fixtures. Não houve fornecedor, foto, usuário ou operação real. O prazo de retenção permanece fora deste requisito, conforme a decisão aprovada, e depende de definição jurídica própria.
