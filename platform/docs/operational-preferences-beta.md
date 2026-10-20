# Preferências operacionais — integração local do despacho de lembretes

Referências: item 49 do FC-DEC-2026-10-02 e tarefa autorizada de preferências operacionais/horário silencioso. Item 49 continua **parcial**; não atribuir conclusão ao registro de preferências quando o despacho de pagamento, entrega, aprovação e disputa ainda está pendente.

## Implementado

- `GET/PUT /v1/account/operational-preferences`: sessão obrigatória, conta derivada exclusivamente da sessão, sucesso sem cache e validação estrita, sem aceitar conta, publicidade ou aceite de termos no corpo.
- Migração 023: estado atual por conta, histórico por versão e auditoria na mesma transação. Não edita migrações anteriores.
- Ausência é declarada (`configured: false`, versão zero), sem inventar canais padrão. Primeiro salvamento exige escolhas explícitas de e-mail, SMS e push e fuso confirmado.
- Janela opcional com HH:mm e fuso IANA validado, incluindo meia-noite. Janela vazia/de 24 horas é rejeitada como ambígua; ao desativar, horários são nulos. Fuso do navegador é apenas sugestão exibida no formulário, não presume localização do titular.
- Bloqueio da conta serializa a primeira gravação. Versão esperada evita sobrescrever outra aba. Repetição idêntica não altera timestamp/versão e não duplica histórico/auditoria. Escrita diferente com versão antiga retorna 409 e exige recarregar.
- Tela na rota existente de preferências, separada de publicidade e dos termos: carregar, salvar, estados indisponíveis, conflito/erro e feedback vivo. Campos possuem legendas e labels; nova gravação fica bloqueada após erro até recarregar.
- `optionalReminderIsQuiet` decide se um instante está na janela silenciosa. `notificationDispatchDecision` mantém avisos de autenticação/segurança e operacionais necessários fora do adiamento; somente lembretes opcionais são elegíveis.
- A migração 059 associa lembretes opcionais ao titular (`recipient_user_id`) e permite os tipos `payment_reminder`, `delivery_reminder` e `general_reminder`. O serviço de notificações só enfileira esses tipos com conta e canal explícitos.
- No worker, cada lembrete consulta a preferência corrente da conta antes de despachar. Canal sem aceite explícito é cancelado; janela silenciosa adia por 15 minutos sem consumir tentativa; fora da janela, segue o fluxo existente. A política não altera jobs de autenticação.
- Antes do envio opcional, o destinatário deve corresponder ao e-mail ou telefone verificado da conta ativa vinculada ao job. Destino divergente ou conta suspensa cancela o job. Push permanece sem despacho porque ainda não há registro de dispositivo vinculado; o serviço recusa sua criação por enquanto.

## Limites preservados

Não houve ativação de fornecedor nem envio real. O worker está conectado ao outbox para os três tipos opcionais acima; os testes usam provedor simulado e comprovam adiamento/cancelamento sem entrega externa. Não foram criadas campanhas nem rotinas que gerem lembretes automaticamente. Uma preferência com todos os canais falsos não elimina avisos necessários ou acesso à plataforma.

Não são criados lembretes de pagamento/entrega nem campanhas automaticamente. A integração atual limita-se aos três tipos opcionais e mantém o contrato de entrega idempotente do worker. Não definir SLA, e-mail oficial ou política de retenção por este lote.

## Evidência

- Local: `node tests/operational-preferences.test.mjs`, 11 testes aprovados. Cobrem formato, dados extras proibidos, ausência explícita, janelas no mesmo dia/meia-noite, limites inclusivo/exclusivo, mudança de horário de verão, idempotência, isolamento por conta, histórico/auditoria e conflito de versão. Repositório usa banco simulado: teste de versão **não** comprova concorrência em PostgreSQL.
- Sintaxe: `npm run check:production` inclui também arquivos novos e os de consentimento antes ausentes da lista. `git diff --check` sem erros.
- Despacho opcional: `tests/notifications.test.mjs` cobre a decisão do worker, canal e allowlist do serviço; `tests/notification-reminder-dispatch-postgres.test.mjs` prepara a prova em PostgreSQL de vínculo à conta, adiamento sem tentativa, cancelamento por canal desativado inclusive após a criação do job, destino divergente, push sem dispositivo, conta suspensa e envio permitido com destino verificado. O provedor é simulado; nenhum envio real foi feito. A execução em PostgreSQL depende do CI remoto desta rodada.
- A jornada HTTP autenticada de preferências e a interface em Chromium foram comprovadas no PR #74. O novo despacho não tem prova HTTP ponta a ponta; dispositivo físico, leitor de tela, usuários reais e fornecedor continuam pendentes. Verificação estática de labels não substitui validação humana.

Sem contratação, credenciais, dados pessoais reais/infantis, repasses, cobranças, reembolsos, termos jurídicos ativos, desktop ou lançamento. Item 12 permanece em standby. Este avanço não muda a contagem geral: item 49 continua parcial, 37/70 concluídos; prontidão para produção permanece bloqueada.

Atualização no PR #74: persistência, conflito concorrente de duas conexões e retry foram executados em PostgreSQL nativo do CI; a jornada das preferências foi executada em Chrome real com Espaço/Tab/Enter e viewports 320/375/768/1280. A auditoria foi corrigida após erro 42P08, e a conexão local/overflow foram corrigidos após reprodução no navegador. Ver [evidência completa](beta-validation-2026-10-05.md). A ativação de fornecedor e a homologação das categorias operacionais permanecem pendentes.
