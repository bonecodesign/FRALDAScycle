# Console operacional de incidentes — beta

## Onde fica

O console está em `/admin/operations`, na área administrativa. A mesma tela reúne suporte, pausa/retomada, incidentes e atalhos para financeiro e logística.

## Implementado

- abertura idempotente de incidente com referência opaca;
- severidades baixa, média, alta e crítica;
- domínios global, marketplace, cobranças, reembolsos, repasses, logística, doações e Premium;
- fila priorizada por severidade e atualização;
- atribuição e liberação sem tomada concorrente;
- estados aberto, contido, monitoramento e resolvido;
- reabertura e notas operacionais;
- controle otimista de versão;
- linha do tempo e auditoria persistidas;
- pausa independente de novas cobranças, criação de reembolsos e preparação de repasses;
- contestação, consulta, suporte e compromissos existentes preservados.

O painel nunca edita saldo, altera valor financeiro nem declara transferência. Preparar obrigação de repasse continua diferente de enviar dinheiro ao provedor.

## Segurança e limites

O acesso exige `admin:operations:write`. Respostas usam `no-store`. Justificativas têm limites de tamanho e não devem conter credenciais ou dados pessoais desnecessários. Toda alteração de incidente e estado operacional gera auditoria.

Na hierarquia aprovada, incidentes operacionais exigem nível 2, incidentes e pausas financeiras exigem nível 3 e pausas não financeiras exigem nível 4. A gestão das solicitações de nível está disponível no painel e exige autorização final do nível 5.

No suporte financeiro, nível 1 atende, nível 2 registra a decisão de reembolso e nível 3 executará a ação no fornecedor. O registro de decisão permanece separado da execução financeira.

Ainda não implementado:

- segundo fator específico para retomada;
- aprovação conjunta executável entre fundador e técnico;
- tokens de ação de uso único;
- Meta WhatsApp Cloud API e webhook;
- identidades e contatos reais;
- homologação humana do exercício.

Colaboradores técnicos de nível 2 não acessam este painel por terem acesso ao repositório. A permissão de código é separada da identidade operacional e utiliza somente dados sintéticos.

Essas ausências impedem afirmar que o requisito de incidentes está concluído ou que o console está autorizado para produção financeira.
