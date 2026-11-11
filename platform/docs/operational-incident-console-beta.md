# Console operacional de incidentes — beta

## Onde fica

O console está em `/admin/operations`, na área administrativa. A mesma tela reúne suporte, pausa/retomada, incidentes e atalhos para financeiro e logística.

## Implementado

- abertura idempotente de incidente com referência opaca;
- severidades baixa, média, alta e crítica;
- domínios global, marketplace, cobranças, reembolsos, repasses, logística, doações, Premium e privacidade;
- fila priorizada por severidade e atualização;
- atribuição e liberação sem tomada concorrente;
- estados aberto, contido, monitoramento e resolvido;
- reabertura e notas operacionais;
- controle otimista de versão;
- linha do tempo e auditoria persistidas;
- retomada com proposta técnica e confirmação reforçada independente do fundador; quando aprovada, grava `operations.resumed` no histórico do domínio na mesma transação que atualiza o estado e registra `operations.resume.approved` na solicitação;
- pausa independente de novas cobranças, criação de reembolsos e preparação de repasses;
- contestação, consulta, suporte e compromissos existentes preservados.

### Incidentes de privacidade

- nível 3 registra a avaliação classificada de probabilidade, impacto, alcance, presença de dados infantis e risco imediato;
- nível 4 registra a decisão de comunicação depois da investigação;
- incidentes críticos também exigem nível 5 para a decisão;
- a resolução é bloqueada enquanto não houver avaliação de risco e decisão de comunicação;
- os registros aceitam apenas metadados classificados e recusam campos livres com dados pessoais, datas de nascimento ou identificadores de perfis infantis;
- o painel prepara a governança, mas mantém `externalDispatchAuthorized=false`: nenhuma comunicação à pessoa afetada, e-mail ou ANPD é enviada por este pacote.

O painel nunca edita saldo, altera valor financeiro nem declara transferência. Preparar obrigação de repasse continua diferente de enviar dinheiro ao provedor.

## Segurança e limites

O acesso exige `admin:operations:write`. Respostas usam `no-store`. Justificativas têm limites de tamanho e não devem conter credenciais ou dados pessoais desnecessários. Toda alteração de incidente e estado operacional gera auditoria.

Na hierarquia aprovada, incidentes operacionais exigem nível 2, incidentes e pausas financeiras exigem nível 3 e pausas não financeiras exigem nível 4. A gestão das solicitações de nível está disponível no painel e exige autorização final do nível 5.

No suporte financeiro, nível 1 atende, nível 2 registra a decisão de reembolso e nível 3 executará a ação no fornecedor. O registro de decisão permanece separado da execução financeira.

A retomada exige autenticação na plataforma, senha e código de seis dígitos enviado ao e-mail verificado, produzindo uma confirmação de propósito específico e uso único para cada pessoa. A proposta do técnico e a autorização do fundador são transações independentes. O novo teste HTTP/PostgreSQL cobre o ciclo completo com contas e mensagens exclusivamente fictícias; ele não demonstra entrega real de e-mail.

Ainda não implementado ou homologado:

- autenticação multifator independente do e-mail (como aplicativo autenticador ou chave de segurança) para retomada;
- tokens de ação externos de uso único para integração com mensageria;
- Meta WhatsApp Cloud API e webhook;
- integração externa de comunicação de incidentes e protocolo com a ANPD;
- identidades e contatos reais;
- homologação humana do exercício.

Colaboradores técnicos de nível 2 não acessam este painel por terem acesso ao repositório. A permissão de código é separada da identidade operacional e utiliza somente dados sintéticos.

Essas ausências impedem afirmar que o requisito de incidentes está concluído ou que o console está autorizado para produção financeira.

O adaptador inativo do WhatsApp aceita exclusivamente `https://graph.facebook.com/v22.0` e uma origem HTTPS limpa do painel, sem credenciais, query, fragmento ou subcaminho. Solicitações autenticadas não seguem redirecionamentos e falhas de transporte não reproduzem token, telefone ou referência do incidente. Mensagens de texto recebidas nunca aplicam ação operacional; o alerta contém apenas link para autenticação e decisão dentro do painel.
