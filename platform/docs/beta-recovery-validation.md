# Lote 3 — restauração sintética em PostgreSQL nativo

## Escopo

Item 57: comprovar a ferramenta existente, sem contratar armazenamento, agendar serviço ou acessar produção. O teste usa exclusivamente o cluster descartável e as fixtures fictícias da beta.

## Verificação implementada

Após as jornadas de venda, Premium, moderação, privacidade, instituição, doação e webhooks, o teste usa os executáveis nativos pg_dump e pg_restore com os planos de database/recovery.js. Cria beta_restore separadamente e compara todas as linhas de todas as tabelas públicas, incluindo transações, auditoria e checksums das migrações; compara também last_value/is_called das sequências.

Altera dados somente no destino descartável, confirma que a origem permanece íntegra, restaura novamente e executa as migrações sobre o destino restaurado. Nenhuma credencial é passada nos argumentos. Diretório temporário 0700 e arquivo 0600, criado antes do dump; limpeza em finally. Nenhum dump é publicado ou incluído em artefatos.

## Evidência e limites

CI do commit da31f94fdb0795f3a50e038af20b2f5534869a2d aprovado: job 112041780070, https://github.com/bonecodesign/FRALDAScycle/actions/runs/37392842360/job/112041780070 (consultar também checks do commit). Log BETA_RECOVERY confirma pg_dump/pg_restore e comparações executados. 283 testes, zero falhas/skips; 83 verificações e sintaxe de 119 arquivos. Chrome 154 executou jornadas existentes com Space/Tab/Enter em 320/375/768/1280 px; sem testes humanos, leitor de tela ou dispositivos físicos. Neste workspace, apenas sintaxe e dois testes de contrato foram executados: PostgreSQL nativo ausente.

Em 18 de outubro, o executor local foi endurecido: `pg_dump` escreve em diretório temporário privado (0700), sob `umask` 0077; somente um arquivo não vazio, sem permissão para grupo/outros, é publicado com hard link atômico. Destino preexistente não é sobrescrito e falha remove o temporário. A publicação também gera um arquivo privado `.sha256`; se o checksum não puder ser publicado, o dump recém-criado é removido para não deixar um backup aparentemente utilizável sem prova de integridade. Antes de restaurar, o plano valida com `lstat` que dump e checksum são arquivos regulares e privados, recusa links simbólicos, checksum ausente ou malformado e qualquer divergência do conteúdo. A comparação de origem/destino normaliza caixa, ponto final do DNS, porta padrão e aliases comuns de loopback. Aliases DNS arbitrários não são resolvidos; cabe à operação confirmar que o banco de destino é independente. URLs de origem/destino e variáveis PostgreSQL herdadas de conexão são removidas do ambiente do processo filho; somente configurações construídas a partir da URL e caminhos TLS explícitos são passados. URLs PostgreSQL rejeitam parâmetros desconhecidos ou duplicados e aceitam somente modos `sslmode` reconhecidos; IPv6 e nomes codificados do banco são normalizados antes do uso. Doze testes locais de recuperação passaram, incluindo cenários simulados de sucesso, colisão, falha, adulteração, URL ambígua, arquivo inválido e higienização do ambiente. Essa rodada **não executou pg_dump/pg_restore reais**.

O item 57 continua parcial: as evidências não comprovam cofre/armazenamento operacional, controle de acesso da equipe, política de frequência, RPO/RTO, retenção, restauração em infraestrutura de produção nem execução humana. Sem ativação de serviços ou produção.

Matriz atual em 2026-10-18: 37 concluídos / 70 = 52,86%; 21 parciais e 12 bloqueados. Prontidão para produção permanece bloqueada.
