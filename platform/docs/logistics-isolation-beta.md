# Isolamento e idempotência da logística

Base: main 670365d, PR #76 integrado. Somente platform/.

A repetição de uma chave verifica titular, transação, modalidade e seguro antes de devolver qualquer entrega. Reutilização divergente retorna conflito sem dados da entrega original. A criação revalida titular, vendedor e estado da operação sob a mesma trava que insere a entrega. Uma operação já atendida não recebe segunda entrega com outra chave.

Repetições concorrentes criam somente uma entrega, evento e auditoria. O perdedor retorna a entrega existente sem repetir chamada do fornecedor. Falha externa continua sem retentativa automática; fornecedor e homologação permanecem pendentes, sem ativação neste lote.

Validação preparada: dois testes de serviço sem fornecedor; PostgreSQL nativo acrescenta concorrência, isolamento entre titulares, divergência de payload, chave diferente e operação cancelada após preflight. Resultado de CI pendente, não registrado como executado até aprovação. O fluxo completo existente de venda/endereço/comprovante/validação e Chrome também será reexecutado.

Matriz permanece 7/70 = 10% concluídos. Produção bloqueada; não há cobrança, repasse, envio externo ou serviço pago. Item 12 standby. Alteração de endereço pelo suporte e logística de troca/doação permanecem em lotes seguintes.
