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

## Exclusão

O fluxo atual abre e analisa solicitações sem apagar contas automaticamente. Permanecem pendentes: confirmação por senha e código, janela cancelável de sete dias, bloqueio de novas operações, espera de pendências, interrupção da renovação Premium, anonimização após retenções legais e worker de encerramento. Não ativar exclusão automática antes da matriz jurídica de retenção.
