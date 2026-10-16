# Compartilhamento privado de endereço — beta local

## Regra comprovada

- A superfície pública apresenta somente localização aproximada e não retorna rua, número, complemento ou CEP do endereço salvo.
- Uma venda somente permite compartilhar o endereço depois de pagamento confirmado, atribuição logística e confirmação explícita do aviso `FC-ADDRESS-1`.
- O endereço completo é disponibilizado apenas ao titular e ao entregador atribuído durante a etapa operacional necessária; vendedor, terceiros e administradores não recebem acesso por essa rota.
- O compartilhamento grava o marco `address_shared_at`, bloqueia cancelamento direto e encaminha qualquer pedido posterior ao suporte.
- Ao terminar a etapa logística, o entregador perde o acesso. Leituras e compartilhamento são auditados sem copiar o endereço para o log.
- Venda, doação e cada perna da troca conservam regras próprias de autoridade e destinatário no mesmo repositório.

## Evidência e limite

O teste HTTP/PostgreSQL dedicado cria uma venda sintética, comprova bloqueios antes do pagamento e sem consentimento, isolamento por papel, leitura privada, marco de cancelamento e expiração após entrega. Não executa pagamento, entrega, transportadora, geocodificação ou validação humana reais. O prazo jurídico de retenção continua pendente e não é inventado por esta etapa.
