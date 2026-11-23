# FC-341 — Executor de backup privado no GitHub Actions (implantação assistida)

> **Atualização de segurança FC-347:** as referências abaixo à pasta de raiz `/FRALDA/Backups-Supabase-BR` e à necessidade de OAuth **Full Dropbox** são históricas e **não se aplicam ao fluxo novo**. O novo executor utiliza somente o diretório virtual de uma app **App Folder** do Dropbox; veja [FC-347 — Dropbox App Folder](dropbox-app-folder-fc347.md). Não usar tokens Full Dropbox com a configuração nova. Nenhum aplicativo foi criado ou autorizado por este pacote.

**Estado desta etapa:** modelo de workflow, script de exportação e integração Dropbox, testes com arquivos fictícios. **Não** houve criação de repositório privado, cadastro de credenciais, exportação PostgreSQL hospedada, upload real, agendamento ou teste de restauração. Matriz 48/70, piloto BH NO-GO.

## Por que um repositório separado?

O repositório `bonecodesign/FRALDAScycle` é **público**. O backup com credenciais de banco e Dropbox deve ser executado apenas por um **repositório PRIVADO** distinto, com Actions manual, segredos protegidos e fonte do código do FraldaCycle fixada a SHA revisada. Nunca ativar um workflow de backup com credenciais no repositório público. O conector GitHub desta conversa **não tem ação de criar repositórios nem gerenciar Actions Secrets**, portanto a primeira criação e o cadastro de segredos dependem do titular na interface GitHub.

## Arquivos entregues e como reutilizá-los

- `platform/infra/private-backup-runner/manual-offsite-backup.workflow.yml` — **TEMPLATE**; não fica sob `.github/workflows` do repositório público, por isso não será executado automaticamente. No **repositório privado**, salvar seu conteúdo como `.github/workflows/manual-offsite-backup.yml`.
- `platform/infra/private-backup-runner/run-private-backup.sh` — invoca exportação existente `database/recovery.js`, criptografia existente `database/recovery-archive.js`, verificação e novo uploader.
- `platform/tools/dropbox-encrypted-upload.mjs` — API oficial Dropbox OAuth 2 com refresh token, sessões de upload em blocos de 4MiB, sem sobrescrita, verificação SHA-256 e `Dropbox content_hash`. Depois do envio, baixa novamente os dois arquivos e recalcula ambos os hashes sem publicar o conteúdo. Envia **somente** `.dump.fcenc` e `.dump.fcenc.sha256` para `/FRALDA/Backups-Supabase-BR`, jamais o dump aberto.
- `platform/tests/dropbox-encrypted-upload.test.mjs` — prova fluxo e rejeições usando API Dropbox simulada, sem contato com banco ou Dropbox reais.

## Uma configuração humana no GitHub (sem computador próprio)

1. No navegador do GitHub, criar `bonecodesign/fraldacycle-backups-private` com **Private** e sem copiar segredos em arquivos. Confirmar cotas do plano e políticas de faturamento de Actions antes de rodar; um repo privado **pode consumir minutos cobrados fora da franquia**.
2. Configurar acesso do conector GitHub ao novo repositório privado, quando solicitado pelo GitHub. Revisar quem pode executar Actions e quem tem acesso a Secrets.
3. Criar o arquivo `.github/workflows/manual-offsite-backup.yml` no repositório privado, copiando o template. **Substituir `REPLACE_WITH_REVIEWED_40_CHARACTER_SHA` pelo SHA integral da versão `main` validada**, registrado depois do merge do PR FC-341. Não usar `main` como referência mutável na máquina que recebe segredos.
4. Em Settings > Secrets and variables > Actions, cadastrar **seis segredos no repositório privado**, diretamente na UI, sem enviá-los ao chat ou ao repositório público:
   - `FC_BR_DATABASE_URL`: string de conexão do **Supabase-BR** (projeto `urbrtnenrsjvgqjhfhdj`) com `sslmode=verify-full`; conexão direta IPv6 ou Session Pooler **porta 5432** caso IPv4, host exato do botão **Connect**. Não usar transaction pooler/porta 6543. O guia Supabase indica conexão direta preferível para `pg_dump`; Session Pooler requer ensaio explícito.
   - `FC_BR_DB_CA_PEM`: certificado raiz de CA válido, obtido do painel Supabase BR > Database Settings > SSL Configuration > Download certificate; nunca desativar `verify-full`.
   - `FC_BACKUP_ENCRYPTION_KEY_B64`: chave aleatória de 32 bytes codificada em Base64. Gerar em ambiente privado confiável, guardar **também** uma cópia de recuperação em cofre separado do GitHub e do Dropbox; não reutilizar senha do banco. **Não pedir a chave no chat**.
   - `FC_DROPBOX_APP_KEY`, `FC_DROPBOX_APP_SECRET`, `FC_DROPBOX_REFRESH_TOKEN`: credenciais de aplicativo Dropbox próprio com autorização OAuth **offline** e escopos mínimos `files.content.write` e `files.content.read`; a leitura é necessária para a conferência independente após o upload. Para gravar na pasta `/FRALDA/Backups-Supabase-BR` do Dropbox raiz, o aplicativo precisa ter **Full Dropbox** (atenção: alcance amplo; token protegido e auditoria de acesso são essenciais). Aplicativos `App folder` só escrevem dentro de `/Apps/<nome>` e não acessam `/FRALDA`. O acesso Dropbox conectado ao ChatGPT **não fornece** esses tokens ao GitHub Actions.
