# Troca bilateral — beta local

A proposta vincula um anúncio de troca desejado e um anúncio de troca oferecido, ambos publicados, lacrados e pertencentes a pessoas diferentes. O aceite cabe ao proprietário do anúncio desejado. Somente no aceite os dois anúncios ficam indisponíveis.

O aceite cria duas pernas logísticas na mesma transação. Cada perna possui remetente, destinatário, responsável logístico, entregador, rastreamento, comprovante, aprovação do recebedor e validação independente próprios. Conforme a decisão aprovada, o destinatário é persistido como responsável pelo frete do pacote que receberá; uma restrição do banco impede atribuir essa responsabilidade ao remetente. A conclusão exige exatamente duas pernas atribuídas, entregues, aprovadas e validadas.

Cada perna também pode manter sua própria cotação, fornecedor, validade, fingerprint e total. Somente o destinatário registrado como `logistics_payer_id` confirma a cotação da perna que receberá; a outra parte não obtém acesso. A prova HTTP/PostgreSQL confirmou simultaneamente R$ 20,00 do parceiro + R$ 1,00 FraldaCycle para uma perna e R$ 30,00 + R$ 1,50 para a outra. Esta fundação não consulta o parceiro, não cobra os participantes e não cria pedidos logísticos reais.

Cada participante declara o valor do pacote que oferece: o solicitante ao propor e o proprietário ao aceitar. O aceite cria duas obrigações imutáveis e independentes de 2,5%, com arredondamento em centavos, vinculadas à pessoa e ao anúncio oferecido. Exemplo comprovado em PostgreSQL: R$ 80,00 gera R$ 2,00 e R$ 100,00 gera R$ 2,50. O estado inicial é `not_charged`; nenhuma intenção de pagamento, cobrança, repasse ou chamada ao provedor é criada.

Qualquer registro de pagamento ou caso financeiro impede a conclusão automática. Esta fundação não cobra frete nem diferença financeira e não chama provedores. A ativação da cobrança continua separadamente bloqueada pelo requisito do processador financeiro.

A consulta privada de situação do entregador usa a perna selecionada. Enquanto não houver cobrança de frete identificada por perna, mostra valor não informado, bloqueio `exchange_freight_not_configured` e `payoutAllowed: false`, mesmo que exista outro pagamento associado à transação. Não prepara obrigação financeira para a troca.

Cada destinatário pode compartilhar o próprio endereço somente na sua perna e apenas com o entregador atribuído. A outra parte e administradores não recebem esse acesso. A leitura termina com o encerramento da etapa logística.

O proprietário do anúncio desejado pode recusar a proposta antes do aceite, sem bloquear anúncios. Depois do aceite, o cancelamento local exige confirmação das duas partes, versão atual e ausência total de coleta, comprovante e endereço compartilhado. Havendo qualquer um desses marcos, o fluxo direciona ao suporte. O cancelamento bilateral reversível cancela as duas pernas e republica os dois anúncios.

A prova HTTP/PostgreSQL usa exclusivamente atores e mídias fictícios. Ela confirma recusa sem bloquear anúncios, cancelamento em duas confirmações antes da coleta, restauração dos anúncios, atribuição independente das duas pernas a entregadores ativos e distintos, consulta privada de cada situação de repasse sem inventar frete, recusa de atribuição ao administrador, entregador suspenso ou transação em disputa, bloqueio de segunda atribuição, comprovantes, aprovações dos respectivos recebedores, validação administrativa, conclusão atômica e ausência de registros financeiros. Nenhuma entrega, cobrança ou validação humana real foi executada.
