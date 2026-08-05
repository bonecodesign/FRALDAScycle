# Runbook de preparação e ativação de produção

Este documento separa a preparação técnica local da futura conexão de serviços reais. O protótipo acompanha as decisões aprovadas do produto e suas alterações devem permanecer sincronizadas com Site, App e Admin.

## Fase atual — preparação técnica local

As integrações externas estão adiadas por decisão do produto. Enquanto isso, a versão pode avançar até o portão local de publicação, sem credenciais, contratação, provisionamento ou publicação externa.

No diretório `platform`:

```powershell
npm ci
npm run release:check-local
```

Esse comando valida sintaxe de produção, testes da plataforma, manifesto neutro de fornecedores e regressão do protótipo. Ele não declara o ambiente pronto para produção e não substitui `production:doctor`.

## Ordem de ativação

1. Provisionar PostgreSQL com TLS e backup automático.
2. Configurar o cofre de segredos e sua allowlist.
3. Cadastrar notificações, mídia, geocodificação, pagamentos, logística, rate limiting e telemetria.
4. Substituir todos os valores demonstrativos do contrato `.env.example`.
5. Executar migrações em ambiente de homologação.
6. Executar o diagnóstico e a suíte completa.
7. Validar webhooks assinados em homologação.
8. Promover a mesma versão imutável para produção.

Os itens desta seção permanecem em standby até a retomada explícita das integrações externas.

## Empacotamento reproduzível

O arquivo `compose.production.example.yaml` define API, worker de notificações, Site, App e Admin em processos independentes. Copie-o para a ferramenta de orquestração escolhida e injete `platform/.env.production` pelo cofre de segredos; esse arquivo real nunca deve entrar no Git.

As três superfícies usam a mesma imagem parametrizada por `SURFACE`, preservando os arquivos aprovados e expondo somente suas rotas oficiais.

## Publicação de versões

Uma tag no formato `vMAJOR.MINOR.PATCH` inicia a publicação de quatro imagens no GitHub Container Registry: `api`, `site`, `app` e `admin`. Cada imagem recebe uma tag semântica e outra vinculada aos 12 primeiros caracteres do commit.

Crie a tag somente depois de CI verde e aprovação da versão. O workflow não publica `latest`, evitando promoção implícita ou substituição silenciosa de artefatos.

## Verificação antes da promoção

No diretório `platform`:

```powershell
npm ci
npm run check:production
npm test
npm run production:doctor
```

O diagnóstico retorna JSON, nunca imprime valores secretos e termina com código diferente de zero enquanto existir qualquer integração incompleta.

## Critérios obrigatórios

- `production:doctor` com `ready: true`;
- todos os testes aprovados;
- migrações concluídas sem alteração de checksums históricos;
- endpoints `/health` e `/ready` aprovados;
- CORS limitado aos domínios oficiais;
- SDK financeiro HTTPS com SRI fornecido pelo provedor;
- webhooks financeiro e logístico assinados e validados em homologação;
- backups e restauração do banco testados;
- alertas de erro e latência recebidos pela operação.

## Rollback

1. Interromper novas promoções.
2. Reapontar o tráfego para a versão anterior.
3. Não reverter migrações destrutivamente.
4. Preservar logs, ledger de webhooks e auditoria.
5. Corrigir em nova versão e repetir homologação.

## Regra do produto

Site, App, Admin e o protótipo formam a fonte oficial da experiência e devem permanecer sincronizados. Limitações de fornecedores devem ser absorvidas por adaptadores, nunca pela remoção silenciosa de regras ou funcionalidades aprovadas.
