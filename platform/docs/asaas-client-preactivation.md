# Cliente Asaas — pré-ativação

Estado em 2026-10-25: adaptador técnico de sandbox criado, isolado do runtime financeiro e desligado por padrão. Isso **não** representa contrato, homologação, autorização jurídica ou integração real ativa.

## Escopo pronto

- falha fechada quando `enabled` não é explicitamente `true`;
- origem fixa `https://api-sandbox.asaas.com/v3`, sem possibilidade de produção;
- criação preparatória de cliente e cobrança Pix com campos permitidos;
- chave de idempotência e `externalReference` obrigatórias nas criações;
- consulta mínima da cobrança para futura conciliação;
- timeout entre 500 ms e 15 segundos;
- erros sanitizados, sem resposta bruta, credencial ou dados do pagador;
- nenhuma coleta ou transmissão de PAN, CVV ou dados brutos de cartão.
- eventos nativos classificados somente como candidatos, sempre com
  `financialTransitionAllowed: false` até a conciliação no provedor.
- conciliação preparatória compara referência, valor exato em centavos e estado
  consultado, mas também mantém `financialTransitionAllowed: false`.
- caixa de entrada nativa deduplica eventos pelo identificador do Asaas, guarda
  somente metadados mínimos e o hash SHA-256 do payload, sem conservar o corpo;
- rota isolada `/v1/payments/asaas/webhook` usa `asaas-access-token` e só existe
  quando `ASAAS_SANDBOX_ENABLED=true` fora de produção;
- reconciliador recupera trabalhos interrompidos, consulta a cobrança e grava

Após timeout, o chamador deve consultar a cobrança pela referência antes de repetir. A integração ainda não afirma que o provedor deixou de criar a cobrança.

## Deliberadamente fora desta etapa

- ligação ao `payment-service` ou às rotas públicas;
- credenciais reais e endpoint de produção;
- cartão e tokenização nativa;
- split, subconta, Conta Escrow e liberação de valores;
- estorno, chargeback e disputa;
- aplicação automática de evento de webhook ao estado financeiro.

Esses pontos dependem da conta sandbox contratada, confirmação atual do contrato oficial da API, tarifas e revisão do modelo financeiro. O webhook nativo continua produzindo apenas um evento não conciliado; antes de qualquer transição financeira, a cobrança deve ser consultada no Asaas e comparada com referência, valor e estado esperados.

## Condição para ativação futura

1. confirmar CNPJ/enquadramento e habilitação de marketplace/subcontas;
2. obter credenciais sandbox pelo cofre, nunca pelo repositório;
3. validar os nomes de campos e a semântica de idempotência contra a documentação vigente;
4. executar fixtures de timeout, repetição, evento fora de ordem, valor divergente, estorno e chargeback;
5. homologar Pix e cartão separadamente;
6. aprovar tarifas, arredondamento, recebedores, garantia, disputa e rollback;
7. somente então criar configuração de runtime e reconhecimento explícito para produção.
