# FC-335 — endurecimento TLS do cliente PostgreSQL para Supabase-BR

Data da evidência: 20 de novembro de 2026
Escopo: configuração técnica inativa, sem conexão ao projeto hospedado

## Resultado

O cliente PostgreSQL da API passou a construir uma configuração estruturada, sem entregar a
`DATABASE_URL` ao parser do driver. Isso impede que parâmetros presentes na URL substituam o
objeto TLS seguro configurado pela aplicação.

Quando `SUPABASE_INFRASTRUCTURE_ENABLED=true`, a configuração falha fechada se:

- `DATABASE_SSL` não for `true`;
- `DATABASE_SSL_CA` não contiver um certificado PEM;
- a URL contiver parâmetros de transporte, inclusive `sslmode`, `ssl`, `sslrootcert` ou
  `uselibpqcompat`;
- a URL não identificar o projeto FraldaCycle-BR (`urbrtnenrsjvgqjhfhdj`);
- a API persistente apontar para a porta transacional `6543`.

O objeto TLS usa `rejectUnauthorized: true` e a CA configurada. Assim, o runtime Node valida a
cadeia do certificado e a identidade do hostname durante o handshake. A URL e suas credenciais
não são incluídas nas mensagens de erro.

PostgreSQL local descartável continua aceito com `DATABASE_SSL=false`, desde que a URL não tente
controlar o transporte por parâmetros próprios.

## Evidência sintética

Os testes locais cobrem:

- montagem do pool sem `connectionString` e com campos estruturados;
- CA explícita e `rejectUnauthorized: true`;
- rejeição de `disable`, `prefer`, `require`, `verify-ca`, `verify-full` e `no-verify` na URL;
- rejeição de `ssl=false`, `sslrootcert` e `uselibpqcompat` na URL;
- falha fechada quando TLS ou CA está ausente;
- preservação do PostgreSQL local sem TLS;
- ausência de credenciais nas mensagens de falha;
- rejeição da porta `6543`, de projeto incorreto e de segredos públicos pelo readiness existente.

Os certificados e endereços usados nos testes são exclusivamente sintéticos. Nenhum banco
remoto foi consultado e nenhum segredo real foi criado, lido ou armazenado.

## Validação hospedada ainda pendente

Antes de qualquer ativação, uma pessoa autorizada deverá obter a CA oficial no painel do projeto
FraldaCycle-BR e configurar o segredo `DATABASE_SSL_CA` no ambiente aprovado. A validação final
deverá demonstrar, sem expor credenciais:

1. conexão autorizada ao hostname oficial com a CA oficial;
2. falha diante de CA incorreta e de identidade de servidor incompatível;
3. política de SSL do servidor verificada no painel do fornecedor;
4. uso de conexão direta ou pooler em modo session, nunca porta `6543` pela API persistente.

Esta evidência não ativa o Supabase, não valida produção e não altera o estado formal do projeto:
48/70 requisitos, piloto 16/21 e **NO-GO**.
