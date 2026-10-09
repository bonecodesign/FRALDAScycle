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

O código local não afirma que o dinheiro foi devolvido. O envio e a confirmação do estorno dependem do provedor financeiro homologado, das credenciais e dos testes HTTP/PostgreSQL adiados. Até lá a decisão fica explicitamente pendente no provedor.
