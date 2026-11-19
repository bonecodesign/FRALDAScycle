# FC-DEC-2026-11-18 — Canal oficial de suporte: e-mail próprio e chat no aplicativo

## Decisão do fundador (18/11/2026)

O fundador selecionou expressamente **a opção 1: e-mail oficial do FraldaCycle com domínio próprio, ainda a definir**, e acrescentou **chat de atendimento dentro do aplicativo**.

São dois canais complementares de atendimento. **Nenhum endereço, domínio ou provedor foi escolhido ou contratado nesta decisão.** É proibido inventar um endereço funcional, criar uma caixa postal, enviar mensagens, publicar atendimento ou ativar produção sem os portões de implantação.

### Fronteira entre chats

- O chat **de suporte** será uma conversa privada entre usuário e equipe autorizada do FraldaCycle, acessível na área **Ajuda e suporte** do aplicativo. Ele deve admitir problemas de cadastro, anúncios, logística, pagamento, denúncias, incidentes e privacidade, **sem condicionar suporte à confirmação de pagamento**.
- O chat **entre comprador e vendedor** (`/app/chat`) é uma funcionalidade de negociação distinta e permanece sujeito às suas restrições de pagamento e compartilhamento de contatos. O suporte nunca libera nem contorna esse chat.
- O chat de suporte poderá começar como **conversa assíncrona por protocolo**, sem promessa de atendente em tempo real, com histórico e encaminhamento humanos. O horário de atendimento e os prazos são os já aprovados pelo fundador, sujeitos à implementação e homologação efetiva.

### Infraestrutura existente a aproveitar

- `/app/help` já permite abrir pedidos de suporte, consultar seus protocolos e ler respostas persistidas da equipe; `/admin/operations` já possui fila privada, atribuição, RBAC, auditoria, notas internas e respostas idempotentes.
- **Ainda não é um chat bidirecional completo:** hoje, o cliente não envia mensagens subsequentes no detalhe de um protocolo. Não declarar o chat de suporte como entregue nem confundi-lo com o chat da operação.
- A interface de Ajuda possuía um cartão “Chat online” que apontava incorretamente para `/app/chat`. Enquanto não houver chat de suporte funcional e homologado, a interface deve encaminhar o usuário para **abrir e acompanhar um protocolo** em `/app/help`, sem promessa de chat online.
- A interface do aplicativo também exibe atualmente **segunda a sexta 9h–18h e 2 dias úteis**, mas a decisão posterior do fundador em `FC-DEC-2026-11-14-autoridade-final-fundador.md` aprova **segunda a sábado 8h–20h** e prazos graduados por criticidade. **Existe discrepância na interface e no contrato `packages/contracts/support-hours.js`; corrigir e comprovar em pacote técnico focado, antes de ativação.** Não inventar disponibilidade humana.

### Próximos incrementos sem contratar nem ativar

1. Reaproveitar o modelo existente de protocolos e mensagens para permitir **resposta autenticada do titular no próprio atendimento**, com controles de estado, idempotência, anexos somente após mídia homologada, isolamento por usuário, rate limiting e logs sem dados infantis/credenciais.
2. Apresentar a conversa como **Suporte** em `/app/help` (ou rota dedicada protegida), distinta de `/app/chat`. Exibir protocolo, horário, última atualização, estados e avisos de prazo, sem prometer resposta instantânea.
3. Adequar a interface e a política de horários aos termos já aprovados em 14/11 e executar apenas testes específicos de novos comportamentos. Não duplicar testes gerais de tickets, fila ou banco previamente verdes.
4. Preparar configuração do domínio próprio e e-mail oficial **sem preencher endereço, ativar serviços ou contratar domínio**. Antes de uso real, exigir verificação de titularidade, proteção de conta, autenticação de remetente (SPF/DKIM/DMARC), controle de acesso, logs, política de privacidade, recebimento/roteamento para protocolo e teste de entregabilidade.
5. Para contas sem acesso, recuperação de senha ou direitos LGPD, avaliar caminho alternativo de contato sem exigir sessão ativa, preservando validação de identidade e proteção contra abuso. Casos sensíveis necessitam revisão humana.
6. Homologar operação: titulares e suplentes de atendimento, canais reais, SLA, privacidade, exercícios de incidentes, dispositivo físico, acessibilidade, integração de e-mail e mensagens.

### Requisitos e limites

- Matriz `docs/requirements-matrix.json`: **51 — suporte externo permanece bloqueado**, pois não há domínio/e-mail real, atendimento humano, serviço de mensagem nem homologação dos canais.
- **50 — suporte interno permanece tecnicamente concluído**: reutilizar, não reconstruir.
- Reflexos: **45** (exclusão e direitos), **49** (notificações), **56** (incidentes), **67** (piloto).
- Sem alteração de 48/70 = **68,57%**, sem mudança de preflight 16/21, sem ativação de produção, pagamentos, fornecedores ou perfis infantis.
- A aprovação do fundador aqui é **decisão de produto**, não prova de funcionalidade implementada, parecer jurídico ou autorização operacional.
