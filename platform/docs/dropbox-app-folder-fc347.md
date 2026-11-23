# FC-347 — Destino Dropbox com acesso somente à pasta do aplicativo

**Status:** implementação e testes com dados sintéticos. **Não houve** criação de aplicativo Dropbox, autorização OAuth real, acesso a Secrets, envio, apagamento, alteração do Supabase ou execução do workflow privado.

## Por que trocar o acesso

A integração anterior preparava arquivos cifrados para a pasta existente `/FRALDA/Backups-Supabase-BR` na raiz da conta Dropbox, o que exigiria um aplicativo OAuth do tipo **Full Dropbox**. Um token desse tipo poderia permitir ações também sobre outros documentos da conta, sujeito aos escopos.

O modelo **App Folder** restringe a autorização ao diretório próprio do aplicativo, em `/Apps/<nome-do-app>`, conforme [documentação OAuth do Dropbox](https://docs.dropboxapi.com/dropbox-api/docs/oauth). Dentro das chamadas de API, **essa pasta já é a raiz virtual**. Logo, para enviar um arquivo `fc-br-123.dump.fcenc`, a rota correta na API é `/fc-br-123.dump.fcenc`, **não** `/Apps/<nome>/fc-br-123.dump.fcenc` e nem `/FRALDA/Backups-Supabase-BR/...`. Ver [Writing a Script](https://docs.dropboxapi.com/dropbox-api/docs/get-started/tutorial/writing-a-script).

A pasta antiga `/FRALDA/Backups-Supabase-BR` **permanece como está e não é usada pela nova integração**. Não migrar nem remover pastas por esta etapa. Nenhum arquivo real havia sido enviado para ela na última conferência.

## O que muda no código

- `DROPBOX_BACKUP_FOLDER` passa a ser o prefixo vazio, representando a **raiz virtual do App Folder**. Todo nome continua protegido por expressão regular: somente arquivos de padrão `/fc-br-<identificador>.dump.fcenc` e `*.sha256`, sem subdiretórios, leitura de arquivos abertos, sobrescrita ou rota arbitrária.
- `FC_DROPBOX_ACCESS_POLICY=APP_FOLDER_ONLY` é exigido por `validateBackupSource`, pelo script Bash e pelo template de GitHub Actions. A política rejeita flags de uso da pasta antiga ou configuração ausente.
- A criptografia AES-256-GCM, autorização manual, verificação do checksum e `Dropbox content_hash`, download de readback, bloqueios Supabase/Storage e GitHub permanecem inalterados.
- **Limitação de segurança explícita:** a variável de configuração **não prova automaticamente** o tipo de autorização OAuth. Somente a conferência de **App Folder no Dropbox Developer Console** e uso do aplicativo correto garantem essa restrição. Se for inserido indevidamente um token Full Dropbox, `/fc-br-...` representaria a raiz ampla da conta. **Não rodar** sem confirmar o tipo de aplicativo; não interpretar CI offline como prova de escopos.

## Passos humanos restantes (não realizar na conversa)

1. No painel oficial `https://www.dropbox.com/developers/apps`, criar um **Scoped app** com **App folder** (não Full Dropbox). Um nome próprio ajuda a identificar a pasta futura. Não contratar plano/serviço.
2. Em Permissions, conceder apenas `files.content.write` e `files.content.read`. O segundo permite conferir o arquivo **baixado novamente**. Sem `sharing.write` ou acesso a outras pastas. Não há necessidade de enviar arquivos infantis.
3. Autorizar esse aplicativo com OAuth **offline**, obtendo chave do aplicativo, segredo e refresh token por fluxo confiável. Guardar os três no GitHub Actions Secrets do repositório **privado**, sem enviar os valores ao chat, issues, código, PRs, logs ou Dropbox. Não confundir token de acesso curto com refresh token.
4. Confirmar que o painel do aplicativo indica **App folder** antes de qualquer execução. Esse é um gate humano **obrigatório**.
5. Confirmar o cofre externo para a chave AES, a URL PostgreSQL/CA do projeto BR, a franquia financeira de Actions e a aprovação expressa do titular para uma única execução real.
6. Após teste autorizado, verificar o par cifrado na pasta física `/Apps/<nome-do-app>` e comparar o download; executar restauração **somente em banco isolado** e sob aprovação distinta.

**Importante:** antes de configurar o aplicativo, **não** é necessário criar qualquer pasta dentro do Dropbox. A pasta especial do aplicativo surge após sua autorização, e o runner escreve os arquivos cifrados diretamente nessa raiz.

## Controle de mudança

O repositório privado `bonecodesign/fraldacycle-backups-private` mantém uma referência SHA fixada. Após aprovação do CI deste PR e merge no público, atualizar **por PR privado separado** `.github/workflows/manual-offsite-backup.yml` e `tools/validate-private-config.mjs` para a SHA revisada. Não trocar por branch flutuante; não executar o workflow para testar sincronização.

A homologação real ainda exige cobertura de roles, grants, Auth, Storage, retenção WORM, RPO/RTO, restauração e histórico verificável. Sem custo novo ou operação comercial, requisitos 48/70 e piloto BH **NO-GO** permanecem inalterados.
