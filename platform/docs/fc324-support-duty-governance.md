# FC-324 — Governança de nomeação, aceite e revogação de funções de suporte

**Data:** 19/11/2026. **Diretriz aprovada:** `docs/decisions/FC-DEC-2026-11-14-autoridade-final-fundador.md`. **Estado:** implementação técnica preparatória; sem nomes reais, sem plantão ativo e sem autorizar disparos externos.

## O que foi desenvolvido

A FC-323 criou a tabela inativa de titular/substituto, mas não existiam ações para nomeação ou aceite. Este pacote implementa a sequência de pessoas distintas, cada etapa condicionada à confirmação individual de segurança **com senha e código de e-mail verificado (step-up, dez minutos)**:

1. **Proposta — nível exato 3, setor suporte:** uma conta de suporte com nível 3 indica outra conta ativa e verificada do setor suporte, nível 1 a 4, para o papel titular/substituto, com justificativa. Não concede função.
2. **Revisão — nível exato 4, setor operações:** outra pessoa revisa, aprova o encaminhamento ou rejeita a proposta. A mesma pessoa não pode ser proposta, revisora e candidata.
3. **Decisão — fundador nível 5:** somente após aprovação independente do nível 4, o fundador autoriza ou rejeita. Aprovação cria **indicação pendente**, não concede plantão nem poderes de escalonamento externo.
4. **Aceite/recusa — pessoa nomeada:** somente a conta individual indicada, com setor/nível ainda válidos, pode aceitar ou recusar mediante step-up. O aceite torna a função elegível à **prévia** FC-323, não demonstra cobertura horária efetiva.
5. **Revogação — fundador nível 5:** revoga indicação pendente ou aceita, com justificativa e novo step-up; a auditoria histórica permanece. Um grant de segurança já utilizado não pode ser reaproveitado.

A migração `175_support_duty_founder_governance.sql` acrescenta `support_duty_proposals` com histórico de proposta/revisão/decisão, vincula cada `support_duty_assignments` à proposta aprovada e registra revogações. Índices e bloqueios transacionais limitam cargos/pessoas simultaneamente propostos ou vigentes e impedem acumulação indevida de etapas.

As rotas REST são restritas e não armazenam senhas:
- `GET /v1/admin/support-duty`: liderança visualiza governança; candidatos e proponentes visualizam apenas registros pertinentes, sem acesso público.
- `POST /v1/admin/support-duty/proposals`: proposta nível 3.
- `POST /v1/admin/support-duty/proposals/:id/review`: revisão nível 4.
- `POST /v1/admin/support-duty/proposals/:id/decision`: fundador nível 5.
- `POST /v1/admin/support-duty/assignments/:id/response`: aceite/recusa do titular da conta.
- `POST /v1/admin/support-duty/assignments/:id/revoke`: revogação pelo fundador.

Painel protegido em `/admin/operations`, reaproveitando o mesmo `account_step_up_requests` e código de verificação. Setores, níveis, elegibilidade e confirmação são **revalidados em transação** na camada de banco, e não apenas pela interface ou token da sessão. Nenhuma lista de usuários aberta ao público foi adicionada. Os IDs de usuários utilizados nos testes são exclusivamente fictícios.

## Limites e independência

O sistema ainda **não** cria cobertura horária, escala de plantão, canal de contato real, contrato trabalhista, prontidão humana, alerta, mensagem de marketing, push, e-mail operacional, pausa, reembolso ou alteração financeira. A única notificação do fluxo, quando alguém futuramente utilizar a função, é a confirmação de segurança já existente; não é um alerta de suporte.

A FC-323 permanece com `staffingVerified=false`, `channelVerified=false`, `sendAttempted=false`, `externalDispatchAuthorized=false`, `internalDispatchAuthorized=false` e `automaticPauseAuthorized=false`, **mesmo após um aceite técnico de função**. A pessoa titular e sua substituta precisam efetivamente existir, aceitar responsabilidades, cobrir a escala e testar os canais em ambiente apropriado antes de qualquer promoção de requisito.

## Evidências obrigatórias para homologação técnica

- Testes unitários de níveis, setores, entradas e respostas insuficientes.
- Jornada HTTP/PostgreSQL sintética atravessando quatro identidades e seus próprios grants, nomeação, aceite, revogação, auditoria, grant consumido e negativa de acessos indevidos.
- Ausência de protocolos, incidentes e avisos operacionais reais.
- Após **CI 5/5 e merge**, aplicar uma vez somente a migração 175 ao Supabase-BR, preservar checksum SHA-256 idêntico ao SQL da `main`, conferir RLS/revogação de grants públicos, novas tabelas vazias e `Health/Security Advisor` sem alertas novos relevantes.

A matriz mantém **48/70 (68,57%)** e piloto BH **NO-GO**. Os requisitos 49, 51, 56 e 67 continuam dependentes de operação humana e canais reais; 57/59 dependem de infraestrutura e segurança externa. Não repetir testes anteriores de triagem FC-322 ou de prévia FC-323.
