# Inventário auditável dos 70 requisitos — linha de base v1

Data da apuração: 2026-11-04. Fonte: [requirements-matrix.json](requirements-matrix.json), atualizada em 2026-10-31. Commit base da main: `4171678daf6f02b88ac4352975ca4a5e9d9b993c`.

**Conclusão funcional estrita: 42/70 = 60.00%.** Parcial: 17; bloqueado: 11; cobertura concluído+parcial: 84.29%. Esta métrica não concede crédito parcial e não equivale a homologação. O indicador ponderado de oito domínios em [PROJECT_PROGRESS.md](PROJECT_PROGRESS.md) permanece **não aferido** até mapeamento completo e pesos internos aprovados; não misturar os dois denominadores.

## Resumo por área (grupos exclusivos, todos os 70 IDs)

| Área | Total | Concluídos | Parciais | Bloqueados | Conclusão |
|---|---:|---:|---:|---:|---:|
| Comercial e pagamentos | 9 | 7 | 1 | 1 | 77.78% |
| Logística e entregador | 11 | 6 | 4 | 1 | 54.55% |
| Marketplace e moderação | 13 | 11 | 2 | 0 | 84.62% |
| Família e privacidade | 15 | 6 | 2 | 7 | 40.00% |
| Instituições e doações | 7 | 5 | 2 | 0 | 71.43% |
| Administração e infraestrutura | 15 | 7 | 6 | 2 | 46.67% |

## Inventário individual

