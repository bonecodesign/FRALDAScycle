# FC-369 — Integridade do lote artificial

Projeto único: FraldaCycle. R$ 0 de novos gastos.

## Lacunas
A FC-366/367 validava os IDs inicialmente, mas o resumo relia a lista mutável original após await. Alterações feitas durante processamento poderiam remover fotos bloqueadas ou trocar o identificador apresentado. A função também aceitava qualquer decisão da lista de estados permitidos, mesmo incompatível com o tipo de fixture artificial. A expressão regular convertia objetos implicitamente em texto.

## Correção
- Criar snapshot interno de campos primitivos validados, congelando listas e itens; usar o mesmo snapshot no agendamento e no resumo.
- Exigir IDs string, recusar duplicações e manter os limites de 1–8 anúncios, 1–8 fotos e 16 fotos totais.
- Vincular cada caso fixo à sua decisão esperada; divergência gera scan-error e bloqueio do lote.
- Manter a retirada de worker por timeout e nenhuma liberação de mídia ou publicação.

## Evidência
Três regressões Node: falso resultado limpo para quatro casos inseguros e motivo incorreto; mutação de lista, IDs e fotos durante processamento; tentativa de coerção de IDs não-string. A workflow existente inclui esta suíte e a execução real de ClamAV para fixtures. Integrar após Platform CI 5/5 e sandbox real verdes na SHA exata, sem promover gates.

A correspondência de resultado esperado só é apropriada para fixtures conhecidas; não é regra de classificação de fotos reais. Não comprova autenticidade de atestados externos nem transações distribuídas. FC-41 parcial, matriz 48/70, piloto 16/21, NO-GO. PR #333 preservado. Sem fornecedor, upload real, banco hospedado ou ativação comercial.
