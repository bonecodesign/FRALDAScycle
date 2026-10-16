# Gestão local de Premium e anúncios

Base consolidada: `fa8a0cd0f0e05cfb2889cc827b31a9e610880490`, com PRs #60–#74 integrados. O CI de main passou foundation/containers. Todos os 89 arquivos alterados desde a base anterior estão em platform/. A evidência histórica de NO-GO não foi alterada; a consolidação não autoriza operação real.

## Comportamento

Migração 024 prepara registros de períodos pagos, escolha e ajustes dos anúncios. Nenhum endpoint concede assinatura, registra pagamento/falha ou cobra. Períodos usados na validação são fixtures fictícias. Uma fonte real dependerá de homologação separada.

A conta consulta o próprio plano, cancela a próxima renovação com confirmação, escolhe até três anúncios publicados sem operação em andamento e pausa/retoma anúncios próprios. Cancelamento é idempotente, preserva período pago e auditoria. Falha original conserva benefícios por 72 horas; retries não reiniciam esse prazo. O worker registra um aviso interno idempotente, e a tela apresenta a data limite e os efeitos da falha. Não são geradas mensalidades, retentativas externas, mensagens externas ou reembolsos.

Ao retorno ao gratuito, aplicar a escolha do período ou manter os três anúncios publicados mais recentemente. Dados dos excedentes são preservados como pausados, e operações em andamento continuam. A escolha é consumida uma vez: não elimina anúncios gratuitos publicados depois. Escolhas de períodos anteriores não são reutilizadas. Pausa/retomada, escolha e limite de publicação são revalidados com trava por conta, sem confiar no corpo para identidade ou benefícios.

Publicação e início de operação revalidam o plano; cancelar uma operação só republica se houver vaga, caso contrário preserva o anúncio pausado. A rotina local `npm run worker:premium:local` aplica ajustes em PostgreSQL de loopback uma única vez. O worker `npm run worker:premium` executa a mesma regularização de forma sequencial e periódica, exige `NODE_ENV=production`, `PREMIUM_REGULARIZATION_ENABLED=true` e intervalo entre 15 minutos e 24 horas, e encerra por sinal sem iniciar outra rodada. O compose de produção o mantém em perfil explícito `premium-regularization`, portanto não há ativação acidental.

Tela `/app/premium`, acessível em Configurações e Meus anúncios, carrega dados reais da sessão. Publicação/retomada no gratuito permite até três anúncios. A tela explica contratação indisponível, cancelamento, graça, escolha automática e suporte. São removidos os números fictícios da tela Meus anúncios e as preferências simuladas em Configurações passam a apontar para a tela persistida.

## Validação e limites

Local nesta conversa: 11 testes das regras de Premium e 3 de validação do serviço aprovados, 75 arquivos com sintaxe aprovada e diff sem erros de espaço. PostgreSQL/Chrome locais continuam indisponíveis. A integração nativa acrescenta fixtures de escolha/cancelamento concorrentes, graça, pausa idempotente, preservação de operações, quota concorrente de publicação/retomada e cancelamento sem ultrapassar limite. Navegador acrescenta escolha e cancelamento via Espaço/Tab/Enter e quatro larguras. CI do commit 365cac99303dddee40c40924815f72bf936322bd aprovado: 259 testes, 83 verificações e 75 arquivos de sintaxe. [Log da execução](https://github.com/bonecodesign/FRALDAScycle/actions/runs/37306706677/job/111752010111). PostgreSQL executou todas as novas asserções e Chrome 154 executou escolha/cancelamento por teclado e as larguras 320/375/768/1280 sem overflow ou controles cortados. O erro inicial foi uma asserção síncrona do teste e ficou preservado no histórico. Nenhum teste humano, leitor de tela ou dispositivo físico foi executado.

Sem agendamento de cobranças, assinaturas concedidas ao usuário, avisos enviados, fornecedor, serviço pago, termos ativos, dados reais/infantis, desktop ou ativação em produção. Item 12 standby. Retentativas, contratação e aviso operacional continuam bloqueados por fornecedor/revisões. O item 7 está concluído no escopo técnico; os itens 6 e 8 permanecem parciais.
