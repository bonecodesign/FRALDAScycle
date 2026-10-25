# Controle contra abuso de destaque Premium

Estado: contrato técnico implementado; integração com a busca real e telemetria de impressão pendente.

## Limites

- no máximo um anúncio identificado como “Destaque” em cada bloco de cinco resultados;
- respeitar busca, categoria, filtros e ordenação orgânica;
- ordenação manual desativa integralmente a colocação paga;
- avançar no máximo uma faixa geográfica;
- alternar vendedores e impedir destaque do mesmo vendedor em blocos consecutivos quando houver alternativa elegível;
- anúncio precisa estar publicado, aprovado pela moderação e liberado pelo controle de duplicidade;
- pagamento Premium não altera nota de qualidade e não permite ignorar controles.

O destaque muda apenas a apresentação dentro do conjunto já elegível. Não torna anúncio invisível, não remove concorrentes e não compra aprovação.

## Ativação pendente

A busca deve aplicar o contrato depois de formar a ordem orgânica e antes de gerar o cursor estável. A telemetria deve registrar apenas IDs técnicos, bloco, política e motivo de inelegibilidade. Alterações repetitivas de anúncio ou assinatura podem gerar revisão, mas não suspensão automática sem regra específica e evidência auditável.
