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
