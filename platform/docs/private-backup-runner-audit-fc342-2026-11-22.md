# FC-342 — auditoria offline do executor privado de backup

Data: 22 de novembro de 2026

## Escopo e resultado

Esta etapa revisa o executor instalado no repositório privado
`bonecodesign/fraldacycle-backups-private`, sem executar workflow, acessar banco hospedado,
ler segredos ou transferir arquivos ao Dropbox.

Correções sintéticas preparadas:

- o runner aceita somente o nome exato do repositório privado aprovado;
- chave de recuperação Base64 de 32 bytes e senha PostgreSQL são verificadas antes de iniciar
  `pg_dump`;
- o checksum é enviado antes do arquivo cifrado, reduzindo o resíduo caso o segundo upload falhe;
- o par remoto é baixado novamente e SHA-256, tamanho e `Dropbox content_hash` são recalculados;
- testes cobrem repositório divergente, chave inválida, senha ausente, leitura remota alterada e
  falha no segundo arquivo.

Os testes usam arquivos aleatórios locais, respostas HTTP simuladas e credenciais fictícias.
Eles não demonstram OAuth Dropbox real, conectividade Supabase, exportação hospedada, retenção,
restauração, RPO ou RTO.

## Evidências externas ainda pendentes

- confirmar por presença, nunca por valor, os seis Actions Secrets;
- confirmar proteção humana efetiva do environment `backup-homologacao`;
- confirmar cota e bloqueio de cobrança de Actions do repositório privado;
- confirmar CA oficial, endpoint Session Pooler porta 5432 e conectividade do runner;
- confirmar aplicativo Dropbox com acesso restrito e escopos `files.content.write` e
  `files.content.read`;
- guardar a chave em cofre independente de GitHub e Dropbox;
- obter autorização específica do fundador antes do primeiro backup;
- executar restauração somente depois, em banco separado e com autorização própria.

O nome de um environment GitHub, CI verde ou mocks não prova aprovação humana. O status formal
permanece 48/70, piloto 16/21 e **NO-GO**.
