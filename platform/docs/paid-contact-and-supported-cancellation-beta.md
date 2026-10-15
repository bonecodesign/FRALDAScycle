# Contato após pagamento e cancelamento assistido — beta local

## Regra implementada

- O chat continua rejeitando telefone, e-mail, links, QR Codes e redes sociais no texto.
- Em vendas, o webhook autenticado `payment.paid` libera o contato estruturado entre comprador e vendedor.
- Apenas telefone e e-mail verificados podem ser exibidos; a leitura é individualmente auditada sem copiar o valor do contato para o log.
- Operações não pagas, reembolsadas, canceladas, revogadas ou acessadas por terceiros falham de forma fechada.
- O entregador atribuído recebe somente um telefone verificado durante a etapa ativa: vendedor para coleta; comprador para entrega. A permissão termina ao entregar, cancelar ou perder a atribuição; suporte e administrador não herdam esse acesso.
- Depois do pagamento, o cancelamento comum permanece proibido. O usuário abre um chamado de cancelamento.
- Antes da coleta e do compartilhamento do endereço, a prévia devolve integralmente a comissão da FraldaCycle. Somente custo logístico já registrado pode permanecer no cálculo; o estado do provedor continua pendente e explícito.
- Depois da coleta ou do compartilhamento do endereço, o caso permanece no marco conservador de suporte e usa o retrato financeiro registrado, sem presumir direitos, custos externos ou reembolso concluído.
- Um agente com permissão de suporte consulta a prévia e confirma a decisão. A prévia é privada, não armazenável em cache e auditada sem copiar justificativas.
- A decisão muda a transação para disputa, revoga o contato, preserva o anúncio indisponível e cria uma ordem financeira `provider_pending` idempotente.

## Limite desta etapa

O código local não afirma que o dinheiro foi devolvido. O envio e a confirmação do estorno dependem do provedor financeiro homologado e das credenciais. Até lá a decisão fica explicitamente pendente no provedor.

A exceção logística de contato possui prova HTTP/PostgreSQL dedicada: cliente e administrador são recusados, outro entregador não acessa, o entregador atribuído vê somente o telefone verificado do vendedor na coleta e do comprador durante a entrega, e perde o acesso após a conclusão. A auditoria registra apenas canal e finalidade, nunca o telefone. Nenhuma chamada ou operação logística real foi executada.

O contato entre comprador e vendedor também possui prova HTTP/PostgreSQL dedicada: permanece fechado antes do webhook pago, expõe somente canais verificados da outra parte, recusa terceiros, audita apenas os nomes dos canais e é revogado pelo cancelamento assistido. O teste não executa comunicação externa nem estorno no provedor.

Uma prova HTTP/PostgreSQL de 15 de outubro cobre o cancelamento antes da coleta. Venda ainda sem pagamento é cancelada diretamente e o anúncio retorna conforme a capacidade de publicação. Venda paga exige suporte; a prévia mostra valor bruto, comissão devolvida, custos registrados, valor projetado e estado pendente do provedor. A decisão conserva anúncio indisponível e transação em disputa até o estorno externo. Troca aceita continua exigindo confirmação bilateral e ausência de coleta, comprovante ou endereço compartilhado.

Uma segunda prova HTTP/PostgreSQL cobre o tratamento após a coleta. O cancelamento direto é recusado, o comprador abre o chamado e a prévia administrativa identifica o marco `post_milestone`. A decisão assistida cria uma ordem `provider_pending` e mantém a transação em disputa, sem reabrir o anúncio nem retroceder a entrega coletada. Nenhum retorno físico ou reembolso externo é alegado como concluído.
