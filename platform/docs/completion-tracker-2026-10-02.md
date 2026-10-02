# Execução das etapas de conclusão — 2 de outubro de 2026

## Versão e evidência técnica

Base cloud: `4102dbb28f59a5d93ebe3a4e953ee1a869c0d88b`, merge do PR #58.
Comando executado em `platform`: `npm run release:check-local`.
Resultado: saída 0, 178 testes aprovados, 83 verificações de regressão aprovadas e 54 arquivos com sintaxe aprovada. Validadores de fornecedores e dos quatro contratos do piloto aprovados.

Os testes usam serviços, repositórios e respostas sintéticos. As verificações de interface incluem análise de código e execução em contexto simulado; não equivalem a navegação humana, navegador completo, dispositivos físicos ou leitor de tela. Não houve provisionamento, cobrança, publicação, comunicação externa ou alteração do protótipo.

## Etapas e critérios de encerramento

| Etapa | Estado nesta execução | Evidência necessária para encerrar |
| --- | --- | --- |
| 1. Consolidar versão | Concluída | PR #58 integrado com CI aprovado; commit acima |
| 2. Piloto interno | Pré-validação concluída; sessão pendente | Executar os 21 cenários de `pilot-session.v1.json`, preencher evidências, achados e decisão |
| 3. Revisões jurídica, financeira e privacidade | Preparação disponível; aprovação pendente | Pareceres identificados e datados sobre termos, taxas, reembolso, disputa, retenção e responsabilidades |
| 4. Fornecedores | Contratos técnicos preparados; seleção e contratação pendentes | Diligência, preços, cobertura, SLA, DPA, plano de saída e aprovações registradas |
| 5. Homologação isolada | Plano preparado; ambiente não comprovado | Autorização de custo/acesso, ambiente isolado, TLS, banco, mídia e cofre de segredos verificados |
| 6. Integrações | Testes sintéticos aprovados; sandbox pendente | Resultados do fornecedor para sucesso, falha, retries, assinatura, duplicação e eventos fora de ordem |
| 7. Usuários e dispositivos | Protocolo definido; execução pendente | Pelo menos 5 compradores, 5 anunciantes e 5 entregadores; sucesso independente de pelo menos 80%; nenhuma barreira crítica |
| 8. Segurança e operação | Testes locais aprovados; ensaios de ambiente pendentes | Carga, alertas, papéis, backup, restauração e rollback comprovados na homologação |
| 9. Lançamento BH | Bloqueado pelas etapas anteriores | Decisão expressa de lançamento, responsáveis, limites, suporte, monitoramento e critérios de interrupção |

Não há percentual global de conclusão: as etapas têm pesos e dependências diferentes. A execução técnica não autoriza homologação externa nem produção.

## Cobertura automatizada do roteiro interno

Esta matriz registra pré-validação, não muda os estados das 21 evidências da sessão humana.

| Evidências do piloto | Verificação executada | Limite |
| --- | --- | --- |
| approved-rules, catalog-scope, no-reservation-flow | `approved-business-rules.test.mjs`, `marketplace.test.mjs`, regressão | Conferência humana de conteúdo e compreensão pendente |
| test-accounts, admin-auth, role-boundaries | `identity.test.mjs`, `session.test.mjs`, `admin-rbac.test.mjs` | Contas e serviços fictícios; autenticação na infraestrutura ainda pendente |
| publish-search-negotiate, open-donation-attestation, listing-unavailability | `marketplace.test.mjs`, `approved-business-rules.test.mjs` | Executar publicação, busca e aceite; o identificador legado não reintroduz proposta/contraproposta |
| chat-protection, audit-trail | `marketplace.test.mjs`, `admin-rbac.test.mjs` | Autorização e atomicidade simuladas; retenção e operação real pendentes |
| synthetic-data | Políticas dos validadores e fixtures dos testes | Conferir todos os dados usados na sessão antes de iniciar |
| keyboard-check, screen-reader-check, device-matrix | Contratos de interface e regressão estática | Teclado real, leitor de tela e dispositivos físicos não executados |
| support-script, incident-severity, rollback-owner | Preparação abaixo | Ensaio humano e nomeação/aceite do responsável pendentes |
| findings-log, go-no-go-decision, next-actions | Este registro consolida lacunas e próximos passos | Decisão formal do responsável permanece pendente |