5. Se disponível no plano, configurar o ambiente `backup-homologacao` com restrição de execução e aprovação humana. Mesmo sem regra de aprovador, manter o disparo **manual** e a entrada obrigatória `BACKUP_FRALDACYCLE_BR`.
6. Fazer a **primeira execução somente após verificar segurança, permissões, custo, CA, endpoint e governança do segredo**. Em Actions > workflow manual, fornecer a frase de autorização. Com sucesso, revisar o recibo sem segredos e confirmar no Dropbox o par criptografado+checksum.

## Como a execução trabalha

- Clona por `git fetch` a fonte pública usando **SHA de 40 caracteres** fixada e verifica que o commit baixado corresponde exatamente à referência. Não executa PRs, nem `actions/checkout` com tokens desnecessários.
- Ubuntu hospedado temporário, workflow manual, `permissions: contents: read`, concorrência serializada, prazo máximo 45 minutos, sem schedule. O runner deve oferecer Node >= 20, Docker e acesso ao endpoint escolhido.
- Criado espaço de trabalho 0700 no `RUNNER_TEMP`. O certificado é gravado somente ali com modo 0600. O dump é criado com `pg_dump` PostgreSQL **major 17** em contêiner oficial Docker, com verificação TLS `verify-full` (libpq), depois é cifrado AES-256-GCM e verificado SHA-256; o dump original é removido antes do upload. Remoção de arquivo não equivale a apagamento criptográfico certificado; por isso o runner **temporário e isolado** é condição de segurança.
- O upload envia primeiro o checksum e depois o arquivo cifrado, confirma os recibos e baixa novamente ambos para recalcular SHA-256 e `content_hash`. Se a segunda etapa falhar, resta no máximo o checksum isolado: não declarar backup concluído e revisar manualmente.
- Não há backup agendado, nenhuma verificação de retenção WORM 30 dias, nem restauração real. A gravação Dropbox e proteção na conta dependem de configuração posterior.

## Riscos e limites técnicos

- Executores GitHub hospedados têm cotas e conectividade variável. O contêiner `postgres:17-alpine` faz conexão IPv4 por padrão; endpoint direto Supabase Free geralmente exige IPv6. É necessário testar com o **Session Pooler modo sessão**, host real do painel, ou obter executor compatível com IPv6 antes de qualquer exportação real.
- Dropbox upload usa API OAuth e escopo do aplicativo, **não** o conector ChatGPT; exigir token privado de aplicativo próprio e chaves fora do Dropbox. O projeto não registra tokens no código.
- As ferramentas usam `GITHUB_ACTIONS=true`, repo da conta `bonecodesign` diferente do principal, flags manuais e host Supabase correto. Qualquer falta interrompe a operação antes da exportação.
- GitHub Actions Secrets protegem a configuração mas **não são cofre independente para recuperação de desastre**; o histórico da chave deve permanecer também fora do GitHub. Dropbox não é prova automática de WORM 30 dias nem redundância independente.
- RPO <= 60 min, RTO <= 240 min, continuidade e restauração só são homologados com agenda, cópia validada e teste em PostgreSQL **separado** com revisão humana. Não promover requisitos na matriz com somente CI.

Fontes oficiais: https://docs.github.com/en/actions/concepts/billing-and-usage ; https://supabase.com/docs/guides/database/connecting-to-postgres ; https://supabase.com/docs/guides/platform/backups ; https://docs.dropboxapi.com/dropbox-api/api-reference/user-endpoints/files/upload-session-finish ; https://docs.dropboxapi.com/dropbox-api/api-reference/user-endpoints/files/upload-session-append-v-2 .
