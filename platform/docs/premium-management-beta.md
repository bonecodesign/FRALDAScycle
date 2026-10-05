# Gestão local de Premium e anúncios

Base consolidada: `fa8a0cd0f0e05cfb2889cc827b31a9e610880490`, com PRs #60–#74 integrados. O CI de main passou foundation/containers. Todos os 89 arquivos alterados desde a base anterior estão em platform/. A evidência histórica de NO-GO não foi alterada; a consolidação não autoriza operação real.

## Comportamento

Migração 024 prepara registros de períodos pagos, escolha e ajustes dos anúncios. Nenhum endpoint concede assinatura, registra pagamento/falha ou cobra. Períodos usados na validação são fixtures fictícias. Uma fonte real dependerá de homologação separada.

A conta consulta o próprio plano, cancela a próxima renovação com confirmação, escolhe até três anúncios publicados sem operação em andamento e pausa/retoma anúncios próprios. Cancelamento é idempotente, preserva período pago e auditoria. Falha original conserva benefícios por 72 horas; retries não reiniciam esse prazo. Não são geradas mensalidades, retentativas, mensagens ou reembolsos.

Ao retorno ao gratuito, aplicar a escolha do período ou manter os três anúncios publicados mais recentemente. Dados dos excedentes são preservados como pausados, e operações em andamento continuam. A escolha é consumida uma vez: não elimina anúncios gratuitos publicados depois. Escolhas de períodos anteriores não são reutilizadas. Pausa/retomada, escolha e limite de publicação são revalidados com trava por conta, sem confiar no corpo para identidade ou benefícios.

Publicação e início de operação revalidam o plano; cancelar uma operação só republica se houver vaga, caso contrário preserva o anúncio pausado. Rotina local `npm run worker:premium:local` aplica ajustes em PostgreSQL de loopback, uma única vez. Não instala ou agenda serviços. Aplicação periódica sem interação ainda depende de agendamento operacional; por isso os itens 6–8 permanecem parciais.

Tela `/app/premium`, acessível em Configurações e Meus anúncios, carrega dados reais da sessão. Publicação/retomada no gratuito permite até três anúncios. A tela explica contratação indisponível, cancelamento, graça, escolha automática e suporte. São removidos os números fictícios da tela Meus anúncios e as preferências simuladas em Configurações passam a apontar para a tela persistida.

## Validação e limites

Local nesta conversa: 11 testes das regras de Premium e 3 de validação do serviço aprovados, 75 arquivos com sintaxe aprovada e diff sem erros de espaço. PostgreSQL/Chrome locais continuam indisponíveis. A integração nativa acrescenta fixtures de escolha/cancelamento concorrentes, graça, pausa idempotente, preservação de operações, quota concorrente de publicação/retomada e cancelamento sem ultrapassar limite. Navegador acrescenta escolha e cancelamento via Espaço/Tab/Enter e quatro larguras. Resultado do novo lote aguarda CI; não confundir com a evidência aprovada do PR #74.

Sem agendamento de cobranças, assinaturas concedidas ao usuário, avisos enviados, fornecedor, serviço pago, termos ativos, dados reais/infantis, desktop ou produção. Item 12 standby. Retentativas e contratação continuam bloqueadas por fornecedor/revisões; agendamento e aviso operacional são pendências. Matriz permanece 6/70 = 8,57%, separada da prontidão para produção bloqueada.
