# Preferências operacionais — lote sem envio externo

Referências: item 49 do FC-DEC-2026-10-02 e tarefa autorizada de preferências operacionais/horário silencioso. Item 49 continua **parcial**; não atribuir conclusão ao registro de preferências quando o despacho de pagamento, entrega, aprovação e disputa ainda está pendente.

## Implementado

- `GET/PUT /v1/account/operational-preferences`: sessão obrigatória, conta derivada exclusivamente da sessão, sucesso sem cache e validação estrita, sem aceitar conta, publicidade ou aceite de termos no corpo.
- Migração 023: estado atual por conta, histórico por versão e auditoria na mesma transação. Não edita migrações anteriores.
- Ausência é declarada (`configured: false`, versão zero), sem inventar canais padrão. Primeiro salvamento exige escolhas explícitas de e-mail, SMS e push e fuso confirmado.
- Janela opcional com HH:mm e fuso IANA validado, incluindo meia-noite. Janela vazia/de 24 horas é rejeitada como ambígua; ao desativar, horários são nulos. Fuso do navegador é apenas sugestão exibida no formulário, não presume localização do titular.
- Bloqueio da conta serializa a primeira gravação. Versão esperada evita sobrescrever outra aba. Repetição idêntica não altera timestamp/versão e não duplica histórico/auditoria. Escrita diferente com versão antiga retorna 409 e exige recarregar.
- Tela na rota existente de preferências, separada de publicidade e dos termos: carregar, salvar, estados indisponíveis, conflito/erro e feedback vivo. Campos possuem legendas e labels; nova gravação fica bloqueada após erro até recarregar.
- Função pura `optionalReminderIsQuiet` decide somente se um instante está na janela de um lembrete opcional. Não está conectada ao worker; não agenda, descarta ou envia mensagens e não altera recuperação/verificação de conta.

## Limites preservados

O envio externo continua desativado. A política de exceções/adiação dos avisos necessários não está definida pelo item 49; foi solicitada definição ao usuário nesta sessão. Este PR prepara o registro e um cálculo isolado para lembretes opcionais, sem ativar política de despacho nem presumir que todos os avisos podem ser silenciados. Uma preferência com todos os canais falsos não elimina avisos necessários ou acesso à plataforma.

Não são criados lembretes de pagamento/entrega nem campanhas. Não se altera o outbox ou worker legado. A futura integração precisa respeitar preferência corrente, entrega idempotente, classificação do aviso e exceções aprovadas. Não definir SLA, e-mail oficial ou política de retenção por este lote.

## Evidência

- Local: `node tests/operational-preferences.test.mjs`, 11 testes aprovados. Cobrem formato, dados extras proibidos, ausência explícita, janelas no mesmo dia/meia-noite, limites inclusivo/exclusivo, mudança de horário de verão, idempotência, isolamento por conta, histórico/auditoria e conflito de versão. Repositório usa banco simulado: teste de versão **não** comprova concorrência em PostgreSQL.
- Sintaxe: `npm run check:production` inclui também arquivos novos e os de consentimento antes ausentes da lista. `git diff --check` sem erros.
- Teste HTTP autenticado preparado para CI com dependências instaladas; local não executado com sucesso por ausência de pg e bloqueio de sockets. Não declarar teste HTTP local aprovado.
- PostgreSQL real (migração limpa/incremental, rollback e duas conexões), Chromium, teclado, viewports, dispositivo físico, leitor de tela e usuários continuam pendentes pelos bloqueios de `beta-inspection-2026-10-05.md`. Verificação estática de labels não substitui teclado/navegador.

Somente `platform/`. Sem contratação, credenciais, dados pessoais reais/infantis, mensagens, repasses, cobranças, reembolsos, termos jurídicos ativos, desktop ou lançamento. Item 12 permanece em standby. Matriz continua com 6/70 concluídos (8,57%); prontidão para produção permanece bloqueada.
