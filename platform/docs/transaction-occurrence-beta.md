# Ocorrência de divergência — beta técnico

Comprador ou vendedor participante pode abrir uma ocorrência vinculada a uma operação paga, em entrega ou concluída. O pedido exige uma das classificações aprovadas: produto incorreto, quantidade divergente, embalagem danificada ou não recebimento. A criação é idempotente, preserva o estado anterior e coloca a transação em `disputed`, bloqueando consultas de liquidação e qualquer futura tentativa de repasse. Uma chave repetida com conteúdo divergente é recusada.

O atendimento não pode ser encerrado por uma resposta genérica enquanto a ocorrência estiver pendente. Uma pessoa com escopo `admin:support:write` deve registrar decisão explícita e justificada. Decisão improcedente restaura o estado anterior; devolução, reembolso, substituição ou outra solução confirmada encerram a análise, mas conservam a transação em disputa até a etapa financeira ou operacional correspondente. Repetição idêntica é segura e decisão divergente é recusada.

A auditoria registra a classificação na abertura e apenas o resultado na decisão; descrição do usuário e justificativa administrativa não são copiadas para os metadados de auditoria. O teste usa dados fictícios e não executa entrega, devolução, substituição, cobrança, repasse ou reembolso reais. Integração com fornecedor e operação humana continuam externas. Produção e piloto permanecem NO-GO.
