# Portões restantes até a ativação

Base: matriz de 70 requisitos em `docs/requirements-matrix.json`, atualizada em **14/11/2026**; estado remoto consolidado em [17/11/2026](status-atual-2026-11-17.md). A classificação abaixo separa trabalho técnico local de decisões e provas externas. Um adaptador ou teste simulado não comprova operação real.

## Situação formal

- 48 concluídos: 68,57%.
- 11 parciais: 15,71%.
- 11 bloqueados: 15,71%.
- Produção: bloqueada.

## O que ainda pode avançar sem contratar fornecedores

| Requisitos | Próximo fechamento local | Portão que continuará aberto |
| --- | --- | --- |
| 2 | Manter contratos, fórmulas, estados, idempotência e jornadas de homologação protegidos por testes. Os fluxos técnicos do frete individual na troca (item 9), frete separado na venda (item 11), entregador único na troca (item 17) e recebimento institucional (item 18) estão concluídos. | Tarifas, cobrança, entrega e confirmação reais. |
| 10, 12 | Manter a obrigação local da diferença e o processamento de frete desligados. | Homologação financeira da diferença; decisão sobre retirada do standby do frete, fornecedor e tarifas. |
| 26, 27, 28, 31, 32, 33 | Manter controles de minimização, isolamento, correção, remoção e flags desligadas; testar sem dados reais. | Revisão jurídica e de privacidade: finalidade, base, obrigatoriedade, retenção, direitos e ofertas. |
| 41, 45 | Fortalecer filtros, pedidos de exclusão e testes sintéticos. O ciclo técnico de sanções do item 42 está concluído. | Inspeção de mídia real, equipe de moderação, decisão legal de retenção e atendimento humano. |
| 46, 61 | Revisar cópia local, versões e estados de aceite sem ativar termos ou prometer seguro. | Revisão jurídica e aprovação dos termos; condições reais de seguro e garantias. |
| 49, 51, 56 | Testar outbox, preferências, canal externo, pausa operacional e ensaio com dados sintéticos. | Canais oficiais, capacidade da equipe, responsáveis aceitos, exercício observado e fornecedor de mensagens. O suporte interno técnico do item 50 está concluído. |
| 57, 59 | Validar backup/restauração com banco temporário, controles de segredo e diagnóstico de configuração. | Armazenamento, identidades, cofre, rotação e recuperação homologados em infraestrutura real. |
| 60 | Preparar checklist de saída e portabilidade. | Condições contratuais e direitos de exportação/rescisão do fornecedor escolhido. |
| 62 | Testar aceite, autoridade, capacidade e revogação com instituições fictícias. | Documentos, identidade e capacidade reais verificados por pessoas. |
| 67 | Convite, admissão e perímetro de BH têm cobertura técnica sintética; a pré-validação vigente tem **16/21 aprovadas e cinco pendentes** (`publish-search-negotiate`, `keyboard-check`, `device-matrix`, `screen-reader-check`, `rollback-owner`). Testes novos de Chromium não alteram o registro histórico. | Reexecutar a jornada publicação-busca-negociação, teclado e viewports com evidência rastreável; depois leitor de tela humano, dispositivos físicos, responsável de rollback aceito, revisão das contas e decisão formal de iniciar o piloto. |

## Ordem prática de fechamento

1. Preservar as suítes HTTP, PostgreSQL, navegador e containers verdes; registrar separadamente qualquer falha ambiental ou funcional.
2. Manter os controles técnicos do piloto BH desligados por padrão, preflight **16/21** e as cinco evidências pendentes até reexecução e classificação comprovadas. As pendências incluem três itens de validação técnica e dois portões humanos.
3. Repetir a jornada de publicação, moderação, busca e negociação com armazenamento de mídia homologado; conferir Site, App, entregador e Admin em navegador, teclado, leitor de tela humano e dispositivos físicos, sem igualar emulação a teste físico.
4. Executar sessão interna sintética, resposta a incidente, restauração e rollback com responsáveis designados e resultado registrado.
5. Obter decisões comerciais, parecer jurídico/privacidade, equipe e instituições. Só então homologar infraestrutura e fornecedores reais.
6. Repetir CI, testes de integração, diagnóstico de produção e decisão formal de lançamento.

Os itens 3 (processador), 12 (frete), 26–28 e 31–33 (dados infantis), 46 (termos), 51 (suporte externo) e 60 (saída de fornecedor) não podem mudar de bloqueados por código ou simulação apenas. O item 10 agora é parcial: sua regra local está comprovada, mas não pode ser concluído sem homologação financeira real. O item 12 permanece em standby até decisão explícita. Nenhuma porcentagem deve subir sem evidência correspondente à definição de conclusão da matriz.
