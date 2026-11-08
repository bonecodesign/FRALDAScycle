# P-01 — Confirmação de exclusão de cópia de certidão (preparação técnica)

**Situação em 08/11/2026:** controle local preparado; exclusão real, recibo de provedor, purga de metadados e revisão jurídica/privacidade ainda **não homologados**. Nenhum provedor de armazenamento foi configurado nesta alteração.

## Limite de segurança do worker

A obrigação interna `clearance_copy_delete` é processada por `apps/api/courier-eligibility-maintenance.js`. A chamada `restrictedStorageAdapter.deleteObject(opaqueObjectReference)` **não** deve ser interpretada como prova de exclusão só porque uma Promise resolveu ou uma resposta HTTP foi bem-sucedida.

Para continuar à conclusão local, o adaptador deverá retornar um objeto de confirmação com os seguintes campos:

- `deleted: true` — afirmação positiva de que o objeto foi removido (ou de que sua ausência foi confirmada conforme a futura política de idempotência).
- `objectReference` — correspondência exata com a referência opaca solicitada; retorno para outra referência deve falhar.
- `confirmationReference` — ID opaco de 8–128 caracteres alfanuméricos (pontos, hífens, sublinhados e dois-pontos são admitidos), **não** endereço público, conteúdo da certidão, credencial ou URL.
- `confirmedAt` — timestamp interpretável, que identifica o registro da confirmação fornecida pelo adaptador.

Respostas `undefined`, `true`, `false`, parciais, sem ID ou para objeto diferente **não** autorizam completar a obrigação. A ausência de referência do arquivo falha sem chamar o armazenamento. Falhas e respostas ambíguas seguem o fluxo interno de reprocessamento, sem gravar uma falsa exclusão.

O worker transmite ao método `completeMaintenanceTask` somente a confirmação opaca (ID e instante), nunca o identificador do objeto no metadado de conclusão. O código de persistência **atualmente ignora esses dois campos extras**, e o registro durável do comprovante de remoção ainda depende das correções de P-01; a confirmação do adaptador **não substitui** comprovante real ou validação da eliminação no armazenamento.

## Pendências bloqueantes da PR #215

- Selecionar migração SQL sem colisão, reconciliar a regra do prazo máximo de até 30 dias contados da verificação e validar os casos de registros legados.
- Conciliar o esquema `courier_clearance_documents` com o contrato de estado `deleted`, **zerando as referências de objeto e de chave** somente após confirmação confiável da eliminação externa. Hoje essas colunas são `NOT NULL` no esquema original.
- Persistir o identificador e o instante da confirmação em auditoria protegida; verificar integridade e ausência residual de acesso ao documento com testes PostgreSQL.
- Definir por revisão de privacidade/jurídico a retenção de evidência mínima, prazo, exceções, reparação de falhas e tratamento de dados históricos.
- Homologar adaptador real, identidade/permissões, armazenamento e exclusão/consulta de ausência em ambiente controlado antes de ativar qualquer efeito externo.

**Não concluído:** este incremento não executou nem comprovou purga real; não ativa o worker externo e não autoriza piloto ou produção.
