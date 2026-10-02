# Plano de evolução de produto — design e engenharia

## Decisão de arquitetura

O protótipo da raiz do repositório continua como ambiente de demonstração visual. O produto navegável evolui em `platform/apps/site`, `platform/apps/app` e `platform/apps/admin`, onde cada rota possui arquivo próprio, contratos de API e controles de produção.

Nenhuma configuração local demonstrativa pode ser promovida para produção. O servidor declara o modo através do cabeçalho `x-fraldacycle-mode`; o painel administrativo exige sessão e aplica menor privilégio fora do ambiente local.

## Navegação administrativa por responsabilidade

| Papel | Foco operacional | Módulos disponíveis |
| --- | --- | --- |
| Administrador | governança, operação e configuração | todos os módulos administrativos |
| Moderação | segurança, usuários e tratamento de incidentes | dashboard, usuários, anúncios, operações, logística, relatórios, alertas, moderação e auditoria |

As permissões reais permanecem aplicadas no backend. A filtragem de navegação reduz carga cognitiva, mas não substitui autorização de servidor.

## Glossário de confiança

| Termo | Uso aprovado | Não prometer |
| --- | --- | --- |
| Pagamento protegido | valor ainda não foi liberado à contraparte enquanto a etapa prevista não foi concluída | garantia financeira sem regra e provedor contratados |
| Em custódia | status interno do valor entre confirmação e liberação | conta de custódia regulada sem contrato específico |
| Entrega rastreada | eventos de coleta, rota e prova disponíveis conforme a modalidade | localização contínua ou precisão não contratada |
| Perfil verificado | requisito de identidade concluído no processo aplicável | idoneidade, qualidade do produto ou risco zero |
| Em análise | caso recebeu registro e aguarda decisão | prazo, reembolso ou resultado garantido |

Toda cópia comercial, jurídica e operacional deve usar esta definição antes de usar uma expressão de confiança.

## Homologação com pessoas — gate obrigatório

1. Recrutar pelo menos cinco participantes por papel: família compradora, anunciante e entregador.
2. Executar tarefas de busca, publicação, confirmação, suporte e entrega sem instrução durante a tarefa.
3. Medir conclusão, tempo, erro, compreensão da custódia e confiança percebida.
4. Registrar somente dados consentidos e pseudonimizados.
5. Corrigir falhas críticas, repetir cenários afetados e obter decisão formal de avanço.

Critérios mínimos de saída: nenhuma barreira crítica de acessibilidade, nenhuma interpretação incorreta recorrente de pagamento/entrega e 80% ou mais de conclusão independente em cada jornada essencial.

## Integrações reais — gate obrigatório

- selecionar e contratar fornecedores de identidade, pagamento, logística, geocodificação, armazenamento, notificações, observabilidade e rate limiting;
- registrar base legal, DPA, SLA, política de retenção, plano de incidente e responsável de cada fornecedor;
- configurar credenciais somente no gerenciador de segredos homologado;
- validar webhooks, idempotência, reversão e carga em homologação;
- liberar produção apenas após aprovação jurídica, financeira, LGPD e segurança.

Os adaptadores e testes de contrato já existentes reduzem risco técnico, mas não substituem estas decisões externas.
