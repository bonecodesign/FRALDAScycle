# FC-345 — Quatro verificações de cobertura do Supabase Storage por tentativa de backup

**Status:** preparação em código do executor privado, sem ativação. O piloto segue NO-GO; matriz 48/70 = 68,57%.

## Por que esta correção existe

O FC-344 verificava no começo se `storage.buckets` e `storage.objects` estavam vazios. Isso não bastava: durante um `pg_dump`, a criptografia ou o upload poderia ocorrer a criação de novos objetos de mídia. Um backup do PostgreSQL inclui os metadados de Storage, mas **não contém os bytes das fotos e anexos**. Ver [Supabase — Download Objects](https://supabase.com/docs/guides/storage/management/download-objects).

A proteção FC-345 repete a mesma consulta `SELECT EXISTS` de FC-344 (sem dados pessoais, caminhos, nomes ou conteúdo dos objetos) em quatro pontos sequenciais do executor:

1. **Antes da exportação**: se já existir bucket ou objeto, recusa o backup apenas do banco.
2. **Depois de `pg_dump` + validação estrutural do TOC, antes de AES-256-GCM**: detecta objetos criados durante a exportação.
3. **Depois da criptografia e antes de transmitir ao Dropbox**: detecta objetos criados durante o preparo do artefato.
4. **Depois do upload verificado, antes de declarar sucesso**: detecta objetos criados durante a transmissão e leitura de verificação.

`set -Eeuo pipefail` interrompe todo o fluxo quando uma dessas consultas falha, quando a conexão TLS não pode ser confirmada ou quando o resultado indica bucket/objeto presente.

## Segurança e limitações

- Os comandos permanecem apenas no workflow **manual** do repositório **privado**. A conexão usa PostgreSQL 17, CA privada, `sslmode=verify-full` e o Supabase-BR exato, validado previamente.
- Os quatro resultados são estados binários, não nomes de usuário, imagens, IDs nem conteúdo. Logs não devem imprimir strings de conexão nem credenciais.
- Se a quarta verificação falhar, **um par criptografado pode já estar no Dropbox**, mas a execução retorna falha e **não pode ser considerada backup completo**. Não fazer exclusão remota automática sem revisar evidências. Essa distinção deve estar clara para quem homologar.
- **Não há instantâneo atômico** das tabelas PostgreSQL + arquivos externos. Mesmo quatro verificações não impedem uma mudança logo após a última consulta ou um objeto temporário criado e excluído entre consultas. Precisamos, antes do uso comercial, de backup e recuperação dos bytes do Storage, com versões e consistência, retenção protegida e ensaio completo.
- Não comprova RPO ≤ 60 min, RTO ≤ 240 min, WORM de 30 dias, nem restauração real. Não alterar a matriz por testes com dados sintéticos.

## Evidências deste pacote

`platform/infra/private-backup-runner/run-private-backup.sh` contém os quatro pontos de verificação com a função existente `platform/tools/storage-binary-coverage-preflight.mjs`. `platform/tests/private-backup-runner.test.mjs` confere a quantidade, ordem, comportamento de falha no shell e ausência de comandos destrutivos.

Depois de CI 5/5 aprovado e merge, a SHA revisada deverá ser sincronizada com `bonecodesign/fraldacycle-backups-private` por PR separado. **Não disparar workflow privado.**

Tarefa de referência: [FC-339](https://github.com/bonecodesign/FRALDAScycle/issues/339).