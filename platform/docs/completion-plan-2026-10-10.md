# Plano de fechamento após PR #88

Base: main 309faa9, PR #88 integrado. Matriz conferida: 70 requisitos, 8 concluídos, 50 parciais, 12 bloqueados. Conclusão formal 11,43%; cobertura parcial/concluída 82,86%. Cobertura não representa código concluído nem prontidão. Sem percentual comprovado para fidelidade visual, interfaces individuais ou aplicativos nativos.

| Área | Conclusão formal | Cobertura parcial/concluída |
| --- | ---: | ---: |
| Comercial/pagamentos | 11,1% | 77,8% |
| Logística/entregador | 0% | 90,9% |
| Marketplace/moderação | 15,4% | 100% |
| Família/privacidade | 20% | 53,3% |
| Instituições/doações | 0% | 100% |
| Administração/infraestrutura | 13,3% | 86,7% |

Estimativas iniciais de esforço técnico por pessoa, em dias úteis de 6–8 horas. São faixas de planejamento, não prazos garantidos nem medição do código restante; devem ser revistas após inventário e aceite de cada etapa. Etapas curtas podem subdividir cada bloco.

| Sequência | Escopo de fechamento | Esforço estimado | Dependência |
| --- | --- | --- | --- |
| 1 | Entregador: integridade da seleção, consulta de contato autorizada, leitura de situação do repasse sem promessa financeira | 2–4 dias | Local; câmera/GPS e entrega física dependem de homologação |
| 2 | Site/app cliente: inventário de rotas, jornadas de publicação/compra/troca/suporte e correções de interface | 4–8 dias | Referências completas para aceite visual |
| 3 | Administrativo: revisão de comprovantes, suporte, permissões, pausa/retomada e jornadas no navegador | 3–6 dias | Equipe e regras de atendimento para operação real |
| 4 | Instituições: recebimento/recusa, capacidade, representação e consentimentos | 2–4 dias | Validação humana e documental |
| 5 | Infraestrutura: rever evidências de restauração já executada, automação de recuperação, filas, monitoramento e ensaio de implantação | 3–6 dias | Ambiente de homologação, domínio e segredos |
| 6 | Pagamentos/logística/comunicação: conectar fornecedores escolhidos, webhooks, reversões e cobrança | 5–10 dias | Contratos, tarifas e credenciais; item 12 em standby |
| 7 | Homologação final: usuários por papel, dispositivos físicos, privacidade/termos e decisão de ativação | 3–7 dias de execução | Agenda dos participantes e aprovações externas |

Total sequencial inicial: 22–45 dias úteis de esforço, sem contar espera externa. Não inclui implementar e distribuir aplicativos Flutter caso o inventário confirme essa necessidade. Não é estimativa de lançamento: produção continua bloqueada. Requisitos parciais só serão encerrados com evidências correspondentes.

## Etapa curta executada

A seleção do entregador aplica a mesma validação da listagem: página esperada, até 50 registros, IDs/estados válidos e ausência de IDs repetidos. Respostas inconsistentes removem cartões antigos e preservam entrega/foto salvas. Fixtures do histórico passaram a usar IDs distintos. Validação: 11 testes de interface aprovados. Sem execução com fornecedores ou dispositivos físicos.

A matriz antiga contém limites históricos (por exemplo HTTP adiado, MFA e restauração sem validação) que foram parcialmente superados pelas evidências dos PRs #87/#88. Esta conferência preserva os estados até revisão individual dos critérios de aceite, sem usar textos antigos como prova de ausência de código.
