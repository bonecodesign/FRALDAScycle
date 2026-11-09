# FraldaCycle — passagem técnica para Codex após integração P-01/P-02 (2026-11-08)

> **Ponto de entrada atualizado em 09/11/2026:** [Consolidação das oito PRs, 28 requisitos e trilha Codex](codex-consolidacao-prs-e-trilha-codex-2026-11-09.md) (mesma PR #224). O roteiro distingue decisões recentes da PR #235, documentos legais da #227, conflitos #115/#130 e homologações pendentes. **Esse roteiro prevalece para a ordem de trabalho atual**, preservando o texto abaixo como histórico pós P-01/P-02. Não presume autorização de merge ou ativação.

## Estado confirmado
- PR #215 integrado na main, merge commit `f51e99be03adee9002ea3be5390ae4cdb8e53d31`. O PR #223 sincronizou a branch previamente.
- CI no head sincronizado `93ececd2c4583da27b7b6db7a4360c5689858a61`: execução [42530649709](https://github.com/bonecodesign/FRALDAScycle/actions/runs/42530649709), sucesso nos quatro jobs `foundation`, `listing-postgres`, `containers` e `browser-postgres`.
- `foundation`: 1.221 testes passaram, 0 falharam e 16 foram ignorados; P-01 PostgreSQL (migração e limpeza atômica), preflight legado e P-02 (doação institucional sem frete, pagamento ou repasse) aprovados.
- PR #222 permanece separado, em draft: consolidação documental FC-JUR-50 e auditoria das 28 pendências. Não presumir que o PR #222 foi integrado.

## Próxima sequência para Codex
1. Conferir `main`, árvore e CI após merge `f51e99be`. Se houver novo commit, rodar a suíte no head atual. Não inferir aprovação de produção a partir do CI.
2. Revisar o PR #222, atualizar sua branch a partir de `main` sem sobrescrever mudanças, conferir diffs e CI; integrar somente se seguro. Preservar `platform/` como único local de adaptação, mantendo o protótipo imutável.
3. Atualizar `platform/docs/requirements-matrix.json` e documentação de rastreabilidade apenas mediante evidências verificáveis; manter 28 itens (17 parciais, 11 bloqueados) como pendentes até comprovação individual. Conferir IDs 2,3,9,10,11,12,17,18,26,27,28,31,32,33,41,42,45,46,49,50,51,56,57,59,60,61,62,67.
4. P-01: executar ensaio com adapter de armazenamento real em ambiente isolado, sem credenciais em GitHub; demonstrar confirmação do provedor, evidência opaca, limpeza transacional e falha segura. Não afirmar exclusão real somente por teste sintético.
5. P-02: validar contrato e interface de doação institucional sem pagamento, comissão, repasse, frete ou entregador da plataforma; retirada organizada pela instituição. Testar tentativas de campos proibidos e migrações.
6. Preparar matriz de evidências por requisito (arquivo, teste, resultado, responsável, risco residual, decisão e data); separar testes automatizados, revisão profissional e autorização operacional.
7. Preparar pacotes para revisões humanas ao final do ciclo: jurídico/LGPD, segurança, financeiro-contábil, acessibilidade, infraestrutura e produto; não marcar como aprovados antecipadamente.

## Restrições e gates
- Piloto BH permanece **NO-GO**; não ativar pagamentos, entregas, contas de fornecedores, serviços pagos, publicação externa nem armazenar segredos no repositório.
- Revisão humana ao final do trabalho preparatório, conforme orientação do responsável, sem dispensar homologação obrigatória antes de produção.
- Não implementar orquestração autônoma/IA agora; manter somente como possibilidade futura.
- Em cada PR, documentar testes executados, status de CI, riscos e limitações. Não fazer merge de mudanças que falhem testes ou violem proteções de branch.
