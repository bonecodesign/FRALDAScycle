# FC-GATE-OPS — Pacote decisório: instituições, atendimento e operação enxuta

**Situação em 08/11/2026:** estrutura de responsabilidade para aprovação, **sem equipe designada, parceiros institucionais homologados, contato externo, aceites reais ou abertura do piloto**. Não transformar documentação em compromisso com usuário, instituição ou prestador.

## Limites e capacidades técnicas existentes

- O cadastro de instituições separa a conta da instituição da **autoridade verificada do representante**, com indicação, aceite, conferência independente, revogação e auditoria. Ter cadastro não concede por si só autoridade. Fontes: `docs/institution-access-beta.md`, `tests/institution-receipt-http-postgres.test.mjs`.
- A doação institucional é retirada **diretamente pela instituição**, sem frete, cobrança, comissão logística, entregador ou repasse da plataforma. O recebimento exige representante atualmente habilitado e validação independente, em ordem, com idempotência. Fontes: `docs/requirement-18-institution-receipt-order.md`, `tests/donation-institutional-pickup-postgres.test.mjs`.
- O suporte interno tem fila, atribuição, proteção contra respostas concorrentes, RBAC, notas internas e auditoria; **não significa equipe em atendimento**, SLA contratual ou capacidade real. Fontes: `docs/support-queue-assignment.md`, `tests/support-operations-http-postgres.test.mjs`.
- Sanções, incidentes e retomada possuem portões humanos; nenhum bot deve conceder sanção crítica ou autorizar retomada. A futura automação determinística/IA assistiva é uma **opção de planejamento, não autorização de implementar**.
- **IDs diretamente relacionados:** 18, 42, 50, 51, 56, 62, 67. As ligações com 41, 49, 57, 59 e 61 devem ser repassadas às trilhas correspondentes do quadro Codex.

## Portões que exigem pessoas e evidência real

| Portão | Decisão/responsável ainda a designar | Evidência necessária para avaliação |
| --- | --- | --- |
| OPS-01 | Definir responsável e substituto por suporte, privacidade, segurança, financeiro, instituições, incidentes e autorização de rollback; separar funções incompatíveis. | Termo de nomeação e aceite individual, matriz de acesso e indisponibilidade |
| OPS-02 | Aprovar critérios, documentos mínimos e poderes dos representantes institucionais, capacidade de recebimento, suspensão e retirada de acesso. | Fluxo de validação privada, evidência de autoridade, critérios de revalidação e auditoria |
| OPS-03 | Aprovar roteiro de retirada direta, confirmação/recusa, entrega física, dano, perda, disputa e protocolos de contato sem presumir seguro ativo. | Jornada de ensaio autorizada, registro de entrega/retirada, tratamento de exceções e limites de responsabilidade |
| OPS-04 | Definir horário de atendimento, prioridade, SLA **a determinar**, escalonamento, férias/ausências, respostas a denúncia e canal externo oficial. | Dimensionamento com dados de carga, plano de contingência e canais aprovados |
| OPS-05 | Validar suspensão, recurso, decisão independente, evento de incidente, pausa/retomada com identidades reais e segundo aprovador em ações críticas. | Simulado humano com participantes nomeados, evidência e auditoria, sem dados reais de clientes |
| OPS-06 | Planejar acessibilidade com leitor de tela e responsável humano de rollback; distinguir 19 evidências sintéticas de 21 exigidas no pré-voo do piloto BH. | Resultado de leitor de tela, aceite do rollback e ata separada de GO/NO-GO |
| OPS-07 | Aprovar limites de capacidade e de custo do modelo de operação enxuta, quando interromper automações e encaminhar ao humano. | Orçamento de atendimento, limites de fila, responsável de plantão, escalonamento, teste de saturação |

A eventual ausência de equipe permanente **não elimina** responsabilidade, escalonamento, contingência ou necessidade de supervisão humana. Se os papéis não puderem ser preenchidos de forma segura, o piloto não começa.

## Etapas técnicas permitidas ao Codex (sem operação real)

1. Criar roteiro de ensaio sintético para instituição, voluntário/representante, equipe e cliente, separando identidades e papéis. Verificar que instituição é a única organizadora da retirada e que nenhuma cobrança pode emergir de cancelamento/retentativa.
2. Testar idempotência, concorrência, isolamento de notas internas, 404 para terceiros, recibos sem dinheiro e impossibilidade de administrador validar sem aprovação prévia do representante habilitado.
3. Preparar um **mapa de carga e escalonamento apenas hipotético**: origem de incidente, limiar a ser definido, responsável `PENDENTE`, canal `PENDENTE`, interrupção segura.
4. Preparar roteiro de acessibilidade e de recuperação/rollback com campos de assinatura **em branco**. CI e testes de navegador não substituem teste humano de leitor de tela.
5. Comparar políticas operacionais e minutas jurídicas sob PRs #222/#225/#227 com código atual sem preencher CNPJ, telefone/canal institucional, prazos contratuais ou responsáveis que ainda não foram formalizados.

## Condições explícitas de saída

**Não abrir suporte externo, captar instituição, lançar anúncios, emitir convite de piloto ou publicar documentos.** O pacote só muda de `needs_human_review` para estado aprovado mediante evidência documental privada, assinaturas e autorização de execução adequada, fora do alcance deste preparo técnico.

**Sem conclusão nesta rodada:** nenhuma mudança no status dos IDs 18, 42, 50, 51, 56, 62 e 67. Piloto BH: **NO-GO**.
