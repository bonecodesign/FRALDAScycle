# Retomada da beta — etapa 1: inspeção em 5 de outubro de 2026

## Escopo e fontes conferidas

Repositório privado bonecodesign/FRALDAScycle. Main observada: `2c14f89e59d4f219051378ace2f2b2d6af231018`. Cabeça do PR #82: `1345313fb0d9b1fd327ba515e4a24f44d5c4c4e8`.

Árvores recursivas de main e da cabeça do #82 retornaram completas, sem AGENTS.md. Diretórios locais /workspace/.agents e /workspace/.codex não disponibilizaram instruções. Lidos README.md, OWNERSHIP.md, architecture/README.md, platform/database/README.md e os três documentos solicitados: approved-rules-implementation.md, completion-tracker-2026-10-02.md e product-readiness-plan.md. Decisões FC-DEC-2026-10-02 lidas em main; blob `b6b4867a2a83bb424541487fcd8700d9c9fbd13b` corresponde ao arquivo alterado pelo [PR #62](https://github.com/bonecodesign/FRALDAScycle/pull/62).

Architecture/README.md exige preservar a fonte visual raiz e implementar em platform/. A decisão mais recente remove propostas/reservas; a menção histórica a reserva na arquitetura não autoriza reintroduzi-la. O tracker de 2 de outubro contém evidência histórica, não o estado atual da beta.

## PRs, dependências e consolidação

- PRs #60–#81 estão integrados. A cadeia #63→#70 foi integrada nas respectivas bases; #60 também integrado em main. #71–#74 e #75–#81 trazem matriz, preferências, Premium, validação nativa, moderação, isolamento logístico, suporte de endereço, pedidos de privacidade, avaliações e autoridade institucional.
- [#82](https://github.com/bonecodesign/FRALDAScycle/pull/82) é o único PR aberto na consulta: rascunho, base main atual, mergeable=true. Seus 37 arquivos alterados estão todos em platform/. Não reimplementar essas entregas.
- Reviews e threads de revisão do #82 estavam vazios. Mergeable e CI verde não substituem revisão.
- Rulesets retornaram 403 por indisponibilidade do recurso no plano do repositório; leitura da proteção de main retornou 403 por falta de acesso da integração. Não foi possível afirmar a lista de checks formalmente exigidos. Nenhuma alteração de plano, proteção ou permissão solicitada.
- Nenhum merge realizado nesta retomada. #82 deve permanecer em rascunho enquanto o achado abaixo não for corrigido e validado. O escopo desta inspeção não certifica revisão integral de todos os domínios.

## Bloqueio reproduzido na revisão do #82

Arquivo: [database/logistics-repository.js](../database/logistics-repository.js), método processWebhook.

Para shipment.failed ou shipment.cancelled, transactionStatus é paid. O UPDATE passou a aceitar donation_confirmed, além de paid/in_delivery. Portanto um evento de falha/cancelamento em uma entrega de doação pode promover a transação para paid, sem intenção de pagamento. O mesmo ramo também permite paid após falha de uma doação que já esteja in_delivery.

Reprodução efetivamente executada nesta sessão: carregar o módulo da cabeça exata do #82, substituir exclusivamente os imports por factories vazias e usar cliente de banco simulado que retorna entrega assigned. Invocar processWebhook separadamente com shipment.failed e shipment.cancelled; inspecionar a mutação SQL e parâmetros. Nos dois casos, alvo paid e donation_confirmed aceito no WHERE. Node 24.19.0, saída 0, fixtures apenas. Não é execução PostgreSQL, webhook externo ou teste físico.

Correção necessária antes de integrar: identificar o tipo da operação e impedir que doação adquira estado financeiro de venda. A falha/cancelamento logístico deve preservar a situação da doação para acompanhamento/suporte; não criar regra de republicação, finalização, repasse ou destino sem decisão aprovada. Cobrir os dois eventos, eventos repetidos, doação antes/depois de coleta e preservação dos estados de disputa/finais. Reexecutar testes nativos em PostgreSQL e navegador dos fluxos afetados.

## Evidências do CI efetivamente inspecionadas

[Job foundation 111832242448](https://github.com/bonecodesign/FRALDAScycle/actions/runs/37330560327/job/111832242448), PR #82, merge de teste `0bcf36636454b5dbc2020ca2fd45795284f1b76f` sobre as cabeças acima:

- 283 testes aprovados, 0 falhas, 0 skipped; sintaxe de 117 arquivos; 83 verificações de regressão.
- Logs BETA_POSTGRES_CLEAN/BETA_POSTGRES comprovam migrações reais, upgrade reservado, isolamento, repetição e concorrência.
- Logs dos cenários de venda, Premium, moderação, privacidade, avaliações, autoridade institucional e doação registram execução em PostgreSQL.
- BETA_BROWSER registra Chrome/154.0.8037.57, Space/Tab/Enter e larguras 320/375/768/1280, com verificações delimitadas de overflow/rótulos nos formulários. Isso não certifica toda a fidelidade visual.
- foundation e containers em push e PR estavam success para a cabeça do #82. Container build é CI; não houve publicação ou ativação de produção.

Essas execuções são evidências anteriores conferidas, não uma nova execução local nesta sessão. Pagamentos, mídia, identidade e entrega física nos cenários são fixtures. Os logs explicitam humanTest=false, screenReader=false e physicalDevices=false. Não há homologação de fornecedores ou usuários.

## Ambiente desta retomada

Clone HTTPS local falhou por conexão ao proxy: Failed to connect to proxy port 8080. CLI gh reportou autenticação indisponível. Não foram lidos valores de credenciais. PostgreSQL nativo não foi encontrado em /usr/lib/postgresql nem psql no PATH; acesso ao socket Docker negado pelo sandbox. O conector GitHub permitiu leitura de fontes, PRs e CI, mantendo o trabalho documental possível. Não contornar proxy, provisionar serviços ou alegar validação local nativa realizada.

## Matriz atual e próximo lote

Fonte única: [requirements-matrix.json](requirements-matrix.json) e sua apresentação [requirements-matrix.md](requirements-matrix.md). Contagem em main: **8 concluídos, 38 parciais, 12 pendentes, 12 bloqueados; total 70**. Percentual estrito: **8/70 = 11,43%**, sem atribuir crédito fracionário aos parciais. Este lote documental não altera classificações. Prontidão para produção permanece bloqueada e não deriva dessa porcentagem.

1. Corrigir o achado do #82 em lote pequeno e preservar a implementação existente; acompanhar CI.
2. Conferir requisitos/referências antes de alterar a matriz já existente.
3. Revalidar base nativa e navegador; distinguir CI de execução local.
4. Prosseguir nas lacunas autorizadas: troca sem inventar seleção do segundo pacote; recusa de doação; avisos operacionais; demais requisitos independentes. Premium, recursos, preferências e suporte de endereço já possuem base implementada.
5. Retenção/exclusão definitiva, dados de crianças, termos ativos, item 12, contratos e homologação humana seguem bloqueados pelas decisões documentadas.

Somente platform/. Protótipo e desktop preservados; sem contratação, provisionamento pago, cobrança, repasse, reembolso, mensagem externa, dados reais ou ativação de produção.
