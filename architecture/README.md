# Arquitetura integrada de destino

## Regra principal

A raiz do repositório contém o protótipo aprovado e é a fonte oficial de produto e interface. Os arquivos existentes do protótipo não devem ser reescritos, simplificados ou reorganizados para acomodar a engenharia.

A integração será construída em `platform/`, inicialmente nesta branch. Em divergências, o protótipo prevalece e a arquitetura deve ser ampliada.

## Fonte oficial preservada

- `index.html`
- `app.js`
- `styles.css`
- `fidelity.css`
- `map-safety.css`
- `design-tokens.js`
- laboratórios de componentes, movimento, acessibilidade e responsividade
- `assets/`
- evidências `qa-*.png`
- `qa-regression.mjs`
- documentação de auditoria

## Estrutura técnica de destino

```text
platform/
  apps/
    site/       experiência web pública
    app/        experiência do aplicativo/PWA
    admin/      painel administrativo
    api/        contratos HTTP e integrações
  packages/
    ui/         tokens e componentes compartilhados
    domain/     regras de produto
    contracts/  esquemas e tipos entre aplicações
    testing/    fixtures, regressão e utilitários
  database/     esquema, migrações e seeds
  infra/        entrega, observabilidade e serviços
  docs/         decisões e rastreabilidade
```

## Estratégia de transferência

Cada corte vertical deve:

1. apontar as rotas e estados equivalentes no protótipo;
2. extrair contratos sem alterar a fonte;
3. implementar a tela fiel em `platform/apps`;
4. criar domínio, API e persistência ausentes;
5. cobrir loading, vazio, erro, sucesso e indisponibilidade;
6. validar responsividade e acessibilidade;
7. executar a regressão original e testes da arquitetura;
8. registrar cobertura na matriz de migração.

## Ordem inicial

1. Fundação: tokens, contratos, shell, roteamento e testes.
2. Site: home, busca, mapa, detalhe, vendedor, favoritos e publicação.
3. App: autenticação, marketplace, publicação, negociação e reserva.
4. Financeiro: pagamentos, carteira, splits, reembolso e disputas.
5. Logística: modalidades, rastreamento, reagendamento e entregador.
6. Perfil, reputação, notificações, moderação e estados globais.
7. Admin: operação, financeiro, logística, segurança, dados e lançamento.
8. Homologação integral contra as 56 verificações do protótipo.

## Critério de conclusão

Uma rota somente é considerada migrada quando mantém conteúdo, composição, estados, interações, responsividade e acessibilidade do protótipo e possui a engenharia necessária para funcionar no destino.

## Arquitetura Neural do FraldasCycle — exclusiva do ADM

**Estado em 2026-10-09: pausado.** A implantação e a sincronização com o ADM real foram adiadas por decisão do responsável até a plataforma estar funcionando. O código abaixo descreve a integração preparada, sem comprovar ativação operacional. Consulte [a decisão e o roteiro de retomada](../platform/docs/architecture-neural-pause-2026-10-09.md).

A visualização integra o painel em **ADM → Arquitetura Neural**,
rota `/admin/architecture`. Mantém rede geométrica, busca, filtros, seleção de
entradas/saídas, rotação X/Y, expansão das ramificações, animação ilustrativa,
zoom até 12×, deslocamento e centralização.

O acesso exige uma sessão real com papel `admin`, inclusive no ambiente local.
O modo demonstrativo das demais telas não libera este módulo. Clientes,
entregadores, moderadores e visitantes não recebem o mapa. A página e seus
assets são protegidos pelo servidor do ADM; a API protege separadamente
`GET /v1/admin/architecture` com `admin:architecture:read`.

### Sincronização

- Em desenvolvimento, a API reconstrói o mapa do código local ao consultar o
  endpoint. Inclusões, alterações, remoções e imports alteram a revisão SHA-256.
- Em produção, o mapa é o snapshot privado da versão implantada. CI e publicação
  de imagens executam `node platform/tools/architecture-network.mjs` antes de
  empacotar; não há monitoramento de um checkout remoto em produção.
- O painel confere a versão a cada 60 segundos enquanto está visível, ao voltar
  para a aba e pelo botão **Sincronizar agora**, preservando a seleção existente.
- A interface mostra revisão, origem e horários de geração/conferência. Se não
  conseguir revalidar o acesso, oculta a visualização.

Para gerar o snapshot antes de uma implantação manual, execute
`npm run architecture:sync` em `platform/`. O resultado fica em
`platform/apps/api/private/architecture-network.json`, sem rota estática pública.
O mapa registra hierarquia, imports locais resolvidos e injeções identificadas
no runtime. Assets binários, dependências instaladas, lockfile e dados gerados
ficam fora do inventário; chamadas remotas e imports dinâmicos não são inferidos.
A animação não representa tráfego nem reconexões reais de produção.

### Ambiente e acesso

O servidor do ADM usa `ADMIN_SESSION_API_ORIGIN` para encaminhar login, sessão e
logout em `/admin/auth/`, verificar a sessão e consultar a API. O compose de produção configura
`http://api:4200`; em desenvolvimento o padrão é `http://127.0.0.1:4200`.
Em produção, configuração ausente ou indisponibilidade da autenticação bloqueia
o módulo. O login utiliza o mesmo domínio do ADM e encaminha o cookie HttpOnly da API;
a visualização não depende de cookies compartilhados entre subdomínios.

As versões HTML avulsas foram desativadas. Os servidores do protótipo não
publicam mais a pasta `architecture/viewer` nem os arquivos de `platform`;
a navegação do protótipo direciona ao módulo protegido do ADM. Downloads já
obtidos anteriormente não podem ser revogados retroativamente.

Validação específica: `node tests/architecture-admin.test.mjs` em `platform/`.
Os testes cobrem autorização, aliases de URL, dados privados, falha fechada,
sincronização de arquivos/imports e snapshots de produção.
