# Retomada da beta — etapa 2: webhook de doação

## Correção e dependência

Este lote parte da cabeça `1345313fb0d9b1fd327ba515e4a24f44d5c4c4e8` do [PR #82](https://github.com/bonecodesign/FRALDAScycle/pull/82), preservando suas alterações. A inspeção está no [PR #83](https://github.com/bonecodesign/FRALDAScycle/pull/83).

Em database/logistics-repository.js, processWebhook consulta o tipo do anúncio no mesmo UPDATE condicional que altera a transação. O destino paid somente é permitido para modalidades diferentes de donation. Falha/cancelamento logístico registra evento, estado da entrega e auditoria, mas conserva donation_confirmed/in_delivery da doação para acompanhamento e suporte. Estados disputed, refunded, completed e cancelled continuam protegidos. Movimento positivo mantém in_delivery e não confirma recebimento, não finaliza operação e não libera valores. Venda e fallback legado de troca permanecem iguais; isso não implementa a jornada de troca.

Não altera migrações aplicadas nem inventa estado de produto, destino de doação, republicação, tarifa ou regra de repasse. Nenhum fornecedor é chamado.

## Validação e limites

Ferramenta tools/beta-logistics-webhook-check.mjs integrada ao teste PostgreSQL nativo existente e à verificação de sintaxe. Executa 69 cenários com dados fictícios: falha/cancelamento antes/depois da coleta, cancelamento tardio ignorado, progressão positiva, entrega final, estados de disputa/reembolso/conclusão/cancelamento, duplicação concorrente e repetição. Verifica resultado persistido, integridade do estado e timestamp da transação protegida, anúncio não republicado, evento/auditoria únicos e ausência de comprovante ou nova intenção financeira. Fixtures de transação/entrega isolam a regressão; não representam contratação ou operação física.

Local nesta sessão: sintaxe dos arquivos corrigidos e dois testes existentes de idempotência aprovados. Execução local da suíte logistics.test.mjs encontrou nove cenários aprovados e dois HTTP bloqueados por listen EPERM no sandbox; não declarar a suíte local aprovada. Clone permanece bloqueado pelo proxy; PostgreSQL nativo indisponível localmente. Resultados nativos completos devem ser conferidos nos logs do CI do commit proposto, incluindo o navegador já integrado à suite. Não substituir PostgreSQL por banco simulado ou registrar testes humanos/leitor de tela/dispositivos físicos como realizados.

## Requisitos e escopo

Matriz existente preservada: 8/70 concluídos = 11,43%; 38 parciais, 12 pendentes, 12 bloqueados na main observada `2c14f89e59d4f219051378ace2f2b2d6af231018`. Correção de integridade não conclui requisitos financeiros/institucionais inteiros. Produção continua bloqueada.

Somente platform/. Desktop/protótipo preservados. Item 12 em standby; dados de crianças não coletados; termos reais não ativados. Sem cobranças, repasses, reembolsos, mensagens externas, credenciais/dados reais, provisionamento pago ou publicação de produção.
