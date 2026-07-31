# ADR-001 — Protótipo aprovado como fonte oficial

- Status: aceito
- Data: 2026-07-30
- Escopo: produto, interface e evolução da arquitetura

## Contexto

O protótipo navegável foi aprovado pelo cliente e contém a definição cumulativa de telas, componentes, jornadas, estados, conteúdo, comportamento responsivo, acessibilidade e linguagem visual. A versão integrada fornece a estrutura técnica de destino, mas não redefine o produto.

## Decisão

1. O protótipo aprovado é a fonte oficial do produto e da interface.
2. A versão integrada é a arquitetura técnica de destino.
3. Em qualquer divergência, prevalece o protótipo.
4. O protótipo-fonte não será alterado para acomodar limitações técnicas.
5. Quando a arquitetura não suportar uma capacidade prevista no protótipo, a engenharia deverá criar ou ampliar domínio, contratos, persistência, API, componentes, rotas, estados e testes necessários.
6. A transferência será incremental, por cortes verticais verificáveis, sem eliminar telas, componentes, estados ou fidelidade.
7. Reuso técnico só é válido quando não altera o esquema aprovado.

## Regras de implementação

- Preservar nomenclatura, hierarquia, conteúdo, composição, interação e responsividade aprovados.
- Tratar cada tela e cada estado do protótipo como requisito funcional rastreável.
- Separar claramente interface navegável, simulação local, integração real e requisito futuro.
- Não declarar uma integração como concluída sem implementação, configuração e testes.
- Introduzir adaptadores na arquitetura quando o contrato existente for menor que o produto aprovado.
- Manter o monorepo e suas fronteiras (`apps`, `packages`, `database`, `infra`) como destino, evoluindo-as quando necessário.

## Estratégia incremental

Cada corte deverá incluir:

1. inventário das referências do protótipo envolvidas;
2. contrato de domínio e dados requerido;
3. implementação visual fiel dentro de `apps/web`;
4. adaptação ou criação da API e persistência quando aplicável;
5. estados de carregamento, vazio, erro, sucesso e indisponibilidade previstos;
6. verificação responsiva e de acessibilidade;
7. regressão automatizada e evidência de cobertura.

## Critério de divergência

Uma limitação da versão integrada não autoriza simplificação do produto. Ela identifica trabalho de arquitetura. A decisão padrão é preservar o protótipo e desenvolver a engenharia ausente.

## Consequências

- A cobertura do protótipo passa a orientar o backlog técnico.
- A arquitetura poderá crescer além da demonstração inicial.
- A conclusão será medida por fidelidade e cobertura rastreável, não apenas por compilação ou presença de rotas.
- Mudanças que alterem o produto aprovado exigem decisão explícita do cliente e um novo registro arquitetural; não podem surgir como efeito colateral da implementação.
