# FC-LEG-16 — Política de Retenção, Eliminação e Preservação Legal — minuta v1

**Estado:** pré-operacional; prazos são propostas de produto e dependem de validação legal, contábil e técnica.

## Princípios
Reter pelo período mínimo necessário à finalidade, obrigação legal ou exercício regular de direitos, com prazo, marco inicial, sistema, operador, responsável e prova de eliminação por categoria. Exceções exigem justificativa e data de revisão, nunca retenção indefinida automática.

## Tabela-base
| Categoria | Prazo preliminar / evento |
|---|---|
| Cadastro incompleto | 24 horas após abandono |
| Data de perfil infantil removido | Expurgo operacional imediato; backups expiram até 30 dias |
| Evidência minimizada de aceite familiar | Durante conta + 5 anos, sujeito a parecer |
| Histórico mínimo de alteração de perfil | 12 meses, sem valores anteriores |
| Foto de entrega | 30 dias após confirmação; disputa até 90 dias após decisão |
| Documento de disputa familiar | Até 30 dias após decisão |
| Cópia de certidão de entregador | Até 30 dias **após verificação humana** |
| Logs técnicos | Proposta 30 dias; IP completo até 7 dias, depois mascaramento |
| Eventos individuais de marketing | 30 dias; navegação autorizada até 90 dias |
| Registros financeiros | Proposta 5 anos, sujeito a enquadramento legal/tributário |

## Eliminação e backup
A eliminação abrange banco principal, objetos, cache, CDN, filas, índices, exportações e fornecedores conforme aplicável. Backup não pode restaurar dados apagados como ativos: manter lista de exclusões e reaplicar antes de reativar ambiente. Registrar job, escopo, resultado, falhas, tentativas e confirmação de fornecedor. Em certidões, prazo conta da verificação humana, não do vencimento documental.

## Preservação excepcional
Litígio concreto, obrigação legal ou ordem válida podem exigir retenção limitada. Registrar caso, fundamento, dados, responsável, prazo e revalidação periódica; acesso restrito. Não criar exceção genérica para conservar tudo. Cumprir dever de informação quando aplicável.

## Controles e gates
Auditoria periódica, métricas de exclusão, teste de restauração e purga, monitoramento de falhas, revisão de prazos por jurídico e contabilidade. [INVENTÁRIO REAL — PENDENTE]; [FORNECEDORES — PENDENTES]; [EVIDÊNCIA DE PURGA — PENDENTE].