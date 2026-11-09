# Revisão técnica do fluxo de dados infantis — tarefa #229 (09/11/2026)

**Situação:** evidência técnica sintética para a análise PRIV-01…PRIV-07. **Não constitui parecer jurídico/LGPD, revisão profissional concluída ou autorização de coleta.** O recurso de perfis infantis continua desligado por padrão; piloto BH continua **NO-GO**.

## Entradas, armazenamento e fronteiras encontradas

| Etapa | Arquivos de referência | Dado necessário e controle existente | Risco / limite a revisar |
| --- | --- | --- | --- |
| Cadastro do responsável | `apps/api/registration-draft-service.js`, `database/responsible-registration-repository.js` | CPF e data do responsável são distintos do perfil infantil; cadastro pode criar perfil somente sob contrato/consentimento específicos e configuração habilitada | Revisar fundamento, separação de finalidades e cadastro legado sem misturar nascimento do adulto e da criança |
| Gestão do perfil infantil | `apps/api/child-profile-service.js`, `apps/api/child-profile-handler.js` | Retorno com nascimento e emoji apenas ao responsável autenticado; papéis não familiares recusados; respostas `cache-control: no-store`; perfil desativado por padrão | Garantir ausência de cache intermediário, analytics e exposição por outros serviços; não usar dados de crianças reais |
| Persistência | `database/child-profile-repository.js`, migrações 033, 053 e 061 | Nascimento e emoji ficam no registro ativo e nascimento passa a `NULL` na remoção; consentimento é evidenciado separadamente por hash/versão | Restauração de backup e exclusões sob disputa exigem política jurídica e ensaio real de recuperação |
| Auditoria | `database/child-profile-repository.js`, `database/responsible-registration-repository.js`, `database/migrations/128_child_profile_consent_evidence.sql` | A criação de perfis **não passa mais emoji nem nascimento para metadados de auditoria**; prova de consentimento registra versão/hash sem copiar atributos infantis | Eventos antigos anteriores a esta correção podem conservar `emoji` e requerem inventário + retenção/eliminação aprovadas, nunca mutação indiscriminada de logs |
| Avisos internos | `database/child-profile-repository.js`, `apps/api/child-profile-handler.js`, `apps/app/family-profile.js` | Endpoint familiar limita a leitura à própria conta, avisos de perfil, limite etário e responsabilidade; somente avisos não lidos e ainda vigentes; sem `DELETE` global disparado pela leitura | Excluir avisos expirados precisa de manutenção separada, com prazo e política revisados; observação na tela não é prova de exclusão do banco |
| Faixas etárias e marketing | `packages/contracts/child-age-band.js`, `apps/api/child-profile-service.js`, `packages/contracts/marketing-dispatch-policy.js` | Sinais internos `ageBand` únicos não incluem nascimento exato, ID de criança ou contagem de perfis | A revisão de integrações externas com marketing/parceiros permanece **pendente**, inclusive comprovação negativa ponta a ponta |
| Ciclo de 13 anos | `database/child-profile-lifecycle-repository.js`, `workers/child-profile-lifecycle.js` | Nascimento limpo ao encerrar por idade; aviso interno genérico | Avisos etários novos guardam somente `channel` e `event`; o despachante filtra a saída de avisos legados conhecidos antes do provedor. **Mensagens antigas já persistidas podem ainda conter emoji:** inventariar/reter/eliminar sob decisão de privacidade, não presumir limpeza física do banco |
| Contestação de responsabilidade | `database/child-profile-responsibility-repository.js`, `apps/api/child-profile-responsibility-service.js` | Contestações minimizadas com auditoria e autorização independente; notificação é incluída na leitura familiar, mas não outros tipos de aviso | Exceções e retenção de evidências precisam de responsável humano e decisão jurídica |
| Direitos/encerramento | `database/privacy-request-repository.js`, `tests/account-closure-retention-postgres.test.mjs` | Inventário de dados e fluxo de encerramento já preparados | Eliminação operacional integral e classificação jurídica de obrigações pendentes continuam bloqueadas |

## Mudanças técnicas desta PR (sem coleta ou integração externa)

1. `account_notices` do painel infantil: **SELECT com escopo explícito**, por conta + tipo familiar + não expirado. Avisos sobre pagamentos e troca não entram nessa resposta. A leitura deixou de executar um `DELETE` global em avisos de todas as contas.
2. Ambos os caminhos de criação de perfil infantil **omitiram `emoji`** dos metadados `child_profile.created`; a evidência de consentimento permanece versionada e não usa data de nascimento.
3. Testes HTTP/PostgreSQL com dados fictícios: recusa de acesso por entregador, isolamento por conta e categoria, avisos expirados ocultos mas não apagados na leitura, aviso de disputa familiar preservado, metadados de auditoria sem nascimento/emoji.

## Portões ainda não vencidos

- **PRIV-01…PRIV-07:** melhor interesse, fundamentos, responsabilidades, parceiros, publicidade, prazos, backup e medidas de incidentes precisam de revisão especializada verdadeira e versão aprovada.
- **Verificação técnica a continuar:** auditar sob autorização e política de retenção os payloads e eventos históricos que contenham `emoji`; testar ingressos e saídas para marketing/analytics, identidade do destinatário e confirmar política de exclusão/backup. A minimização de mensagens etárias novas e o filtro no envio não apagam dados históricos armazenados.
- **Segurança:** não habilitar `CHILD_PROFILES_ENABLED` ou criar contas/dados reais. A migração original não foi alterada e nenhuma coleta foi ativada.
- **Matriz de 70:** IDs 26, 27, 28, 31, 32 e 33 permanecem `bloqueado`. Esta revisão não atualiza status nem aumenta os 60% oficiais.

Referências de coordenação: [Issue #229](https://github.com/bonecodesign/FRALDAScycle/issues/229), [pacote PRIV](approval-packets/01-privacidade-dados-infantis.md), [quadro de decisões](../config/cross-functional-decision-gates.v1.json).

## Complemento técnico — 09/11/2026: minimização dos avisos etários

A camada `database/child-profile-lifecycle-repository.js` deixa de consultar/serializar o emoji da criança para os eventos `child_profile_age_limit_warning` e `child_profile_age_limit_closed`, preservando apenas os campos `channel=email` e `event`. O `notification_outbox` criado daqui em diante contém somente esses sinais operacionais.

A camada `workers/notifications.js` filtra essas duas espécies de avisos antes de qualquer chamada ao provedor de notificação, inclusive em trabalhos legados pendentes que possuam `emoji`, `birthDate` ou outros campos extras. Canais inesperados ou eventos desconhecidos com prefixo `child_profile_` falham por segurança e não são enviados. Outros tipos de notificação seguem seu contrato próprio.

O teste `tests/child-profile-lifecycle-postgres.test.mjs` verifica os payloads novos e simula a contaminação de uma linha antiga no banco para observar sua sanitização no envio sintético; `tests/child-profile-notification-minimization.test.mjs` cobre os campos extras, eventos/canais inválidos e preservação de mensagens não infantis.

**Limites:** o filtro protege a saída, não elimina automaticamente a cópia histórica no banco; nenhuma conta de provedor, credencial real ou mensagem externa foi criada. O parecer jurídico/privacidade sobre retenção de eventos históricos e integrações com marketing continua pendente.
