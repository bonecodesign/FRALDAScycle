# Pausa e retomada operacional — beta local

## Escopo aprovado

A plataforma possui controle persistente de pausa global ou por domínio para `marketplace`, `payments`, `logistics`, `donations` e `premium`. A alteração exige administrador autorizado, confirmação expressa e justificativa entre 10 e 500 caracteres.

A pausa impede somente novos compromissos: publicação, início de transação, criação de intent/tokenização de pagamento, criação/atribuição/coleta logística, nova doação e mudanças Premium. Suporte, privacidade, reembolso, disputa, acompanhamento, comprovante e conclusão segura de operações existentes permanecem disponíveis.

## Implementação

- `database/migrations/031_operational_control.sql`: estados persistentes e versionados.
- `database/operational-control-repository.js`: leitura, bloqueio concorrente, alteração e auditoria na mesma transação.
- `apps/api/operational-control.js`: validação, classificação de rotas e falha segura.
- `apps/api/admin-handler.js`: consulta e alteração protegidas por `admin:operations:write`.
- `apps/admin/operations.html` e `operational-control.js`: controle administrativo acessível.
- `tests/operational-control.test.mjs`: seis contratos sem socket para regras, persistência, interface e handler.

## Evidências desta etapa

- 6/6 testes específicos aprovados sem HTTP.
- 6/6 contratos de migração e recuperação aprovados.
- 119 arquivos de produção com sintaxe aprovada.
- 83/83 verificações de regressão da interface aprovadas.
- 12/12 contratos de release e fidelidade visual aprovados.
- Matriz e quatro validadores do piloto aprovados.

## Limites

Os itens 68 e 69 permanecem parciais até executar os contratos por HTTP real e aplicar a migração em PostgreSQL nativo. Esta etapa não ativa produção, fornecedores, comunicações ou dados reais. A mesma pessoa administradora pode retomar, mas a confirmação, o motivo, a versão, o responsável e o horário ficam registrados.
