# Recálculo e reutilização de cotações de entrega

Estado: política técnica implementada; persistência e endpoint de checkout ainda dependem da integração operacional do frete.

## Regra aprovada

- estimativas exibidas antes do checkout não podem ser confirmadas diretamente;
- ao entrar no checkout, solicitar uma cotação nova;
- a cotação de checkout pode ser reutilizada por no máximo 10 minutos;
- a validade efetiva é o menor prazo entre 10 minutos e a expiração informada pelo fornecedor;
- mudança de endereço de origem ou destino, versão do endereço, modalidade, anúncio, quantidade ou versão do pacote invalida a cotação;
- cotação vencida ou incompatível exige recálculo e nova confirmação do pagador;
- depois do pagamento processado, não recalcular nem trocar fornecedor automaticamente: encaminhar ao suporte.

O cache é privado (`private, max-age=600`). O identificador de compatibilidade usa somente IDs e versões técnicas; não contém endereço completo, contato ou dados infantis.

## Ativação pendente

A integração real deve persistir a cotação aceita, seu fingerprint e limite de reutilização na mesma fronteira transacional do checkout. Também deve auditar a confirmação do valor pelo pagador e recusar qualquer cobrança cujo identificador ou total não corresponda à cotação confirmada.
