# Lote 3 — restauração sintética em PostgreSQL nativo

## Escopo

Item 57: comprovar a ferramenta existente, sem contratar armazenamento, agendar serviço ou acessar produção. O teste usa exclusivamente o cluster descartável e as fixtures fictícias da beta.

## Verificação implementada

Após as jornadas de venda, Premium, moderação, privacidade, instituição, doação e webhooks, o teste usa os executáveis nativos pg_dump e pg_restore com os planos de database/recovery.js. Cria beta_restore separadamente e compara todas as linhas de todas as tabelas públicas, incluindo transações, auditoria e checksums das migrações; compara também last_value/is_called das sequências.

Altera dados somente no destino descartável, confirma que a origem permanece íntegra, restaura novamente e executa as migrações sobre o destino restaurado. Nenhuma credencial é passada nos argumentos. Diretório temporário 0700 e arquivo 0600, criado antes do dump; limpeza em finally. Nenhum dump é publicado ou incluído em artefatos.

## Evidência e limites

CI do commit da31f94fdb0795f3a50e038af20b2f5534869a2d aprovado: job 112041780070, https://github.com/bonecodesign/FRALDAScycle/actions/runs/37392842360/job/112041780070 (consultar também checks do commit). Log BETA_RECOVERY confirma pg_dump/pg_restore e comparações executados. 283 testes, zero falhas/skips; 83 verificações e sintaxe de 119 arquivos. Chrome 154 executou jornadas existentes com Space/Tab/Enter em 320/375/768/1280 px; sem testes humanos, leitor de tela ou dispositivos físicos. Neste workspace, apenas sintaxe e dois testes de contrato foram executados: PostgreSQL nativo ausente.

O item 57 continua parcial: este ensaio não comprova cofre/armazenamento operacional, controle de acesso da equipe, política de frequência, RPO/RTO, retenção, restauração em infraestrutura de produção nem execução humana. Sem ativação de serviços ou produção.

Matriz: 8 concluídos / 70 = 11,43%; 39 parciais, 11 pendentes e 12 bloqueados. Prontidão para produção permanece bloqueada.