| ID | Área | Requisito | Estado | Evidência na matriz |
|---:|---|---|---|---|
| 1 | Comercial e pagamentos | Comissão de venda | concluido | [Fonte e limites](requirements-matrix.json) |
| 3 | Comercial e pagamentos | Processamento do produto | bloqueado | [Fonte e limites](requirements-matrix.json) |
| 4 | Comercial e pagamentos | Taxa de troca | concluido | [Fonte e limites](requirements-matrix.json) |
| 6 | Comercial e pagamentos | Renovação Premium | concluido | [Fonte e limites](requirements-matrix.json) |
| 7 | Comercial e pagamentos | Retorno ao gratuito | concluido | [Fonte e limites](requirements-matrix.json) |
| 8 | Comercial e pagamentos | Falha de renovação | concluido | [Fonte e limites](requirements-matrix.json) |
| 10 | Comercial e pagamentos | Diferença na troca | parcial | [Fonte e limites](requirements-matrix.json) |
| 13 | Comercial e pagamentos | Repasse ao vendedor | concluido | [Fonte e limites](requirements-matrix.json) |
| 14 | Comercial e pagamentos | Prazo e silêncio | concluido | [Fonte e limites](requirements-matrix.json) |
| 2 | Logística e entregador | Comissão logística | parcial | [Fonte e limites](requirements-matrix.json) |
| 9 | Logística e entregador | Frete na troca | parcial | [Fonte e limites](requirements-matrix.json) |
| 11 | Logística e entregador | Frete na venda | parcial | [Fonte e limites](requirements-matrix.json) |
| 12 | Logística e entregador | Processamento do frete | bloqueado | [Fonte e limites](requirements-matrix.json) |
| 15 | Logística e entregador | Repasse ao entregador | concluido | [Fonte e limites](requirements-matrix.json) |
| 17 | Logística e entregador | Entregadores na troca | parcial | [Fonte e limites](requirements-matrix.json) |
| 19 | Logística e entregador | Comprovante mínimo | concluido | [Fonte e limites](requirements-matrix.json) |
| 23 | Logística e entregador | Endereço | concluido | [Fonte e limites](requirements-matrix.json) |
| 24 | Logística e entregador | Aviso de endereço | concluido | [Fonte e limites](requirements-matrix.json) |
| 25 | Logística e entregador | Acesso ao comprovante | concluido | [Fonte e limites](requirements-matrix.json) |
| 36 | Logística e entregador | Exceção logística de contato | concluido | [Fonte e limites](requirements-matrix.json) |
| 16 | Marketplace e moderação | Conclusão da troca | concluido | [Fonte e limites](requirements-matrix.json) |
| 20 | Marketplace e moderação | Divergência | concluido | [Fonte e limites](requirements-matrix.json) |
| 21 | Marketplace e moderação | Cancelamento antes da coleta | concluido | [Fonte e limites](requirements-matrix.json) |
| 22 | Marketplace e moderação | Após coleta | concluido | [Fonte e limites](requirements-matrix.json) |
| 35 | Marketplace e moderação | Contatos entre partes | concluido | [Fonte e limites](requirements-matrix.json) |
| 37 | Marketplace e moderação | Autorização de contatos | concluido | [Fonte e limites](requirements-matrix.json) |
| 38 | Marketplace e moderação | Avaliações | concluido | [Fonte e limites](requirements-matrix.json) |
| 39 | Marketplace e moderação | Contatos em avaliações | concluido | [Fonte e limites](requirements-matrix.json) |
| 40 | Marketplace e moderação | Contatos no chat | concluido | [Fonte e limites](requirements-matrix.json) |
| 41 | Marketplace e moderação | Contatos nos anúncios | parcial | [Fonte e limites](requirements-matrix.json) |
| 42 | Marketplace e moderação | Burlas e sanções | parcial | [Fonte e limites](requirements-matrix.json) |
| 43 | Marketplace e moderação | Contestação | concluido | [Fonte e limites](requirements-matrix.json) |
| 44 | Marketplace e moderação | Suspensão e pendências | concluido | [Fonte e limites](requirements-matrix.json) |
| 26 | Família e privacidade | Dados do bebê | bloqueado | [Fonte e limites](requirements-matrix.json) |
| 27 | Família e privacidade | Obrigatoriedade do dado infantil | bloqueado | [Fonte e limites](requirements-matrix.json) |
| 28 | Família e privacidade | Parceiros e idade | bloqueado | [Fonte e limites](requirements-matrix.json) |
| 29 | Família e privacidade | Publicidade | concluido | [Fonte e limites](requirements-matrix.json) |
| 30 | Família e privacidade | Maioridade | concluido | [Fonte e limites](requirements-matrix.json) |
| 31 | Família e privacidade | Perfis distintos | bloqueado | [Fonte e limites](requirements-matrix.json) |
| 32 | Família e privacidade | Mais de um bebê | bloqueado | [Fonte e limites](requirements-matrix.json) |
| 33 | Família e privacidade | Correção/remoção de datas | bloqueado | [Fonte e limites](requirements-matrix.json) |
| 34 | Família e privacidade | Cookies publicitários | concluido | [Fonte e limites](requirements-matrix.json) |
| 45 | Família e privacidade | Exclusão da conta | parcial | [Fonte e limites](requirements-matrix.json) |
| 46 | Família e privacidade | Mudanças nos termos | bloqueado | [Fonte e limites](requirements-matrix.json) |
| 47 | Família e privacidade | Histórico de aceite | concluido | [Fonte e limites](requirements-matrix.json) |
| 48 | Família e privacidade | Separação de escolhas | concluido | [Fonte e limites](requirements-matrix.json) |
| 52 | Família e privacidade | Privacidade via suporte | concluido | [Fonte e limites](requirements-matrix.json) |
| 61 | Família e privacidade | Seguro e garantias | parcial | [Fonte e limites](requirements-matrix.json) |
| 5 | Instituições e doações | Entrega de doação | concluido | [Fonte e limites](requirements-matrix.json) |
| 18 | Instituições e doações | Recebimento institucional | parcial | [Fonte e limites](requirements-matrix.json) |
| 62 | Instituições e doações | Instituições aprovadas | parcial | [Fonte e limites](requirements-matrix.json) |
| 63 | Instituições e doações | Doação aberta | concluido | [Fonte e limites](requirements-matrix.json) |
| 64 | Instituições e doações | Recusa de doação | concluido | [Fonte e limites](requirements-matrix.json) |
| 65 | Instituições e doações | Capacidade institucional | concluido | [Fonte e limites](requirements-matrix.json) |
| 66 | Instituições e doações | Marca institucional | concluido | [Fonte e limites](requirements-matrix.json) |
| 49 | Administração e infraestrutura | Avisos operacionais | parcial | [Fonte e limites](requirements-matrix.json) |
| 50 | Administração e infraestrutura | Suporte interno | parcial | [Fonte e limites](requirements-matrix.json) |
| 51 | Administração e infraestrutura | Suporte externo | bloqueado | [Fonte e limites](requirements-matrix.json) |
| 53 | Administração e infraestrutura | Acesso administrativo | concluido | [Fonte e limites](requirements-matrix.json) |
| 54 | Administração e infraestrutura | Autenticação administrativa | concluido | [Fonte e limites](requirements-matrix.json) |
| 55 | Administração e infraestrutura | Revogação administrativa | concluido | [Fonte e limites](requirements-matrix.json) |
| 56 | Administração e infraestrutura | Incidentes | parcial | [Fonte e limites](requirements-matrix.json) |
| 57 | Administração e infraestrutura | Backup | parcial | [Fonte e limites](requirements-matrix.json) |
| 58 | Administração e infraestrutura | Dados fictícios de teste | concluido | [Fonte e limites](requirements-matrix.json) |
| 59 | Administração e infraestrutura | Credenciais | parcial | [Fonte e limites](requirements-matrix.json) |
| 60 | Administração e infraestrutura | Saída de fornecedor | bloqueado | [Fonte e limites](requirements-matrix.json) |
| 67 | Administração e infraestrutura | Piloto BH | parcial | [Fonte e limites](requirements-matrix.json) |
| 68 | Administração e infraestrutura | Pausa operacional | concluido | [Fonte e limites](requirements-matrix.json) |
| 69 | Administração e infraestrutura | Retomada | concluido | [Fonte e limites](requirements-matrix.json) |
| 70 | Administração e infraestrutura | Consolidação de decisões | concluido | [Fonte e limites](requirements-matrix.json) |

## Limitações e gates

- Os estados e links de evidência individuais são mantidos na matriz JSON, única fonte de verdade; esta tabela é um retrato datado, não uma nova matriz independente.
- A evidência registrada por requisito não foi reexecutada neste levantamento; validação atual de CI, PostgreSQL, navegador e containers requer nova execução e conferência por SHA.
- Homologação humana, jurídica, financeira, infraestrutura real e fornecedores permanecem pendentes; **NO-GO** para lançamento público.
- Não mudar estados de bloqueado por simulação, documentação ou código apenas.
- Próximo ciclo: mapear cada um dos 70 IDs aos oito domínios ponderados, definir pesos internos e critérios de aceite sem duplicidade; validar cobertura e evidências atuais antes de publicar o índice ponderado.
