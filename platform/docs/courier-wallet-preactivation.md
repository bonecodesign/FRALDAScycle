# Carteira do entregador — fundação pré-ativação

Esta fundação transforma as decisões 56–60 em um livro contábil interno, sem movimentar dinheiro real. Ganhos confirmados entram como crédito idempotente; saque reserva o saldo, preservando separação entre disponível e reservado. Não há depósito externo, transferência entre usuários, saldo negativo, expiração ou armazenamento de chave PIX/CPF no livro.

O saque comum exige mínimo de R$ 20 e uma única solicitação em janela móvel de sete dias. O destino vem exclusivamente do cadastro de repasse já verificado e é conservado como referência opaca do provedor. A solicitação segue nível 3 → nível 4 → nível 5 e, mesmo autorizada, não chama fornecedor nem declara pagamento concluído.

Uso em compras, devolução proporcional, exceção de encerramento abaixo do mínimo, falha/devolução do Pix, rotas HTTP, interface e integração real continuam em pacotes posteriores. Produção exige parecer jurídico/contábil, homologação do provedor e feature flag explícita.
