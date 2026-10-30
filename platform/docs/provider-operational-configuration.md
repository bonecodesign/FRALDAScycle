# Configuração operacional dos fornecedores

Este arquivo é um roteiro de preparação. Não contém credenciais e não autoriza ativação em produção.

## Asaas

- `ASAAS_SANDBOX_ENABLED=false` por padrão.
- Credenciais devem vir do cofre, nunca do repositório.
- Produção exige ambiente `production`, credencial válida, token de webhook e reconhecimento explícito.
- Homologar cobrança, webhook, conciliação, idempotência, estorno e split antes de ativar.

## Google Maps

- `GOOGLE_MAPS_GEOCODING_ENABLED=false` por padrão.
- `GOOGLE_MAPS_API_KEY` deve ser restrita por API, projeto e ambiente.
- Produção exige `GOOGLE_MAPS_ACTIVATION_ACKNOWLEDGED=true`.
- Confirmar orçamento, limites, cobertura no Brasil, retenção/cache e fallback antes do piloto.

## Fontes de disponibilidade

- `MANUFACTURER_AVAILABILITY_FIXED_SOURCES` aceita somente URLs HTTPS sem duplicatas.
- `MANUFACTURER_AVAILABILITY_REFRESH_ENABLED=false` mantém o worker desligado.
- `MANUFACTURER_AVAILABILITY_ACTIVATION_ACKNOWLEDGED=false` impede ativação acidental.
- A fonte oficial do fabricante continua sendo a autoridade de compatibilidade.
- Fontes públicas são auxiliares e precisam de revisão, promoção e ativação separadas.

## Controle de mudança

Qualquer alteração de credencial, endpoint, tarifa, limite, cache ou flag deve ser registrada, revisada por Segurança/Operações e acompanhada de rollback. A configuração técnica não substitui contrato, homologação ou revisão jurídica.
