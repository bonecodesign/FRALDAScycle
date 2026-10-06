# Lote 3 — restauração sintética em PostgreSQL nativo

## Escopo

Item 57: comprovar a ferramenta existente, sem contratar armazenamento, agendar serviço ou acessar produção. O teste usa exclusivamente o cluster descartável e as fixtures fictícias da beta.

## Verificação implementada

Após as jornadas de venda, Premium, moderação, privacidade, instituição, doação e webhooks, o teste usa os executáveis nativos pg_dump e pg_restore com os planos de database/recovery.js. Cria beta_restore separadamente e compara todas as linhas de todas as tabelas públicas, incluindo transações, auditoria e checksums das migrações.

Altera dados somente no destino descartável, confirma que a origem permanece íntegra, restaura novamente e executa as migrações sobre o destino restaurado. Nenhuma credencial é passada nos argumentos. Diretório temporário 0700 e arquivo 0600, criado antes do dump; limpeza em finally. Nenhum dump é publicado ou incluído em artefatos.

## Evidência e limites

Validação nativa deste lote pendente de CI. Neste workspace PostgreSQL nativo está ausente; não alegar execução local de restauração. O CI deve executar sem skip.

O item 57 continua parcial: este ensaio não comprova cofre/armazenamento operacional, controle de acesso da equipe, política de frequência, RPO/RTO, retenção, restauração em infraestrutura de produção nem execução humana. Sem ativação de serviços ou produção.

Matriz: 8 concluídos / 70 = 11,43%; 39 parciais, 11 pendentes e 12 bloqueados. Prontidão para produção permanece bloqueada.
