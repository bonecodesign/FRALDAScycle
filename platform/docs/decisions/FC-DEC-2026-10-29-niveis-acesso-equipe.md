# FC-DEC-2026-10-29 — Níveis graduais de acesso da equipe

## Estado

Aprovada pelo fundador em 29 de outubro de 2026. Base de sessão, autorização, proposta, aprovação final e gestão visual estão implementadas; ativação de identidades reais ainda está pendente.

## Hierarquia cumulativa

| Nível | Nome | Capacidades |
| --- | --- | --- |
| 1 | Suporte | Consultar, registrar, responder e encaminhar atendimentos; não decide nem executa ação financeira. |
| 2 | Resolução | Tudo do nível 1; investiga e registra resolução de problemas, inclusive decisão de caso de reembolso, sem movimentar dinheiro nem controlar o domínio financeiro. |
| 3 | Financeiro | Tudo do nível 2; acessa controles de cobranças, reembolsos e preparação de repasses. Pode ser concedido ou revogado por nível 4 ou 5. |
| 4 | Administrador | Tudo do nível 3; administra operação, equipe e níveis 1–3. Não concede, revoga nem assume nível 5. |
| 5 | Fundador | Autoridade máxima; administra níveis inferiores e decisões reservadas ao fundador. |

“Resolver reembolso” no nível 2 significa analisar evidência e registrar a decisão. Execução no provedor, controle de pausa financeira ou preparação de repasse exige nível 3.

### Separação do reembolso

1. nível 1 recebe, responde, organiza evidências e encaminha o atendimento;
2. nível 2 analisa e registra a decisão e o valor calculado, deixando o estado `provider_pending`;
3. nível 3 executa posteriormente a ação financeira aprovada no fornecedor;
4. decisão de nível 2 nunca chama fornecedor nem movimenta valor;
5. nível 3 não altera silenciosamente a decisão: divergência exige retorno à análise e nova decisão auditada.

## Perfil técnico de nível 2

Edição de frontend, backend, design ou código exige um perfil **técnico de nível 2**. Esse perfil pertence ao repositório e aos ambientes de desenvolvimento, não ao painel com dados reais.

O perfil técnico pode acessar:

- código-fonte e documentação técnica;
- branches de trabalho, revisão e testes;
- dados exclusivamente sintéticos;
- ambientes locais ou efêmeros sem credenciais reais.

O perfil técnico não recebe, por consequência do acesso ao código:

- painel financeiro ou controles de pagamento;
- banco, backups, logs ou segredos de produção;
- dados de clientes, crianças, entregadores ou instituições;
- credenciais de fornecedores;
- permissão de deploy em produção.

No nível 2 existem, portanto, perfis de capacidade separados: `support_resolution` no painel e `technical_contributor` no repositório. Conceder um não concede o outro. A separação evita que um desenvolvedor precise acessar dados reais para editar código.

### Revisão e merge

- nível 2 cria branch e pull request, sem merge direto;
- nível 4 revisa e aprova mudanças comuns;
- mudanças de produção, segurança, financeiro ou dados exigem aprovação final do nível 5;
- o autor não aprova o próprio pull request;
- regras verificáveis estão em `config/code-governance.v1.json`; a proteção remota depende das identidades reais e configuração do GitHub.

## Regras de segurança

- níveis são explícitos, cumulativos e limitados a contas administrativas;
- clientes e entregadores nunca ganham nível interno, mesmo que um payload tente informar o campo;
- existe no máximo um nível 5 ativo;
- o nível 5 é reservado ao fundador do FraldaCycle;
- convites não podem criar nível 5;
- contas administrativas antigas migram para nível 4 e moderadores antigos para nível 1;
- sessões recebem o nível persistido e perdem a capacidade após revogação de sessão ou alteração efetiva;
- toda concessão ou revogação deve ser auditada;
- ninguém pode elevar a si mesmo nem alterar conta de nível igual ou superior;
- nível 4 pode gerir somente níveis 1–3; nível 5 pode gerir níveis 1–4.

## Implementado nesta rodada

- coluna persistente e restrições de integridade;
- unicidade do fundador ativo;
- nível carregado na identidade de sessão;
- autorização por nível com compatibilidade para papéis anteriores;
- controles financeiros exigindo nível 3;
- controles operacionais não financeiros exigindo nível 4;
- incidentes financeiros exigindo nível 3 e demais incidentes nível 2.

## Ainda pendente

- escolha e implementação do bootstrap inicial do nível 5;
- separar completamente resposta de suporte (nível 1) da decisão de resolução (nível 2) nas rotas existentes.
- configurar as permissões reais do repositório e dos ambientes para o perfil `technical_contributor`, sem segredos ou dados reais.

## Bootstrap do fundador

Foi escolhido um comando único e auditado. Depois de existir uma conta administrativa interna para o fundador, executar:

`npm run access:bootstrap-founder -- --user-id=<UUID> --confirm=PROMOTE-ONLY-FRALDACYCLE-FOUNDER`

O comando exige confirmação literal, bloqueia concorrência, recusa segundo fundador ativo, revoga todas as sessões da conta e registra auditoria. O fundador deve entrar novamente após a promoção. O UUID real não é armazenado na documentação.
