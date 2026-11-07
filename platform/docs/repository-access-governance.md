# Governança de acesso ao código

## Fluxo aprovado

- colaborador técnico de nível 2 trabalha em branch e abre pull request;
- nível 2 não faz merge direto;
- mudança comum exige revisão mínima de nível 4;
- mudança de produção, segurança, financeiro ou dados exige aprovação final do fundador, nível 5;
- código e testes usam somente dados sintéticos; acesso ao repositório não concede painel, banco, logs, backups, segredos ou fornecedores reais.

O contrato `packages/contracts/code-governance.js` classifica a lista de arquivos usando `config/code-governance.v1.json`. Caminhos sensíveis incluem workflows, autenticação, autorização, segredos, pagamentos, Asaas, privacidade, perfis infantis, migrações, níveis internos, deploy e configuração.

## GitHub ainda pendente

Para a regra produzir bloqueio remoto, será necessário:

1. cadastrar identidades reais nos grupos correspondentes aos níveis 2, 4 e 5;
2. configurar proteção de `main` contra push direto;
3. exigir pull request e checks aprovados;
4. configurar `CODEOWNERS` com o fundador e equipes reais;
5. exigir aprovação do proprietário em arquivos sensíveis;
6. impedir que o autor aprove o próprio PR.

Nenhum usuário ou equipe fictícia foi colocado em `CODEOWNERS`. Até a configuração remota ser confirmada, o contrato local documenta e testa a política, mas não alega enforcement no GitHub.

## Revisão de governança — 07/11/2026

O inventário de paths sensíveis foi ampliado para incluir rotinas de incidentes, notificações, workers, banco, contratos, pré-validação do piloto, matriz de requisitos e políticas de governança. O contrato rejeita caminhos de diff malformados e classifica mudanças externas a `platform/` como sensíveis, **sem** autorizar alteração do protótipo imutável.

A auditoria remota está em [`github-governance-audit-2026-11-07.md`](github-governance-audit-2026-11-07.md). O repositório está público; a consulta de rulesets retornou lista vazia; a proteção tradicional de `main` não pôde ser consultada (403), e `.github/CODEOWNERS` ainda não existe. Não há prova de aplicação remota de revisões obrigatórias, nem nomeação de revisores reais. Esta rodada **não** alterou configurações do GitHub. Mesmo a aprovação do CI e o merge de uma PR não constituem homologação dos níveis humanos de revisão.
