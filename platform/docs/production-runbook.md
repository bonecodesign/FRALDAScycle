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


## Arquitetura Neural — preparação e implantação no ADM

**Pausada por decisão do produto em 2026-10-09.** Não executar a implantação nem ativar sincronização com o ADM real até a plataforma estar funcionando e a etapa ser retomada. Os comandos seguintes ficam como referência futura. Consulte [o registro da pausa](architecture-neural-pause-2026-10-09.md).

A Arquitetura Neural é um módulo privado do painel em `/admin/architecture`.
As versões avulsas foram desativadas. `ADMIN_SESSION_API_ORIGIN` aponta o servidor
ADM para a API que autentica a sessão; o compose configura `http://api:4200`.
A verificação exige o papel `admin`, inclusive no desenvolvimento local.

No diretório `platform`, prepare e confira o pacote:

```sh
npm run architecture:sync
node tests/architecture-admin.test.mjs
node tests/smoke-architecture.test.mjs
npm run architecture:package
```

O arquivo `.release/arquitetura-neural-fraldascycle.tar.gz` na raiz reúne os
arquivos necessários para a implantação. `.release/manifest.json` registra SHA-256
do pacote e revisão do mapa. Dependências instaladas, Git e arquivos de ambiente
reais ficam excluídos; `.env.example` permanece como contrato demonstrativo.
O pacote inclui os dados privados da arquitetura no backend, portanto deve ser
transferido apenas ao ambiente autorizado de implantação.

A preparação não ativa integrações externas nem declara prontidão de produção.
Antes de promover, execute `npm test` e os testes HTTP de arquitetura em uma CI
ou servidor com portas locais disponíveis. O teste `architecture-http.test.mjs`
confere o login real por HTTP, cookies, bloqueios do Site, dados/assets privados
e revogação da sessão usando identidades sintéticas.

Depois da implantação, configure `ADMIN_URL` e `API_URL` com os domínios HTTPS
e execute `npm run architecture:smoke`. Essa verificação começa sem autenticação
e confirma os bloqueios. Para conferir também o mapa autorizado, forneça
`ARCHITECTURE_SESSION_COOKIE` pelo ambiente seguro da sessão e
`ARCHITECTURE_EXPECTED_REVISION` com a revisão do manifesto. Não coloque o cookie
em argumentos, arquivos de projeto ou logs. Sem cookie, o resultado registra
explicitamente que a verificação autenticada não foi realizada.

A versão local do mapa acompanha as mudanças do checkout a cada consulta;
a versão de produção acompanha o snapshot preparado para a implantação. O painel
revalida acesso e revisão a cada 60 segundos enquanto estiver visível.
