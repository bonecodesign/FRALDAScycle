# FC-357 — Falhas de busca e catálogo tratadas como texto, nunca HTML

**Projeto único:** FraldaCycle (`bonecodesign/FRALDAScycle`). **Data:** 23/11/2026 (BRT). **Escopo:** superfícies web de busca e home do piloto BH; código e testes sintéticos, sem execução comercial.

## Vulnerabilidade corrigida

A resposta de erro da API pode incluir uma mensagem fornecida por um serviço, intermediário ou entrada inesperada. Antes da FC-357, o aplicativo `apps/app/home.js` e a busca `renderAppSearch` em `packages/contracts/marketplace-ui.js` interpolavam diretamente `error.message` em `innerHTML`. Caso o texto viesse com sintaxe HTML, o navegador poderia interpretá-lo como marcação na tela do usuário. A proteção geral do backend não torna segura essa interpolação em cliente.

Além disso, `renderListingCard` já escapava títulos e tamanhos, mas os identificadores `item.id` eram incluídos diretamente nos atributos HTML `data-live-listing` e `data-live-favorite`.

## Mudanças

- Função reutilizável `renderSafeErrorState` cria uma estrutura DOM com `createElement` e insere **títulos/mensagens via `textContent`**; não transforma retorno de servidor em HTML. Mensagem truncada a 320 caracteres; valor não textual gera descrição genérica.
- Painel mantém as classes visuais existentes e adiciona `role=alert` para sinalizar o erro a tecnologias assistivas. Botão de nova tentativa na home mantém comportamento e é inscrito com `once:true`.
- Ambas as superfícies `/app/home` e busca do aplicativo passam a usar esse componente. Não altera pedidos HTTP, dados, autenticação, regras ou interfaces externas.
- Identificadores de anúncios recebem escape HTML **antes** de inclusão nos atributos citados. O `href` mantém codificação de URL.

## Validação

`tests/marketplace-error-state-security.test.mjs` introduz casos negativos: mensagem HTML maliciosa exibida literalmente como texto; erro malformado, texto grande, retorno acessível e retry; título HTML e identificador tentando injetar atributo do anúncio; inspeção de que ambas as superfícies chamam o caminho seguro.

**A validação automatizada não é uma auditoria de segurança integral, teste de penetração ou ensaio humano de leitor de tela.** As cinco evidências oficiais do piloto (`publish-search-negotiate`, `keyboard-check`, `device-matrix`, `screen-reader-check`, `rollback-owner`) continuam pendentes. Não reclassificar `config/pilot-evidence.v1.json`, `config/pilot-technical-preflight.v1.json` ou o requisito 67 a partir desses testes.

**Portões intactos:** matriz 48/70, pré-validação do piloto BH 16/21, lançamento **NO-GO**. Sem fornecedor real de mídia, revisão humana, dispositivo físico, cobrança, segredos, Supabase hospedado, alteração de políticas LGPD ou outros projetos.
