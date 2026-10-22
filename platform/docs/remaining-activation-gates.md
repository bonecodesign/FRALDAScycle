# Portões restantes até a ativação

Base: matriz de 70 requisitos em `docs/requirements-matrix.json`, revisada em outubro de 2026. A classificação abaixo separa trabalho técnico local de decisões e provas externas. Um adaptador ou teste simulado não comprova operação real.

## Situação formal

- 37 concluídos: 52,86%.
- 21 parciais: 30,00%.
- 12 bloqueados: 17,14%.
- Produção: bloqueada.

## O que ainda pode avançar sem contratar fornecedores

| Requisitos | Próximo fechamento local | Portão que continuará aberto |
| --- | --- | --- |
| 2, 4, 5, 6, 9, 11, 13, 15, 17, 18 | Verificar contratos, fórmulas, estados, idempotência, rastreabilidade e testes de erro usando fixtures. Preparar adaptadores e jornadas de homologação. | Tarifas, liquidação, cobrança, repasse, entrega e confirmação reais. |
| 10, 12 | Documentar o impacto e manter o processamento desligado. | Decisão comercial sobre diferença na troca e retirada do standby do frete; depois, fornecedor e tarifas. |
| 26, 27, 28, 31, 32, 33 | Manter controles de minimização, isolamento, correção, remoção e flags desligadas; testar sem dados reais. | Revisão jurídica e de privacidade: finalidade, base, obrigatoriedade, retenção, direitos e ofertas. |
| 41, 42, 45 | Fortalecer filtros, trilha de revisão, recursos, pedidos de exclusão e testes sintéticos. | Inspeção de mídia real, equipe de moderação, decisão legal de retenção e atendimento humano. |
| 46, 61 | Revisar cópia local, versões e estados de aceite sem ativar termos ou prometer seguro. | Revisão jurídica e aprovação dos termos; condições reais de seguro e garantias. |
| 49, 50, 51, 56 | Testar outbox, preferências, suporte, pausa operacional e ensaio com dados sintéticos. | Canais oficiais, capacidade da equipe, responsáveis aceitos, exercício observado e fornecedor de mensagens. |
| 57, 59 | Validar backup/restauração com banco temporário, controles de segredo e diagnóstico de configuração. | Armazenamento, identidades, cofre, rotação e recuperação homologados em infraestrutura real. |
| 60 | Preparar checklist de saída e portabilidade. | Condições contratuais e direitos de exportação/rescisão do fornecedor escolhido. |
| 62 | Testar aceite, autoridade, capacidade e revogação com instituições fictícias. | Documentos, identidade e capacidade reais verificados por pessoas. |
| 67 | Preparar convite e restrição geográfica no ambiente de piloto; testar bloqueios com contas fictícias. | Convites emitidos, perímetro de BH comprovado e decisão formal de iniciar o piloto. |

## Ordem prática de fechamento

1. Fechar falhas locais e repetir as suítes HTTP e PostgreSQL em ambiente que permita porta local. Registrar separadamente testes aprovados, ignorados e bloqueados pelo executor.
2. Completar os controles técnicos do piloto BH: somente convidados e operações no perímetro autorizado, com prova de acesso negado fora do escopo. Não abrir o piloto por padrão.
3. Conferir jornadas Site, App, entregador e Admin em navegador e dispositivos, incluindo teclado e leitor de tela; comparar a interface com as pranchas oficiais por viewport.
4. Executar sessão interna sintética, resposta a incidente, restauração e rollback com responsáveis designados e resultado registrado.
5. Obter decisões comerciais, parecer jurídico/privacidade, equipe e instituições. Só então homologar infraestrutura e fornecedores reais.
6. Repetir CI, testes de integração, diagnóstico de produção e decisão formal de lançamento.

Os itens 3 (processador), 10 (diferença), 12 (frete), 26–28 e 31–33 (dados infantis), 46 (termos), 51 (suporte externo) e 60 (saída de fornecedor) não podem mudar de bloqueados por código ou simulação apenas. O item 12 permanece em standby até decisão explícita. Nenhuma porcentagem deve subir sem evidência correspondente à definição de conclusão da matriz.
