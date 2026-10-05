# Premium — contrato local, sem cobrança ou ativação

Itens 6–8 do FC-DEC-2026-10-02. O lote implementa regras calculáveis e testáveis sem fornecedor; os três requisitos continuam **parciais**. Não apresenta uma assinatura real como disponível.

`packages/contracts/premium-rules.js`:

- Preço aprovado de R$ 12,90/mês e limite gratuito de três anúncios.
- Vigência delimitada por início e término explícitos de período pago; não presume que todos os meses têm trinta dias. Sem assinatura, estado gratuito.
- Cancelamento da próxima renovação preserva vigência paga e não cria cobrança, multa ou reembolso.
- Falha de renovação registrada a partir do vencimento: benefícios mantidos por três dias corridos (72 horas) desde o timestamp original da falha; depois disso, estado gratuito. Recalcular não reinicia o prazo. Retry ou recebimento tardio de webhook não podem substituir esse timestamp na futura persistência.
- Regularização exige novo período pago explícito; não acumula mensalidades nem autoriza tentativa externa. `billingAllowed` permanece falso em todos os estados.
- Retorno ao gratuito produz um plano de manutenção/pausa: escolha explícita de até três anúncios disponíveis do próprio titular; na ausência de escolha, os três publicados mais recentemente. Empates usam ID para resultado determinístico, sem alterar a prioridade temporal.
- Dados permanecem intactos. Anúncios não publicados e anúncios com transação em andamento são preservados. Estado da transação precisa ser informado explicitamente; informação ausente não é interpretada como ausência de operação.
- Entradas inválidas, anúncios de outra conta, IDs repetidos, escolhas excedentes e datas ambíguas/inválidas são rejeitados. Nenhuma coleção recebida é alterada.

O módulo é puro e não foi ligado ao runtime. Não há assinatura concedida pelo cliente, endpoint de compra, worker de renovação, persistência de seleção nem pausa automática de anúncios. Permissões reais, lock/concorrência, idempotência do evento, origem do período pago, seleção antes do término, aviso interno e aplicação atômica precisam do próximo lote com PostgreSQL e fluxos reais. Não transformar estas funções em uma autorização financeira ou alegar que a gestão Premium está pronta.

Validação local: `node tests/premium-rules.test.mjs`, 11 testes aprovados, incluindo limites exatos da vigência e dos três dias, cancelamento idempotente, fevereiro, falha repetida, regularização, prioridade/seleção dos anúncios e preservação de transações. Sintaxe passa pelo check de produção e diff sem erros. Não testou concorrência, migração, HTTP, navegador, teclado, dispositivos ou leitor de tela; módulo não usa banco ou rede.

Matriz: 6/70 concluídos (8,57%), 35 parciais, 17 pendentes, 12 bloqueados. Não integra contratos de fornecedores; beta completa e produção continuam bloqueadas. Sem despesas, mensagens, tarifas inventadas, dados infantis, termos ativos, desktop ou lançamento. Item 12 em standby.
