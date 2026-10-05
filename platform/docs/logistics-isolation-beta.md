# Isolamento e idempotência da logística

Base: main 670365d, PR #76 integrado. Somente platform/.

A repetição de uma chave verifica titular, transação, modalidade e seguro antes de devolver qualquer entrega. Reutilização divergente retorna conflito sem dados da entrega original. A criação revalida titular, vendedor e estado da operação sob a mesma trava que insere a entrega. Uma operação já atendida não recebe segunda entrega com outra chave.

Repetições concorrentes criam somente uma entrega, evento e auditoria. O perdedor retorna a entrega existente sem repetir chamada do fornecedor. Falha externa continua sem retentativa automática; fornecedor e homologação permanecem pendentes, sem ativação neste lote.

Validação preparada: dois testes de serviço sem fornecedor; PostgreSQL nativo acrescenta concorrência, isolamento entre titulares, divergência de payload, chave diferente e operação cancelada após preflight. CI do commit 0622d6d: 269 testes e 83 verificações aprovados; PostgreSQL nativo executou os casos adicionais e o fluxo completo de venda/endereço/comprovante/validação. Chrome 154 reexecutou preferências, Premium, chat, recurso e administração com teclado e quatro larguras. Evidência: job 111792067673. Sem teste humano, leitor de tela ou dispositivo físico.

Matriz permanece 7/70 = 10% concluídos. Produção bloqueada; não há cobrança, repasse, envio externo ou serviço pago. Item 12 standby. Alteração de endereço pelo suporte e logística de troca/doação permanecem em lotes seguintes.
