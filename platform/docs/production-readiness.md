# Prontidão para produção

## Estado atual

O produto visual e navegável permanece íntegro. A fundação de produção começa por API, configuração, segurança de credenciais e modelo persistente.

## Corte 1 — fundação

- [x] contrato de configuração por ambiente;
- [x] endpoints de saúde e prontidão;
- [x] cabeçalhos básicos de segurança e CORS restrito;
- [x] hashing de senha com scrypt e comparação resistente a timing;
- [x] tokens de sessão opacos;
- [x] esquema PostgreSQL inicial;
- [x] testes automatizados;
- [x] adaptador PostgreSQL e execução de migrações;
- [x] cadastro, login, sessão e logout;
- [x] verificação de e-mail e recuperação;
- [x] limitação de tentativas por identidade;
- [x] fila transacional, worker e contrato seguro de entrega;
- [ ] credenciais e endpoint do provedor externo de e-mail/SMS;
- [x] autorização por papel e escopo nos contratos administrativos;
- [x] trilha persistente para mudanças administrativas críticas;
- [x] diretório real de usuários com suspensão, reativação e revogação de sessões;
- [x] exportação CSV protegida da auditoria;
- [x] gestão e revogação remota de sessões administrativas;
- [x] paginação da trilha de auditoria;
- [x] convites administrativos de uso único, validade de 72 horas, papel predefinido e auditoria;
- [x] aceite público de convite com senha protegida e e-mail verificado;
- [x] entrega de convites integrada à fila transacional (provedor externo configurável);
- [x] rate limiting geral em memória e proteção HTTP 429;
- [x] adaptador de rate limiting distribuído para múltiplas instâncias, com contrato HTTPS configurável;
- [ ] credenciais e endpoint do provedor Redis/rate limiting distribuído;
- [x] validação de segredos obrigatórios em produção;
- [x] resolvedor HTTPS para armazenamento externo de segredos com allowlist de chaves;
- [x] logs estruturados e adaptador HTTPS para observabilidade hospedada;
- [ ] credenciais e endpoints dos provedores externos de segredos e observabilidade;

## Regra imutável

A implementação de produção não pode alterar o protótipo para acomodar limitações técnicas. Quando um contrato estiver ausente, a arquitetura deve ser ampliada em `platform/`.

## Corte 2 — marketplace

- [x] anúncios persistidos;
- [x] busca pública e detalhe;
- [x] venda, troca e doação;
- [x] favoritos por usuário;
- [x] referências de mídia independentes do storage;
- [x] contrato de upload assinado para storage externo;
- [x] contrato de geocodificação externa;
- [x] busca por distância no banco e ordenação por proximidade;
- [x] conexão das telas de busca, detalhe, favoritos e publicação;
- [x] telas preparadas para upload real de mídia e geocodificação externa;
- [ ] credenciais e endpoints dos provedores de mídia e geocodificação;


## Corte 3 — pagamentos

- [x] intents de pagamento persistentes e idempotentes;
- [x] split financeiro validado no banco;
- [x] taxa de venda de 8%, troca de 5%, entrega de 5% e doação sem taxa;
- [x] adaptador HTTPS provider-neutral para pagamentos;
- [x] proibição de dados brutos de cartão na API;
- [x] endpoint autenticado para criação de pagamento;
- [x] contrato de webhooks financeiros com HMAC-SHA256, janela antirreplay e idempotência;
- [x] transições persistentes para autorização, pagamento, falha, estorno e disputa;
- [x] sessões curtas de tokenização e carregamento de SDK com Subresource Integrity;
- [x] ponte da tela aprovada para intents reais sem enviar cartão à API FraldaCycle;
- [x] solicitações persistentes e idempotentes de reembolso e disputa;
- [x] autorização do comprador, auditoria e adaptador externo para casos financeiros;
- [x] telas aprovadas de reembolso e disputa conectadas ao backend;
- [ ] credenciais, SDK e formato final de webhooks do provedor financeiro;


## Corte 4 — logística

- [x] remessas persistentes e idempotentes;
- [x] modalidades de retirada, parceiro, Correios e expressa;
- [x] seguro e timeline persistente de rastreamento;
- [x] controle de acesso para comprador, vendedor e entregador;
- [x] prova de entrega com mídia, recebedor, horário e coordenadas;
- [x] conclusão atômica da remessa e transação;
- [x] adaptador HTTPS provider-neutral para logística;
- [ ] credenciais, rastreamento e webhooks do provedor logístico;