## Sessão interna: procedimento pronto para execução

1. Registrar commit, data, participantes internos e objetivo. Usar somente perfis, endereços, produtos e documentos fictícios. Não carregar credenciais reais.
2. Executar em ambiente privado os 21 cenários de `config/pilot-session.v1.json`; registrar resultado, horário e observação em `pilot-evidence.v1.json`. Resultados automatizados não substituem observação humana.
3. Conferir venda e troca com pacote fechado, doação aberta com declaração sanitária, catálogo permitido, ausência de reserva e indisponibilidade imediata ao iniciar transação. Não reintroduzir propostas removidas.
4. Executar teclado, ordem de foco, fechamento de diálogos, mensagens de erro e anúncios de rota. Registrar navegador, viewport e tecnologia assistiva; distinguir emulação de dispositivo físico.
5. Ensaiar o incidente fictício: um comprador não consegue concluir a tarefa. Registrar rota, horário, impacto e identificador fictício; nunca senha, token, documento ou conteúdo pessoal. Reproduzir, classificar, encaminhar e confirmar resolução.
6. Classificar como crítico qualquer exposição, acesso indevido, cobrança/comunicação externa ou perda de integridade; interromper a sessão. Bloqueio de jornada essencial é alto; dificuldade com alternativa segura é médio; defeito visual sem impedir tarefa é baixo.
7. O fundador deve nomear e obter aceite do responsável técnico por interrupção e rollback, com substituto e canal de acionamento. Não presumir que uma pessoa aceita esse papel.
8. Consolidar achados com prioridade, responsável e prazo. Preencher `pilot-execution.v1.json` com decisão formal: repetir, manter bloqueado ou avançar dentro do escopo interno autorizado. Validar os quatro contratos antes do PR.

## Pacote de revisão e homologação

As revisões devem preencher os documentos existentes, preservando uma única fonte de requisitos:

- Produto e compreensão: `product-readiness-plan.md` e roteiro do piloto.
- Jurídico/financeiro/privacidade: `provider-due-diligence.md`, `provider-selection.md` e `provider-readiness.md`; revisar também políticas do produto. Pareceres não são substituídos por testes técnicos.
- Infraestrutura: `infrastructure-production-plan.md`; confirmar custo, região, domínio e autorização antes de provisionar. Guardar segredos exclusivamente no cofre.
- Promoção técnica: `production-readiness.md` e `provider-readiness.md`; executar `production:doctor`, migração, smoke, backup/restauração e rollback no ambiente autorizado. Registrar resultado real, duração e responsável.

Para testes de usuários, usar o mesmo roteiro por papel, sem orientar durante a tarefa medida. Registrar quantidade de participantes, tarefas concluídas independentemente, tempo, erros, barreiras, navegador/dispositivo e consentimento apropriado. Separar dados de pesquisa do Git e publicar somente resultados agregados. Não iniciar recrutamento ou enviar mensagens por este registro.

## Achados e próxima ação

1. A execução humana do piloto ainda não tem evidências: realizar a sessão e registrar os 21 resultados.
2. Fornecedores e infraestrutura não têm comprovação operacional: obter seleção, aprovações e acesso autorizado antes de testes externos.
3. Não há comprovação dos 15 participantes nem dos dispositivos: executar o protocolo antes de recomendar lançamento.
4. A recuperação e a capacidade real ainda precisam de ensaios: testar restauração, rollback, alertas e carga em homologação.

Recomendação técnica atual: manter bloqueado o lançamento externo e continuar a sessão interna. A decisão formal do fundador permanece aberta.

O desktop permanece fora desta execução; sua linha de base segura continua `357f58c09c5c9b41278cc4faaf98f0ee1d383e1c`.
