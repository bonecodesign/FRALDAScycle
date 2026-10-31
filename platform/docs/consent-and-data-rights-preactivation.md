# Consentimentos e direitos de dados — pré-ativação

Estado em 2026-10-25: fundação técnica preparatória. Termos e políticas continuam em rascunho e dependem de revisão jurídica e de privacidade antes da ativação.

## Consentimentos implementados nesta etapa

- marketing é uma escolha única, opcional e desligada por padrão;
- ativar significa habilitar os canais promocionais disponíveis; desativar revoga todos imediatamente;
- avisos operacionais, segurança e recuperação de conta permanecem separados;
- promoção só é elegível uma vez a cada 30 dias;
- navegação individual para marketing expira em 90 dias;
- abertura e clique individuais expiram em 30 dias;
- cookies necessários permanecem ativos;
- análise e marketing são escolhas opcionais independentes;
- preferências autenticadas são versionadas e possuem histórico auditável;
- estados antigos mistos de marketing são migrados para desativado, sem ampliar consentimento.

Antes do login, a futura camada pública deve manter a escolha somente no dispositivo. Depois do login, a preferência da conta deve prevalecer. O banner público com `Aceitar`, `Recusar` e `Personalizar` em igual destaque ainda precisa ser ligado a todas as páginas antes do lançamento.

## Exportação preparada

- exige evidência de senha e código de e-mail verificados;
- permite uma solicitação a cada 30 dias;
- artefato fica disponível por sete dias;
- envelope AES-256-GCM com chave derivada por scrypt;
- senha existe apenas durante a criptografia e não integra o envelope;
- dados infantis ativos podem entrar no arquivo criptografado;
- senha, tokens, segredos, cartão, CVV e controles antifraude são recusados.

A coleta dos dados, worker de geração, armazenamento restrito, download autenticado e eliminação do artefato ainda não estão ligados ao runtime. A meta aprovada de preparação em até 24 horas permanece um requisito do futuro worker.

As solicitações agora são persistidas com formato JSON/CSV, intervalo de 30 dias,
autorização reforçada de uso único e estado `pending_storage`. O banco não possui
coluna para senha, chave derivada, conteúdo em texto aberto ou token de download.
Enquanto não houver armazenamento/KMS aprovado, `generationAllowed` permanece
falso e nenhum artefato é produzido.

O coletor usa consultas com lista explícita para conta, endereços, perfis infantis
ativos, transações, consentimentos, aceites e resumo de segurança. Senhas, CPF
derivado, referências do provedor, payload de checkout e tokens não são
consultados. O serializador recusa campos sensíveis também de forma recursiva.
O worker aceita um adaptador de armazenamento injetado e, sem ele, retorna
`storage_not_configured` sem serializar dados ou tocar na senha. Com adaptador,
somente o envelope autenticado e criptografado é enviado.

O ciclo de artefato também está preparado: reserva otimista por versão, escrita
criptografada, confirmação por referência opaca e SHA-256, download somente em
sessão autenticada com `no-store`, e eliminação após sete dias. A integridade é
recalculada antes da entrega. Falha ao confirmar o banco tenta eliminar o objeto
órfão; expiração elimina o objeto antes de limpar a referência. O runtime usa
deliberadamente o adaptador desativado, portanto ainda não gera nem entrega
arquivos reais.

## Exclusão

O fluxo atual exige senha e código por e-mail vinculados à finalidade, abre a solicitação com janela cancelável de sete dias, bloqueia novas operações, interrompe a renovação Premium e preserva o acompanhamento de obrigações existentes. O worker classifica solicitações vencidas entre pendências operacionais e prontas para revisão; quando não há pendências, cria um inventário técnico único das categorias de dados. Ele nunca apaga a conta nem autoriza exclusão automática.

Permanecem pendentes a classificação jurídica de retenção, a política de anonimização depois dos prazos legais, a conferência humana de identidade e o procedimento final de atendimento. `automaticErasureAllowed` permanece falso em todas as respostas e registros. Não ativar purga ou anonimização antes da matriz jurídica e de privacidade.
