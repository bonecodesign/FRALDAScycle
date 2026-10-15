# Contato após pagamento e cancelamento assistido — beta local

## Regra implementada

- O chat continua rejeitando telefone, e-mail, links, QR Codes e redes sociais no texto.
- Em vendas, o webhook autenticado `payment.paid` libera o contato estruturado entre comprador e vendedor.
- Apenas telefone e e-mail verificados podem ser exibidos; a leitura é individualmente auditada sem copiar o valor do contato para o log.
- Operações não pagas, reembolsadas, canceladas, revogadas ou acessadas por terceiros falham de forma fechada.
- O entregador atribuído recebe somente um telefone verificado durante a etapa ativa: vendedor para coleta; comprador para entrega. A permissão termina ao entregar, cancelar ou perder a atribuição; suporte e administrador não herdam esse acesso.
- Depois do pagamento, o cancelamento comum permanece proibido. O usuário abre um chamado de cancelamento.
- Um agente com permissão de suporte confirma a decisão. O cálculo usa o retrato financeiro do pagamento: valor bruto menos taxa da plataforma e taxa de entrega registradas resulta no valor a devolver.
- A decisão muda a transação para disputa, revoga o contato, preserva o anúncio indisponível e cria uma ordem financeira `provider_pending` idempotente.

## Limite desta etapa

O código local não afirma que o dinheiro foi devolvido. O envio e a confirmação do estorno dependem do provedor financeiro homologado e das credenciais. Até lá a decisão fica explicitamente pendente no provedor.

A exceção logística de contato possui prova HTTP/PostgreSQL dedicada: cliente e administrador são recusados, outro entregador não acessa, o entregador atribuído vê somente o telefone verificado do vendedor na coleta e do comprador durante a entrega, e perde o acesso após a conclusão. A auditoria registra apenas canal e finalidade, nunca o telefone. Nenhuma chamada ou operação logística real foi executada.

O contato entre comprador e vendedor também possui prova HTTP/PostgreSQL dedicada: permanece fechado antes do webhook pago, expõe somente canais verificados da outra parte, recusa terceiros, audita apenas os nomes dos canais e é revogado pelo cancelamento assistido. O teste não executa comunicação externa nem estorno no provedor.
