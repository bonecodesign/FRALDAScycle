# FC-LEGAL-AUDIT-003 — Roteiro Codex por trilha e evidência jurídica

**Data:** 09/11/2026. **Origem:** `platform/config/codex-action-board.v1.json` em `main` (fotografia de 08/11/2026). **Não é ordem de execução externa ou autorização GO.**

## Trilha → requisitos → instrumentos → testes existentes a executar
| Ordem | Trilha | Requisitos | FC-LEG | Testes indicados pelo quadro |
|---|---|---|---|---|
| 1 | Dados infantis e perfis | 26, 27, 28, 31, 32, 33 | 01, 02, 13–19 | `child-profile-http-postgres`, `family-profile-foundation`, `responsible-registration-http-postgres` |
| 2 | Pagamento, frete e troca | 2, 3, 9, 10, 11, 12, 17 | 06–09, 20, 24 | `logistics-commission-conservation`, `delivery-quote-http-postgres`, `exchange-http-postgres` |
| 3 | Operação, suporte e instituições | 18, 42, 50, 62 | 05, 12, 21, 25 | `institution-receipt-http-postgres`, `support-operations-http-postgres`, `moderation-suspension-expiry-postgres` |
| 4 | Backup, credenciais, fornecedores, seguro | 57, 59, 60, 61 | 10, 16, 18–20, 28 | `database-recovery`, `backup-storage`, `secret-governance` |
| 5 | Comunicação, suporte externo, incidentes | 49, 51, 56 | 18, 19, 21, 23 | `notifications`, `operational-notices-http-postgres`, `operational-incident-http-postgres` |
| 6 | Exclusão de conta e mudanças de termos | 45, 46 | 01–03, 16, 17, 25, 30 | `account-closure-retention-postgres`, `account-closure-http-postgres`, `account-consents` |
| 7 | Contatos em imagens | 41 | 04, 21, 22 | `approved-business-rules`, `marketplace-providers` |
| 8 | Piloto BH e acessibilidade | 67 | 25–28, 30 | `pilot-bh-http-postgres`, `pilot-technical-preflight`, `pilot-execution` |

**Todos os caminhos de teste acima são relativos a `platform/tests/`**. Esta matriz é uma referência de planejamento; os testes **não foram executados nesta auditoria**.

## Regras para Codex
1. Verificar `main` e branches atuais, sem tomar a fotografia de 08/11 como estado atual.
2. Para cada requisito, produzir: ID, status oficial, controle técnico, evidência de teste, obrigação legal, contrato/parecer exigido, risco residual e responsável **a designar**.
3. Rodar testes locais/sintéticos pertinentes, registrar comando, SHA, ambiente, resultado e falhas; nunca afirmar prova em provedor real.
4. Não promover requisito por documentação ou teste sintético; item **12 permanece standby** até decisão expressa.
5. Não modificar protótipo, contratar, usar credenciais reais, fazer deploy ou implementar orquestração autônoma.
6. Somente abrir PRs técnicos com autorização específica; não fazer merge automático.

## Pendências de busca documental
- FC-JUR-01 a FC-JUR-50 individuais: **não localizados na busca de índice executada**, não presumir inexistência.
- Revisão jurídica, privacidade, trabalhista, consumerista, fiscal e acessibilidade: **não homologadas por este documento**.
- PR #215: **já integrada à main**, diferentemente dos relatos históricos da PR #222; P-01/P-02 ainda requerem prova real e parecer.

## Critério de avanço
Uma linha só muda de status quando o requisito específico tiver evidência adequada, parecer e aprovação de responsáveis. O indicador oficial de 70 requisitos permanece independente do indicador de 30 minutas jurídicas. Piloto **NO-GO**.
