# Correção e nova submissão de anúncios

A conta pode corrigir título e descrição e, opcionalmente, substituir todas as fotos de um anúncio rejeitado pela revisão administrativa. Tipo de operação, preço, produto e instituição permanecem os mesmos neste recorte.

POST /v1/account/listings/:id/resubmit exige sessão, declaração adulta, confirmação explícita e updated_at da consulta anterior. A transação confere proprietário, restrições da conta, estado removido, última decisão de rejeição, instituição e ausência de operação em andamento. Reenvio sem alteração é rejeitado. Fotografias novas seguem o upload existente, com chaves da conta e limites de quantidade/tamanho.

Após a correção, o anúncio fica em review, sem publicação automática. O histórico listing_review_decisions é preservado e a mudança registra listing.review.resubmitted na auditoria.

Limites: upload real, existência e processamento das imagens ainda dependem do provedor e de homologação. Remoções sem rejeição administrativa exigem suporte. Correções comerciais completas e teste HTTP continuam pendentes.
