# Revisão técnica de escopos RBAC — beta

Em 2026-10-18, a concessão curinga `*` do papel `admin` foi removida. A lista do administrador agora enumera todos os escopos administrativos referenciados nos módulos atuais da API, além dos escopos de marketplace/entrega previamente herdados. `hasScope` concede somente associação explícita. Um teste varre os módulos da API e falha se surgir um escopo `admin:*` não incluído na lista.

O papel `moderator` mantém somente os escopos explicitamente definidos em `apps/api/authorization.js`; não recebe escrita de papéis, usuários, financeiro, segurança, suporte, privacidade, operações ou validação de entregas. Em 2026-10-18, o responsável do projeto aprovou que moderadores mantenham leitura de e-mail e telefone no diretório de contas; teste HTTP do RBAC cobre a exposição desses campos pela rota autenticada.

## Limite ainda em revisão

O escopo `admin:users:read` permite ao moderador consultar o diretório de contas, cuja resposta atual contém e-mail e telefone, conforme aprovado. A API não concede `admin:users:write` ao moderador. Identidades, sessões, permissões do ambiente real e homologação humana continuam fora da prova local.

Validação: `node --test tests/admin-rbac.test.mjs` — 12 testes aprovados, sem skips. A prova estática cobre escopos nomeados no código da API e não substitui homologação de produção.
