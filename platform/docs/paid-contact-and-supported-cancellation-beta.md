# Contato após pagamento e cancelamento assistido — beta local

## Regra implementada

- O chat continua rejeitando telefone, e-mail, links, QR Codes e redes sociais no texto.
- Em vendas, o webhook autenticado `payment.paid` apenas torna a escolha disponível. Cada titular precisa autorizar expressamente seus próprios canais antes que a outra parte possa consultá-los.
- A autorização é separada por e-mail e telefone, confirmada, versionada e revogável; pagamento sozinho nunca expõe o contato.
- Apenas telefone e e-mail verificados podem ser exibidos; a leitura é individualmente auditada sem copiar o valor do contato para o log.
- Operações não pagas, reembolsadas, canceladas, revogadas ou acessadas por terceiros falham de forma fechada.
- O entregador atribuído recebe somente um telefone verificado durante a etapa ativa: vendedor para coleta; comprador para entrega. A permissão termina ao entregar, cancelar ou perder a atribuição; suporte e administrador não herdam esse acesso.
- Depois do pagamento, o cancelamento comum permanece proibido. O usuário abre um chamado de cancelamento.
- Antes da coleta e do compartilhamento do endereço, a prévia devolve integralmente a comissão da FraldaCycle. Somente custo logístico já registrado pode permanecer no cálculo; o estado do provedor continua pendente e explícito.
- Depois da coleta ou do compartilhamento do endereço, o caso permanece no marco conservador de suporte e usa o retrato financeiro registrado, sem presumir direitos, custos externos ou reembolso concluído.
- Um agente com permissão de suporte consulta a prévia e confirma a decisão. A prévia é privada, não armazenável em cache e auditada sem copiar justificativas.
- A decisão muda a transação para disputa, revoga o contato, preserva o anúncio indisponível e cria uma ordem financeira `provider_pending` idempotente.
- O agente de suporte nível 1 atende; o nível 2 analisa e registra a decisão; somente o nível 3 pode enviar ao provedor o valor exato já aprovado.
- A execução financeira exige senha e código de e-mail novos para cada envio, consome uma autorização de uso único e usa chave de idempotência.
- O painel financeiro expõe apenas os identificadores operacionais, valores, retenções, justificativa e estado necessários. Ele não expõe credenciais do provedor nem dados pessoais das partes.
- Depois do envio, o estado permanece `submitted`; a interface informa que a conclusão depende do webhook do provedor.
- O webhook financeiro assinado só conclui uma decisão enviada quando encontra a cobrança local e o valor recebido coincide exatamente com o valor de reembolso aprovado. O evento é idempotente e a conclusão ganha data, vínculo ao evento e auditoria sem dados pessoais.
- Uma rotina de reconciliação pode consultar envios pendentes pelo identificador opaco do caso. Ela registra cada conferência e só conclui quando referência, estado `completed` e valor exato coincidem; indisponibilidade ou divergência bloqueiam a evolução sem inventar sucesso.
- A execução periódica permanece desligada e exige `NODE_ENV=production` e `REFUND_RECONCILIATION_ENABLED=true`; intervalo aceito entre 5 minutos e 24 horas. Credenciais e homologação continuam externas.
- O monitor local pode criar um único alerta interno quando uma confirmação permanece ausente além do prazo configurado (referência inicial: 120 minutos). A fila é exclusiva do nível 3, não expõe dados pessoais e o alerta é encerrado automaticamente após webhook ou reconciliação válidos.
- O painel permite filtrar a fila, consultar as últimas conferências e registrar em caso bloqueado apenas dois encaminhamentos: acompanhamento com o provedor ou retorno para reanálise do suporte. O registro é auditável e não repete reembolso nem movimenta dinheiro.

## Limite desta etapa

O código local não afirma que o dinheiro foi devolvido. O caminho de envio está preparado, mas a execução real e a confirmação do estorno dependem do provedor financeiro homologado e das credenciais. Sem provedor, a operação falha fechada. Uma falha terminal não é repetida automaticamente com a mesma decisão: o caso volta para análise humana. O webhook/reconciliador continua sendo a fonte da conclusão financeira.

A exceção logística de contato possui prova HTTP/PostgreSQL dedicada: cliente e administrador são recusados, outro entregador não acessa, o entregador atribuído vê somente o telefone verificado do vendedor na coleta e do comprador durante a entrega, e perde o acesso após a conclusão. A auditoria registra apenas canal e finalidade, nunca o telefone. Nenhuma chamada ou operação logística real foi executada.

O contato entre comprador e vendedor também possui prova HTTP/PostgreSQL dedicada: permanece fechado antes do webhook pago e depois dele enquanto o titular não autorizar, expõe somente os canais verificados escolhidos, recusa terceiros e versões antigas, permite revogação e audita apenas nomes de canais. O cancelamento assistido revoga o acesso global. O teste não executa comunicação externa nem estorno no provedor.

Uma prova HTTP/PostgreSQL de 15 de outubro cobre o cancelamento antes da coleta. Venda ainda sem pagamento é cancelada diretamente e o anúncio retorna conforme a capacidade de publicação. Venda paga exige suporte; a prévia mostra valor bruto, comissão devolvida, custos registrados, valor projetado e estado pendente do provedor. A decisão conserva anúncio indisponível e transação em disputa até o estorno externo. Troca aceita continua exigindo confirmação bilateral e ausência de coleta, comprovante ou endereço compartilhado.

Uma segunda prova HTTP/PostgreSQL cobre o tratamento após a coleta. O cancelamento direto é recusado, o comprador abre o chamado e a prévia administrativa identifica o marco `post_milestone`. A decisão assistida cria uma ordem `provider_pending` e mantém a transação em disputa, sem reabrir o anúncio nem retroceder a entrega coletada. Nenhum retorno físico ou reembolso externo é alegado como concluído.
