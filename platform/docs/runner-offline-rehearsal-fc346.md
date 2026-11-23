# FC-346 — Ensaio integral sem credenciais e limites do GitHub privado

**Objetivo:** validar a sequência real do script Bash que prepara o backup do FraldaCycle sem executar PostgreSQL, Supabase, Docker ou Dropbox de verdade. Resultado de testes **não** é backup hospedado.

## Ensaio seguro

O novo `platform/tests/private-backup-runner-rehearsal.test.mjs` executa `run-private-backup.sh` com `bash` **real**, mas substitui as chamadas `node` e `docker` por executáveis **fictícios dentro de uma pasta temporária de testes**. Não utiliza conta externa, rede, GitHub Secrets, senha real, chave real ou dados infantis. O executor real da conta privada **não é disparado**.

Cenários:
1. Ordem correta de preflight, quatro verificações Storage, exportação fictícia, TOC fictício, criptografia fictícia, verificação, upload simulado e recibo final;
2. Falha na segunda consulta Storage aborta antes de criptografia/Dropbox;
3. Falha na quarta consulta Storage, mesmo depois de simular um upload, impede o recibo de backup válido;
4. Falta de um segredo obrigatório impede o início;
5. Limpeza de todos os artefatos privados temporários em sucesso e falha.

**Limites:** o ensaio não valida conectividade real, certificado do Supabase, versão do PostgreSQL contêiner, dados exportados, OAuth do Dropbox, restauração ou durabilidade. Esses requisitos continuam bloqueados e precisam de homologação separada.

## Proteção humana no GitHub — cuidado com o plano

O nome `environment: backup-homologacao` no workflow **não prova** que existe um revisor humano obrigatório. Segundo o [GitHub Docs — Reviewing deployments](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/review-deployments), as regras de aprovação por revisores em repositórios **privados** dependem da disponibilidade do plano; em Free, Pro ou Team, as regras de revisão exigida destinam-se apenas a repositórios públicos. É necessário **verificar o painel real** da conta e as permissões, sem supor segurança adicional.

A configuração atual exige disparo manual e frase `BACKUP_FRALDACYCLE_BR`, mas, se o ambiente não tiver regras disponíveis, **não há segunda aprovação independente**. Antes do primeiro backup real, o titular deve avaliar esse risco e permitir explicitamente a execução. Repositório privado reduz exposição dos Secrets, mas **qualquer pessoa com permissão para editar workflows** pode tentar alterar como eles são usados; restringir colaboradores e revisores é necessário.

O conector GitHub desta conversa **não possui** permissões para ler os metadados de Actions Secrets, regras do environment, permissões Actions, quantidade de minutos disponíveis, limite de gastos nem runners: endpoints foram tentados, mas bloqueados. **Não declarar esses itens como conferidos**.

O [GitHub Docs — Managing environments](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments) descreve controles e restrições por plano. A verificação de custos deverá ocorrer no painel `Settings → Billing and licensing` da conta, antes de acionar `Run workflow`. Não contratar GitHub Pro/Team/Enterprise ou add-ons sem nova aprovação.

## Recuperação ainda não integral

O `pg_dump` atual usa `--no-owner --no-privileges`, adequado a um artefato de dados/esquema para homologação mas **não exporta permissões de objetos**, e **não equivale a recuperação integral de papéis/grants/configurações Supabase**. A documentação oficial [Supabase — Backup and Restore using the CLI](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore) descreve exportações de roles, schema e data separadamente, além de migração de objetos Storage. Não alterar essas opções às cegas no ambiente hospedado; planejar a reconstrução de roles/grants/policies, configuração Auth e blobs Storage em homologação isolada.

**Fora do escopo deste PR:** gerar/cadastrar chaves, executar backup real, contratar serviços, consultar/alterar dados pessoais, instalar cron, fazer restore, alterar a matriz, realizar prova de RPO/RTO ou inferir políticas WORM a partir do Dropbox. Gates oficiais permanecem 48/70 (68,57%), piloto BH NO-GO.

Fonte de rastreamento: [FC-339](https://github.com/bonecodesign/FRALDAScycle/issues/339) e [repositório privado de backup](https://github.com/bonecodesign/fraldacycle-backups-private).