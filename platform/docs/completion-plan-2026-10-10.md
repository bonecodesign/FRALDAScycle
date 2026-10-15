# Plano de fechamento atualizado após PR #104

Base: main `15685a7d13f2eab9e367f1312fe25aeb7524fa67`, PR #105 integrado em 14 de outubro de 2026; PR #106 em revisão. Matriz conferida: 70 requisitos, 24 concluídos, 34 parciais, 12 bloqueados. Conclusão formal 34,29%; cobertura parcial/concluída 82,86%. Cobertura não representa código concluído nem prontidão. Sem percentual comprovado para fidelidade visual, interfaces individuais ou aplicativos nativos.

| Área | Conclusão formal | Cobertura parcial/concluída |
| --- | ---: | ---: |
| Comercial/pagamentos | 11,1% | 77,8% |
| Logística/entregador | 18,2% | 90,9% |
| Marketplace/moderação | 53,8% | 100% |
| Família/privacidade | 26,7% | 53,3% |
| Instituições/doações | 57,1% | 100% |
| Administração/infraestrutura | 40% | 86,7% |

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

## Etapa curta executada anteriormente

A seleção do entregador aplica a mesma validação da listagem: página esperada, até 50 registros, IDs/estados válidos e ausência de IDs repetidos. Respostas inconsistentes removem cartões antigos e preservam entrega/foto salvas. Fixtures do histórico passaram a usar IDs distintos. Validação: 11 testes de interface aprovados. Sem execução com fornecedores ou dispositivos físicos.

A matriz antiga contém limites históricos (por exemplo HTTP adiado, MFA e restauração sem validação) que foram parcialmente superados pelas evidências dos PRs #87/#88. Esta conferência preserva os estados até revisão individual dos critérios de aceite, sem usar textos antigos como prova de ausência de código.


## Atualização em 11 de outubro de 2026

PRs #101–#104 ampliaram o Site/App sem encerrar requisitos formais: navegação responsiva e atalho de doações; menu ajustado aos cinco destinos aprovados; cards compartilhados com condição do pacote e disponibilidade; detalhe do anúncio com compra protegida e proposta/aceite de troca encaminhados aos fluxos correspondentes. No pagamento, o contato continua condicionado à confirmação efetiva; o cancelamento após pagamento segue assistido pelo suporte. Evidências de regra financeira em `paid-contact-and-supported-cancellation-beta.md` e de troca em `bilateral-exchange-beta.md`.

A etapa 2 (inventário Site/App) está em andamento. A continuação da busca agora implementa categorias infant/swim e filtros de tamanho ponta a ponta (home, URL, controles, API e SQL); validada localmente com 11 testes HTTP/API, navegação e 11 verificações PostgreSQL. A implementação está na rodada de PR #105, ainda sem CI remoto para este incremento. A revisão confirmou que o link `#categorias` da home é atendido pela seção criada dinamicamente em `apps/site/home.js`, e que “Categorias” corresponde à navegação aprovada. Nenhuma alteração no menu é necessária. Próximo: revisar rotas e jornadas de publicação, compra/troca e suporte, e consolidar critérios visuais por tela. A fidelidade visual continua sem percentual comprovado por falta de inventário comparativo completo e referências de aceite.

Validação já registrada para o código integrado do PR #104: suíte local com 517 aprovados, 0 falhas e 11 ignorados por dependências opcionais; checagem de produção em 127 arquivos; CI remoto concluído com `foundation`, `listing-postgres` e `containers` aprovados após repetir uma falha de inicialização do Chrome. Esses números validam a rodada técnica, não alteram a conclusão formal da matriz.

## Continuação do Site — 12 de outubro de 2026

O rodapé compartilhado das nove rotas públicas do Site foi dividido nos quatro grupos definidos pela especificação visual, preservando o aviso específico de cada tela. Destinos de contato e política pré-operacional esclarecem os limites do beta sem simular canal ou aceite legal final. Os 15 testes focados de navegação e contrato visual passaram; a conclusão da fidelidade visual ainda depende de comparar capturas com as pranchas oficiais e testar os viewports normativos.
