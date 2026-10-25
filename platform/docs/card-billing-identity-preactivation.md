# Identidade de cobrança no cartão — pré-ativação

Estado: fundação técnica concluída; cobrança real continua bloqueada até homologação do Asaas e revisão do fluxo antifraude.

## Controle implementado

- Cartão é tokenizado diretamente pelo SDK do provedor.
- A API recusa número completo e código de segurança.
- Para cartão de crédito, o checkout exige o CPF da cobrança.
- O servidor calcula HMAC-SHA-256 do CPF normalizado e compara com a impressão cadastrada na conta.
- O CPF em texto aberto não é persistido, auditado nem devolvido pela API.
- Depois da comparação, o CPF é transmitido somente ao adaptador do provedor para compor a cobrança.
- Pix não exige essa repetição do CPF no checkout.

## Limite explícito

A igualdade entre o CPF digitado e o CPF da conta **não comprova a titularidade real do cartão**. A FraldaCycle não deve apresentar esse controle como prova de propriedade. Antes da ativação, a homologação do Asaas precisa confirmar quais sinais retorna sobre titularidade, antifraude, 3DS e recusas. Caso o provedor não ofereça evidência suficiente, cartão de terceiros deverá permanecer tratado como risco não resolvido ou ser bloqueado por política mais restritiva.

## Ativação pendente

1. Conta e contrato reais do Asaas.
2. Confirmação dos campos aceitos na tokenização e cobrança.
3. Mapeamento das respostas de antifraude/3DS sem armazenar dados brutos.
4. Testes no sandbox oficial e validação de webhook.
5. Aprovação de Segurança, Financeiro e Jurídico.
