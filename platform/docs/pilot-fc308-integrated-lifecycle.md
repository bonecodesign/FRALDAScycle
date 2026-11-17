# FC-308 — Encadeamento integrado da publicação com PostgreSQL local

**Situação:** validação técnica sintética; não é homologação com mídia real, aprovação humana, checkout, entrega ou piloto. Piloto BH **NO-GO**.

## Por que esta etapa é adicional, não repetição

Testes existentes já verificavam separadamente criação de anúncios com idempotência, revisão administrativa, busca, restrição de chat, formulários e navegador Chromium. No teste de persistência de anúncios, duas publicações de preparação eram marcadas como `published` diretamente por SQL para exercitar filtros — esse atalho **não** demonstrava a passagem integrada pelos serviços de aprovação e catálogo.

O FC-308 **preserva os testes históricos** e adiciona, no mesmo PostgreSQL temporário, um ciclo novo com um anúncio previamente recuperado de falha de armazenamento, **sem publicar diretamente via SQL**:

1. Vendedor fictício cria anúncio no status `review`; não aparece no catálogo, e consulta pública por ID é recusada.
2. Revisor fictício independente abre o detalhe, com auditoria da consulta, e emite contexto assinado local, vinculado a sessão e dados do anúncio.
3. O serviço recusa revisão pelo próprio vendedor, e recusa mídia sintética não confirmada sem gravar decisão.
4. Após uma resposta **simulada** de mídia válida, o serviço administrativo real registra `published`, revisão/auditoria e prazo de validade; nova aprovação conflituosa é recusada.
5. Busca e detalhe públicos passam a mostrar o anúncio e o preço original, comprovando a passagem por API de serviço e PostgreSQL.
6. Comprador fictício inicia uma operação `initiated` por serviço de marketplace; a reserva da última unidade oculta o anúncio da busca e impede reservar novamente.
7. Chat é recusado para comprador/vendedor antes de pagamento confirmado e para terceiros sem participação. **Nenhuma intenção real de pagamento** é criada.

Código de teste: [`tests/listing-creation-postgres.test.mjs`](../tests/listing-creation-postgres.test.mjs). O ambiente CI usa exclusivamente o banco efêmero `fc_listing_creation_test` em `127.0.0.1`/localhost e o fixture de imagem não faz requisições externas.

## Limites que não podem ser promovidos

- Não é uma sessão de publicação de oito etapas em navegador com upload e moderação visual humana; os testes do browser permanecem complementares, em [`tools/pilot-publication-browser-check.mjs`](../tools/pilot-publication-browser-check.mjs).
- A mídia é verificada por **adaptador fictício em memória**, que não prova EXIF, OCR/QR, existência, armazenamento ou segurança de imagens reais.
- A abertura da operação não confirma pagamento; o chat é comprovadamente negado, e o fluxo de conclusão financeira/logística permanece bloqueado.
- Não há homologação com leitores de tela, dispositivos físicos, responsáveis reais de rollback ou fornecedor externo.
- O registro histórico [`pilot-evidence.v1.json`](../config/pilot-evidence.v1.json) fica intacto. A classificação [`pilot-technical-preflight.v1.json`](../config/pilot-technical-preflight.v1.json) segue com **16 de 21 evidências aprovadas** e cinco pendentes; o item `publish-search-negotiate` ainda **não** cumpre a definição integral de homologação.

**Condições para integrar a PR:** `foundation`, `wallet-postgres`, `listing-postgres`, `containers` e `browser-postgres` aprovados no mesmo commit, sem ativação de serviços, produção ou dados reais.

**Próxima lacuna específica:** homologar o adaptador de mídia e realizar a jornada completa com evidências de execução e observação humana, sem reaproveitar apenas simulações como aprovação formal.
