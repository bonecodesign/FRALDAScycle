# Atribuição da fila administrativa de suporte

As equipes em `/admin/launch` e `/admin/operations` podem assumir um atendimento aberto para si e liberar a própria atribuição. A fila identifica o responsável. Atendimentos resolvidos não podem ser assumidos; assumir ou liberar não altera o estado do atendimento, não responde ao cliente, nem executa cancelamento, estorno ou repasse.

O filtro Responsável oferece “Todos os atendimentos”, “Meus atendimentos” e “Sem responsável”. Ele combina com estado, categoria, busca textual e paginação; mudar o filtro retorna à primeira página.

As telas administrativas mostram quando cada atendimento foi criado e há quanto tempo, e oferecem ordenação opcional entre mais recentes (padrão) e mais antigos. A idade é informativa; não representa prazo, prioridade ou SLA. O servidor aceita `sort=oldest` apenas no escopo administrativo e mantém os filtros combináveis.

O servidor exige o escopo `admin:support:write`. A linha do atendimento é bloqueada durante a operação no PostgreSQL, então apenas um administrador pode assumir um ticket livre. Um ticket atribuído a outra pessoa não pode ser tomado ou liberado por outro usuário. Repetir a ação já aplicada é idempotente e não gera evento duplicado. Mudanças efetivas geram eventos de auditoria. Consultas de cliente omitem a identidade e os metadados do responsável.

## Validação local

- Interface nas telas administrativas e endpoint HTTP: filtros de atribuição, permissões, confirmação e caminhos de assumir/liberar.
- PostgreSQL: migração em banco limpo, tentativa concorrente por dois administradores, bloqueio de liberação alheia, filtros mine/unassigned, privacidade para o cliente, proibição de assumir ticket resolvido e auditoria das mudanças.
- Chromium: filtros mine/unassigned e assumir/liberar via teclado na fila real de teste; layouts validados em 320, 375, 768 e 1280 px.

Não há definição de SLA neste passo: prazos e escalonamento requerem política aprovada. O ensaio usa usuários e tickets sintéticos e não configura equipes ou alertas reais.
