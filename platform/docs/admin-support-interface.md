# Seleção e resposta no suporte administrativo

A fila /admin/launch remove ações antigas ao consultar e descarta respostas de uma atualização anterior. Abrir atendimento limpa os dados anteriores, bloqueia o formulário durante a consulta e só libera resposta após confirmar o ID e estado do protocolo solicitado. Respostas fora de ordem não alteram a seleção mais recente.

Responder usa o ID da seleção confirmada, sem confiar no campo oculto. Impede envio repetido enquanto há uma solicitação pendente e impede abrir outro protocolo durante o envio. Campos ficam bloqueados até a resposta e recarga do atendimento/fila. Erro no envio preserva o texto e exige consultar o protocolo novamente para conferir se a resposta já foi registrada, evitando reenvio imediato após resultado desconhecido. Não faz retentativa automática de POST.

Consultas têm limite de 15 segundos. Data inválida não derruba a tela; aparece Data não informada. Estado inválido ou detalhe de outro protocolo mantém resposta bloqueada. Dados são renderizados por textContent. A autorização de leitura/escrita permanece no backend, sem novos privilégios.

Validação selecionada: 43 testes (seis de interface concorrente, 13 de snapshots administrativos e 24 de foundation) aprovados. Cobrem seleção fora de ordem, falha/ID divergente, preservação de rascunho, bloqueio de repetição, troca de protocolo durante envio, resposta vinculada ao ID confirmado e atualizações concorrentes da fila. Cenário Chromium adicional consulta, responde por teclado e reabre o protocolo com API/PostgreSQL locais, conferindo uma mensagem e estado under_review, em quatro larguras sem overflow.

Limites: não adiciona idempotência persistente às respostas, paginação de suporte, envio externo, cancelamento/reembolso ou atendimento humano. Exige conferência da mensagem persistida antes de reenviar depois de falha. As telas de suporte de /admin/operations e do cliente possuem implementações distintas e não são encerradas por esta alteração. Percentuais formais mantidos.

Validação integrada final após sincronizar com PR #89: PostgreSQL/Chromium aprovados com as duas jornadas juntas. Total local selecionado 44 testes, zero falhas; sintaxe de 124 arquivos e 83 verificações do protótipo aprovadas. Sem dispositivo físico ou operação real.
