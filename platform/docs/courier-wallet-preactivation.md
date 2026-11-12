# Carteira do entregador — fundação pré-ativação

Esta fundação transforma as decisões 56–60 em um livro contábil interno, sem movimentar dinheiro real. Ganhos confirmados entram como crédito idempotente; saque reserva o saldo, preservando separação entre disponível e reservado. Não há depósito externo, transferência entre usuários, saldo negativo, expiração ou armazenamento de chave PIX/CPF no livro.

O saque comum exige mínimo de R$ 20 e uma única solicitação em janela móvel de sete dias. O destino vem exclusivamente do cadastro de repasse já verificado e é conservado como referência opaca do provedor. A solicitação segue nível 3 → nível 4 → nível 5 e, mesmo autorizada, não chama fornecedor nem declara pagamento concluído.

O nível 5 cria um comando em fila neutra, sem copiar chave PIX. O processamento usa posse temporária, recupera travas antigas e separa aceite, confirmação final e retorno terminal. Confirmação baixa o valor reservado; falha terminal devolve o valor ao saldo disponível. Ambos são idempotentes e guardam somente hashes de referência/evidência ou código normalizado de falha.

A carteira pode financiar compras de venda do próprio entregador. O valor é reservado atomicamente, a compra integral não cria cobrança externa e a compra mista envia ao provedor somente o restante. O chat permanece fechado até a liquidação; falha externa devolve a reserva ao saldo disponível. A origem financeira fica registrada sem alterar o split comercial calculado sobre o valor total do produto.

Devolução proporcional, exceção de encerramento abaixo do mínimo, interface da carteira, adaptador e integração real continuam em pacotes posteriores. Produção exige parecer jurídico/contábil, homologação do provedor e feature flag explícita.
