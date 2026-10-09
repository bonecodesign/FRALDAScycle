# Repetição segura do envio de anúncios

Site e app guardam a chave UUID de envio e o pedido exato na sessão da aba antes de solicitar a criação. Uma tentativa repetida com os mesmos dados reutiliza o pedido original, inclusive localização, e não executa novamente a geocodificação.

A migração `043_listing_creation_idempotency.sql` grava chave e impressão SHA-256 no anúncio, com índice único por vendedor/chave. A API compara os dados normalizados e recupera o anúncio existente. O repositório repete essa consulta sob o bloqueio da conta do vendedor antes de inserir. Anúncio, fotos e identidade do envio são gravados na mesma transação.

Uma chave usada com dados diferentes gera conflito. Após uma falha de conexão ou resposta 5xx, o envio continua pendente; a tela permite retomar os dados daquela tentativa. Uma rejeição 4xx inicial permite corrigir os campos e gerar outra chave. Se já houve uma resposta incerta, uma rejeição posterior não descarta a tentativa anterior.

Chamadas antigas sem chave continuam aceitas e não recebem essa proteção. A garantia cobre novas publicações feitas pelo site/app com a mesma chave; não deduplica anúncios parecidos criados intencionalmente com chaves diferentes, nem substitui a revisão administrativa.

Validação local com provedor, armazenamento e banco simulados: mesma chave/dados, conflito, recuperação do estado atual, bloqueio antes da consulta, repetição após recarregar e correção após rejeição inicial.

Validação adicional em PostgreSQL 16 temporário: todas as 43 migrações aplicadas, atualização preservando um anúncio anterior, execução concorrente de migrações, 20 envios simultâneos gerando um anúncio e uma foto, conflito de conteúdo, isolamento por conta e rollback provocado na gravação de mídia. O executor de migrações confirma cada arquivo antes do seguinte para permitir uso dos novos valores de enum. Base real de operação, provedores reais e testes HTTP continuam pendentes.
