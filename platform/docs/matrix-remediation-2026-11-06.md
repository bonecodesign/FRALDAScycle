# Rodada de resolução da matriz — 06/11/2026

## Referência e regra de aferição

Fonte: `platform/docs/requirements-matrix.md` e `platform/docs/progress-2026-10-11.md` na `main`. Linha de base documentada: 70 requisitos, 42 concluídos, 17 parciais, 11 bloqueados (60,00% de conclusão formal; 84,29% de cobertura parcial/concluída). Não converter cobertura em percentual de implementação. Esta rodada **não** altera estados da matriz.

Cada intervenção exige: (1) conferir código e testes atuais na `main`; (2) delimitar o critério de aceite que ainda falta; (3) implementar somente em `platform/`; (4) executar testes focados e gates aplicáveis; (5) abrir PR com evidências; (6) atualizar a matriz apenas se todos os critérios do requisito delimitado estiverem comprovados. PR não equivale a merge, CI verde ou homologação.

## Fila priorizada — pendências sem fornecedor obrigatório

| Ordem | Item | Estado atual | Próxima intervenção verificável | Condição para mudar o estado |
| --- | --- | --- | --- | --- |
| 1 | 57 — Backup | parcial | Auditar `database/recovery.js`, ensaios de backup/restauração e `docs/beta-recovery-validation.md`; identificar lacunas reproduzíveis e criar testes de falha segura, integridade e restauração em ambiente isolado | Somente após ensaio reproduzível e critérios de backup atendidos; homologação real permanece separada |
| 2 | 56 — Incidentes | parcial | Revisar fluxos de aprovação conjunta, autenticação reforçada e separação de papéis; escrever testes de negação e concorrência antes de alterações | Evidência de todas as condições do requisito, sem simular integração Meta como real |
| 3 | 42 — Burlas e sanções | parcial | Revisar ciclo de suspensão, recurso e expiração; testar autorização, idempotência e preservação de pausas manuais | Governança e operação humana pendentes impedem promoção automática |
| 4 | 45 — Exclusão da conta | parcial | Verificar inventário de retenção, bloqueios por disputa e comportamento seguro sem política jurídica final | Não ativar purga ou inventar prazo de retenção |
| 5 | 49 — Avisos operacionais | parcial | Auditar preferências, fila e desligamento seguro de canais externos; ampliar testes sintéticos de indisponibilidade | Entrega push/e-mail real depende de provedor |
| 6 | 67 — Piloto BH | parcial | Preparar evidências sintéticas restantes, acessibilidade e roteiro de rollback humano | Piloto real e decisão formal exigem execução e aprovação humana |

## Dependências externas: manter bloqueadas

- Item 3: contrato, tarifa e homologação do processador financeiro.
- Item 12: processamento de frete em standby; não atribuir tarifa sem decisão.
- Itens 26–28, 31–33 e 46: decisões jurídicas e de privacidade; não ativar coleta infantil nem termos não aprovados.
- Item 51: suporte externo e canal oficial ainda indefinidos.
- Item 60: saída de fornecedor exige condições contratuais.

Outros parciais de logística, instituições e finanças têm dependências reais. Trabalhar somente no subconjunto técnico independente e registrar explicitamente o que continua bloqueado.

## Restrições de execução

- Protótipo imutável; alterações apenas em `platform/`.
- Não contratar, provisionar, publicar, usar dados reais ou salvar credenciais.
- Não ativar cobranças, reembolsos, entregas, mensageria externa, coleta de dados infantis ou retenção automática.
- Não alterar os 60,00% sem evidência e revisão da matriz.
- Merge apenas com CI exigido aprovado; a existência de testes antigos não comprova a rodada atual.

## Próxima execução de código

Iniciar pelo item 57, consultando `platform/database/recovery.js`, `platform/docs/beta-recovery-validation.md` e testes existentes. Separar a prova local de backup/restauração da homologação do ambiente real. Registrar comandos, resultados e limitações no PR correspondente.
