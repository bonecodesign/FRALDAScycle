# Reserva da fila e remoção de códigos

A migração 045 acrescenta `claim_token` à fila. Cada reserva gera um UUID novo; a consulta de elegibilidade e os registros de entrega, falha ou cancelamento exigem esse UUID e uma reserva válida por dez minutos. A recuperação de reserva vencida remove sua identificação, e a nova reserva recebe outro UUID. Trabalhador antigo ou sem identificação não envia pelo fluxo normal nem altera a tarefa retomada.

As reservas concorrentes continuam usando `FOR UPDATE SKIP LOCKED`. A chave de idempotência enviada ao fornecedor permanece o identificador da mensagem, estável entre reservas e retentativas. A garantia externa depende de o fornecedor respeitar essa chave: uma falha após o envio e antes da confirmação no banco pode exigir repetição. Esta implementação não promete entrega externa exatamente uma vez.

O registro de entrega remove imediatamente `payload.token`. Cancelamento e oitava falha também removem o código; a última falha encerra as tentativas. No início de cada lote, a manutenção remove códigos de notificações concluídas antigas, vinculadas a tokens consumidos/expirados ou contas suspensas. Mensagens legadas sem vínculo são descartadas após cinco minutos para MFA e trinta para as demais finalidades. Consumo e expiração são limpos na próxima execução do trabalhador; não existe um agendamento novo nesta etapa.

O histórico conserva identificador, finalidade, estado, canal e demais dados operacionais. A remoção é do código em texto aberto na fila, não de backups anteriores, memória do processo, dados do fornecedor ou metadados sujeitos à política de retenção.

Validação local: 16 testes de serviço/trabalhador, dez testes selecionados de identidade sem HTTP e dez testes PostgreSQL passaram (36 no total), sem skips. Vinte reservas disputaram uma tarefa e somente uma venceu. Reserva vencida não confirmou/cancelou/alterou a tarefa; após recuperação, respostas antigas também não alteraram a reserva nova. Quatro trabalhadores, com fornecedor simulado, processaram vinte mensagens distintas uma vez cada. Limpeza após entrega, uso, expiração, código legado e fim das tentativas foi comprovada. As 45 migrações passaram e o banco temporário foi removido.

Ativação: aplicar a migração 045 e substituir todos os trabalhadores pela versão que exige identificação de reserva antes de iniciar o processamento. Trabalhadores antigos precisam estar parados durante a troca, pois desconhecem a proteção. Credenciais, idempotência do fornecedor e operação agendada continuam pendentes de homologação real.
