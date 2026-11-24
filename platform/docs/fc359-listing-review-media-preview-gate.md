# FC-359 — Moderação: nenhuma URL de revisão antes de comprovar TODAS as imagens

**Projeto exclusivo:** FraldaCycle (`bonecodesign/FRALDAScycle`).
**Data:** 23/11/2026 (horário de Brasília).
**Escopo:** contrato HTTP de moderação de anúncios, com provas sintéticas; sem fornecedor de mídia real, fotos reais, banco hospedado ou lançamento.

## Lacuna distinta das proteções existentes

As etapas FC-310/316/358 já exigem processamento de mídia (WebP, remoção EXIF, antimalware, OCR/QR, contatos não permitidos, propriedade e validade), conferem URLs externas e impedem redirecionamento de upload no navegador. A aprovação final em `createAdminService.reviewListing()` também invoca `verifyListingMedia` antes de gravar `published`.

Porém, no **GET** `/v1/admin/listings/:id/review`, o código anterior consultava `signedProofRead` de cada item do banco **sem verificar antes** se o lote permanecia processado/limpo e pertencente ao anunciante. Isso deixava a prévia do moderador dependente de validação apenas no momento da publicação: um provedor poderia emitir URL de leitura para imagem ainda não processada, com metadados ou conteúdo inadequado.

## Medida aplicada

`apps/api/admin-handler.js` agora usa o contrato `verifiedListingReviewMedia` que, antes de solicitar qualquer URL:
1. exige as duas capacidades do provedor (`verifyListingMedia` e `signedProofRead`), negando ausência;
2. exige anúncio efetivamente em `review`;
3. exige **1–8** fotos, chave de cada foto vinculada ao anunciante, nenhuma chave duplicada e sem segmentos `..`;
4. verifica **todo o lote** com `verifyListingMedia(sellerId, keys)` e só prossegue se devolver `{verified: true, count: keys.length}`;
5. somente então solicita links temporários com o ID do revisor, sem expor `storage_key` na resposta JSON.

Se uma foto está pendente, inválida, fora do lote ou a confirmação não é completa, o GET falha fechado, sem gerar URL de prévia. O POST mantém sua **reverificação própria** imediatamente antes da aprovação, bem como contexto assinado ligado ao revisor/sessão/conteúdo, bloqueio de revisão pelo próprio anunciante e controle transacional do estado no PostgreSQL.

## Prova técnica

Novo teste `tests/listing-review-media-preview-gate.test.mjs` verifica lote de duas imagens, sequência **verificar antes de assinar**, ausência total de URLs em falhas de processamento, verificação incompleta, status divergente, lote duplicado/estrangeiro e indisponibilidade de provedor. O teste de integração `tests/publication-review-http-postgres.test.mjs` agora também demonstra que o GET autenticado retorna `409 media_not_ready` sem emitir link quando a imagem fictícia está pendente, e em seguida emite link após verificação completa.

## Limites e gate que permanece

O teste não executou antimalware/OCR/QR em fotografias reais, não forneceu aprovação humana e não prova disponibilidade/qualidade de mídia hospedada. Links temporários reais, revogação, egress/DNS, fornecedor de processamento, verificação de filtros e revisão visual observada ainda exigem homologação MED-G01–G12. A verificação anterior à leitura não substitui o exame por um revisor nem elimina risco de alteração de objeto no provedor; imutabilidade efetiva é requisito externo.

**Requisito 41** continua `parcial`. **Piloto BH:** 16/21 evidências técnicas e `publish-search-negotiate` pendente. **Matriz:** 48/70, **NO-GO**. Nenhuma ativação, contrato, custo, coleta de dados infantis, aprovação de publicação real ou alteração em outro projeto.
