# Homologação humana pendente — piloto interno BH (requisito 67)

**Situação em 07/11/2026: NÃO EXECUTADA; NO-GO.** Este roteiro serve para conduzir e registrar, futuramente, as verificações humanas. Ele **não** é um registro de aceites, de uso de leitor de tela, de exercício humano ou de autorização para iniciar o piloto.

## Fontes e limites

- `config/pilot-technical-preflight.v1.json`: 19 das 21 evidências possuem cobertura técnica sintética. Continuam pendentes `screen-reader-check` e `rollback-owner`.
- `config/pilot-evidence.v1.json` e `docs/pilot-run-2026-10-02.md` são o **histórico imutável** da rodada anterior. Não transformar resultados históricos ignorados, falhos ou não executados em aprovações retroativas.
- `docs/incident-drill-local.md` e `docs/decisions/FC-DEC-2026-10-29-responsaveis-incidentes.md`: estrutura aprovada para triagem, responsável técnico, substituto e observador independente.
- O modo `PILOT_BH_ENABLED` permanece desligado; `humanValidationComplete=false` e `launchAuthorized=false`. Nenhum dado pessoal real, contratação, mensagem externa, cobrança, frete ou publicação é autorizado por este documento.

## Portão H1 — leitor de tela e acessibilidade observada

**Quem:** avaliador humano com tecnologia assistiva; registrar pessoa responsável pela decisão de qualidade de forma privada. Não declarar a evidência cumprida a partir de teste estático, Playwright, scanner automático ou avaliação feita exclusivamente por IA.

**Preparação:** fixar commit, ambiente isolado em loopback, navegador, versão do leitor de tela e sistema operacional. Usar somente contas, anúncios, CEPs e transações sintéticos. Registrar diferenças entre desktop e celular quando houver dispositivos disponíveis; não afirmar cobertura física que não foi executada.

**Roteiro mínimo de observação:**
1. **Cadastro/login:** identificar campos e erros pelo nome acessível; percorrer a ordem de foco, validar anúncio de erros, status de autenticação e saída por teclado.
2. **Busca/anúncio:** navegar por resultados, filtros, preço, tipo (venda/troca/doação), disponibilidade e descrição da mídia; localizar ações sem depender somente de cor ou posicionamento visual.
3. **Publicação:** avançar e retornar etapas; preencher preço real do formulário sintético; conferir rótulo do botão, associação de erros, revisão e anúncio correto do estado enviado.
4. **Transação protegida:** comprovar que o chat não é acessível antes da condição técnica aprovada, com mensagem de bloqueio compreensível; conferir notificações de estado e erros sem executar pagamentos ou entregas.
5. **Suporte e controles relevantes:** percorrer chamados e retornos de estado que estejam disponíveis na superfície testada. Administradores devem utilizar somente atores sintéticos; não presumir que a navegação do cliente testa o Admin.
6. **Mobile e acessibilidade de operação:** documentar a tecnologia assistiva móvel efetivamente usada, quando disponível. Ausência de teste móvel é uma limitação explícita, nunca um resultado “aprovado”.

**Registro obrigatório em repositório de evidências privado:** referência opaca, commit, ambiente, sistema/navegador/leitor de tela/versões, roteiro seguido, instante da observação, avaliador, tarefas com resultado (passou/falhou/não executou), problemas, severidade, encaminhamento e decisão de qualidade. Para falha alta/crítica ou jornada essencial inacessível, manter **NO-GO** até corrigir e repetir a observação.

**Condição de aceite:** observação humana verificável e decisão responsável, sem achado impeditivo. Preenchimento documental isolado **não** muda o estado da matriz nem da pré-validação.

## Portão H2 — nomeação e aceite do rollback

**Papéis definidos, sem preenchimento automático:**

| Papel | Responsabilidade | Estado atual |
| --- | --- | --- |
| Fundador — triagem/decisão final | Classificar e autorizar decisões finais | Papel definido; sessão e aceite humano ainda não comprovados neste piloto |
| Responsável técnico | Pausar, corrigir, recuperar e executar rollback autorizado | Nomeação e aceite individual pendentes |
| Substituto técnico | Assumir quando o titular estiver indisponível | Nomeação e aceite individual pendentes |
| Observador independente | Registrar execução e divergências sem operar o controle | Nomeação e observação pendentes |

**Registro obrigatório (privado, não no GitHub público):** referência de participante, papel exclusivo, data/hora do aceite, versão do runbook aceito, responsável pela nomeação, canal autenticado/confirmado, disponibilidade e rota de escalonamento. O fundador não acumula a função técnica; responsável, substituto e observador são pessoas distintas e não podem ter aceite presumido.

**Validação técnica acompanhada:** após nomeação e aceites, executar ensaio humano em ambiente isolado com três cenários: falha de pagamento, exposição sintética de dados e falha logística. Confirmar pausa, impacto em novos compromissos, preservação de operações existentes, proposta e aprovação de retomada por pessoas distintas com autenticação reforçada, verificação pós-retomada e rollback. Anotar sucesso/falha de cada cenário e eventuais achados altos/críticos.

**Não há homologação substituta:** testes automáticos da pausa e retomada ou identidade fictícia em teste **não** comprovam disponibilidade do responsável, aceite, presença do observador, autenticação real ou resposta à emergência.

## Consolidação e decisão

1. Confirmar que `screen-reader-check` e `rollback-owner` possuem registros humanos válidos e que não há falha bloqueadora. **Hoje ambos estão pendentes.**
2. Preservar a distinção entre a pré-validação sintética 19/21, a futura homologação humana e a decisão formal de lançamento; não reescrever as evidências históricas nem promover automaticamente a matriz.
3. Validar, em outro procedimento, identidade/revisão das contas convidadas, responsabilidades reais, parecer jurídico/privacidade, canais, fornecedores, infraestrutura, suporte e eventuais bloqueios financeiros. A conclusão dos dois portões **não basta** para liberar produção.
4. Submeter o pacote de evidências à decisão explícita do fundador, registrando data, versão, responsáveis e justificativa. Sem aprovação expressa ou diante de lacuna, resultado **NO-GO**.
5. Enquanto não houver decisão positiva completa, não ativar `PILOT_BH_ENABLED`, não admitir usuários reais e não realizar cobranças ou entregas.

**Proibição de dados no repositório:** não registrar nomes civis, CPF, e-mail, telefone, credencial, token, gravação contendo dados pessoais ou aceite individual identificável no GitHub público. Referências de evidências privadas podem ser mencionadas após aprovação da política de acesso e retenção; o documento atual contém apenas o roteiro.
