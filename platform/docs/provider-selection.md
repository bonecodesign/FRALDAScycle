# Fornecedores escolhidos para homologação do piloto

Decisão do projeto: 2026-10-19. **Asaas (pagamentos) e Lalamove (logística) foram escolhidos para a homologação do piloto em Belo Horizonte.** Estado: sem contratação, credenciais ou tráfego real.

As alternativas continuam disponíveis caso a homologação falhe. Preços e condições devem ser confirmados diretamente com cada fornecedor antes de qualquer compromisso.

| Capacidade | Recomendada | Alternativa | Motivo principal |
| --- | --- | --- | --- |
| Pagamentos | Asaas | Mercado Pago; Pagar.me para comparação comercial | Split e Conta Escrow documentados para subcontas; validar liberação após prova de entrega |
| Logística | Lalamove | Loggi Expresso; Uber Direct para comparação comercial | API de pedido, cotação e webhook documentada; validar cobertura e prova de entrega em BH |
| Notificações | Brevo | Zenvia | E-mail e SMS em uma API, reduzindo carga operacional |
| Mídia | Cloudflare R2 | Cloudinary | S3 compatível, uploads assinados e portabilidade |
| Geocodificação | Google Maps | HERE | Cobertura, quotas e documentação operacional |
| Rate limiting | Upstash Redis | Redis Cloud | Contadores atômicos, TTL e limite de orçamento |
| Telemetria | Sentry | Grafana Cloud | Erros, tracing, alertas e implantação simples |
| Segredos | Doppler | AWS Secrets Manager | Fluxo direto para equipe pequena e tokens de serviço |

## Leitura correta da recomendação

Para pagamentos e logística, “recomendada” agora significa **escolhida pelo projeto para iniciar homologação**, não contratada ou liberada para produção. Se qualquer critério eliminatório falhar, a alternativa passa pela mesma avaliação. O manifesto legível por máquina em `platform/config/provider-selection.v1.json` contém a decisão, motivos, custos qualitativos, fontes públicas e bloqueios.

## Ordem sugerida de diligência

1. Asaas: confirmar elegibilidade do marketplace, onboarding de vendedores, split sobre valor líquido, Conta Escrow e seu prazo máximo, liberação manual somente após aprovação e prova, Pix/cartão, estornos, disputas, conciliação e sandbox.
2. Lalamove: confirmar cobertura por CEP em Belo Horizonte, preço de rotas do piloto e das duas pernas de uma troca, webhook, prova de entrega acessível pela API no contrato, cancelamento e suporte.
3. Doppler: confirmar retenção de auditoria, rotação, revogação, menor privilégio e exportação.
4. Cloudflare R2: validar upload assinado, limites, exclusão, retenção e latência.
5. Brevo: validar remetentes, entregabilidade, SMS brasileiro, opt-out, webhook e DPA.
6. Google Maps: medir precisão em endereços do piloto e definir quotas rígidas de custo.
7. Upstash: confirmar região, alta disponibilidade, failover, SLA e orçamento máximo.
8. Sentry: configurar previamente política de remoção de PII e segredos, retenção e alertas.

## Critérios de bloqueio geral

- ausência de sandbox ou método equivalente de homologação;
- termos incompatíveis com marketplace ou LGPD;
- segredo exigido no cliente ou no protótipo;
- ausência de HTTPS, idempotência ou proteção de webhook quando aplicável;
- impossibilidade de exportar ou excluir dados;
- custo sem limite, quota ou mecanismo de alerta;
- dependência de alteração no protótipo aprovado;
- contrato sem plano de saída.

## Evidência pública principal

- Asaas: https://docs.asaas.com/docs/split-de-pagamentos
- Conta Escrow Asaas: https://docs.asaas.com/docs/introducao-conta-escrow
- Mercado Pago: https://www.mercadopago.com.br/developers/pt/docs/split-payments/split-1-1/integration-configuration/integrate-marketplace
- Lalamove: https://developers.lalamove.com/
- API Lalamove: https://www.lalamove.com/pt-br/empresas/solucoes-de-api
- Brevo: https://developers.brevo.com/ e https://www.brevo.com/pricing/
- Cloudflare R2: https://developers.cloudflare.com/r2/pricing/
- Cloudinary: https://cloudinary.com/pricing
- Google Maps: https://developers.google.com/maps/documentation/geocoding/usage-and-billing
- Upstash Redis: https://upstash.com/pricing/redis
- Sentry: https://sentry.io/pricing/
- Doppler: https://www.doppler.com/pricing

## Próximo portão

Nenhuma integração avança automaticamente. O próximo estado permitido é “diligência aprovada”, com respostas comerciais, jurídicas, de segurança e privacidade anexadas fora do repositório e sem segredos. Somente depois pode existir sandbox; produção permanece bloqueada até a homologação integral.

## Portão explícito dos adaptadores genéricos de produção (07/11/2026)

A configuração de endpoint e segredo **não** constitui autorização de ativação. O adaptador genérico de pagamentos requer `PAYMENT_PROVIDER_ACTIVATION_ACKNOWLEDGED=true` quando houver `PAYMENT_PROVIDER_URL` em produção; o de logística requer `LOGISTICS_PROVIDER_ACTIVATION_ACKNOWLEDGED=true` quando houver `LOGISTICS_PROVIDER_URL`. Sem a confirmação correspondente, a inicialização falha de forma fechada. Uma confirmação isolada, sem URL e segredo, não habilita integração. O diagnóstico de produção exige o valor literal `true`, não aceita `false` como evidência de prontidão.

Os mecanismos específicos de Asaas e Lalamove já possuem confirmações próprias, que **não são substituídas** por esses dois campos. Nenhuma dessas variáveis deve ser habilitada antes de contratação, diligência, homologação, decisão humana formal e configuração segura fora do repositório. As configurações de exemplo permanecem `false`; o projeto continua sem tráfego real e com o item 12 em standby. Esta proteção foi reaproveitada seletivamente da intenção da PR #115, **sem mesclar sua branch antiga**.
