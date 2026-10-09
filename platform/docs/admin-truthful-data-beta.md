# Painéis administrativos com dados verificáveis

Os painéis **Financeiro** e **Logística** consultam exclusivamente registros persistidos no banco local. Eles não completam lacunas com nomes, métricas, mapas, rotas, disponibilidade ou projeções demonstrativas.

## Financeiro

- totaliza pagamentos registrados e volume cujo estado é `paid`;
- separa pagamentos confirmados, em processamento e com exceção;
- lista valores armazenados, ocorrências financeiras e obrigações do entregador;
- não apresenta obrigação interna como transferência bancária concluída.

## Logística

- totaliza entregas pelos estados persistidos;
- lista modalidade, entregador atribuído, comprovante e previsão cadastrada;
- não infere localização, rota, pontualidade, NPS ou disponibilidade de entregadores;
- preserva a consulta e validação administrativa de comprovantes reais.

As duas consultas exigem escopo administrativo, usam `cache-control: no-store` e registram o identificador do administrador no histórico de auditoria. Quando o banco está vazio ou indisponível, a interface exibe explicitamente o estado vazio ou indisponível.

## Dashboard, relatórios e alertas

- o dashboard usa contagens acumuladas, volume confirmado e transações recentes do banco;
- relatórios exportam somente CSV gerado a partir da consulta real; PDF, XLSX e agendamentos permanecem indisponíveis;
- alertas são pendências derivadas de estados de pagamentos, ocorrências financeiras, entregas e controles pausados;
- alertas não podem ser encerrados apenas na interface: a correção deve ocorrer no fluxo operacional de origem;
- telemetria, SLA, NPS, conversão, previsões e saúde de provedores ficam ocultos enquanto não houver fonte homologada.

## Usuários, catálogo e acesso

- o diretório usa a API administrativa real para busca, convite, suspensão, reativação e mudança de papel;
- mudanças de papel e estado devem ser realizadas separadamente, preservando uma intenção inequívoca por evento de auditoria;
- o catálogo mostra contagens e anúncios persistidos, mas permanece somente leitura enquanto não existir moderação administrativa transacional;
- a matriz de acesso mostra somente os quatro papéis realmente aplicados pela API e sua distribuição no banco;
- papéis personalizados, edição granular de escopos e garantias de 2FA não são simulados.

## Dados, previsões e infraestrutura

- a página de dados mostra somente contagens do banco operacional e identifica ETL, Data Warehouse, qualidade e linhagem como pendentes;
- previsões permanecem desativadas até existirem dados adequados, validação, explicabilidade, monitoramento de viés e governança;
- infraestrutura diferencia endpoints e adaptadores presentes no código de disponibilidade operacional comprovada;
- o estado dos provedores segue os manifestos locais: pré-contrato e pesquisa, sem provisionamento ou credenciais;
- carga, recuperação, disponibilidade, latência, recursos, RPO e RTO não são simulados.

## Segurança, configurações e moderação

- segurança lista sessões persistidas da conta atual e permite revogar as demais com auditoria;
- localização, dispositivo confiável, 2FA, varredura de vulnerabilidades e conformidade não são inferidos;
- configurações não oferece controles sem persistência e descreve provedores conforme os manifestos pré-contrato;
- testes visuais de integração, switches sem armazenamento e alegações de fornecedores ativos foram removidos;
- o fluxo real de moderação foi preservado: decisões, contestação, revisão independente e suspensão temporária exigem justificativa e ficam persistidas.

## Auditoria e webhooks

- a trilha administrativa e sua exportação CSV usam eventos persistidos;
- webhooks exibem somente eventos recebidos e processados localmente nas tabelas de pagamentos e logística;
- identificadores, tipos e horários são exibidos sem payload, hash ou referência sensível do provedor;
- recebimento local não é apresentado como entrega externa bem-sucedida;
- IP, retenção, assinatura criptográfica da trilha, latência, streaming, logs técnicos e reprocessamento administrativo permanecem indisponíveis.

## Parcerias, inovação, piloto e suporte

- parcerias declara a ausência de CRM, contratos e indicadores comerciais persistidos;
- instituições beneficiárias e fornecedores pesquisados não são apresentados como parceiros contratados;
- inovação mostra lacunas candidatas sem percentuais, votos, experimentos ou roadmap fictício;
- o lançamento segue o manifesto de ensaio interno, que proíbe integrações externas, dados pessoais reais, transações reais e acesso público;
- a fila de suporte usa chamados persistidos e permite resposta e mudança de estado somente para perfis autorizados.

## Limite desta etapa

A integração HTTP automatizada permanece adiada por decisão do projeto. A cobertura atual valida serviços, repositórios, contratos da interface e ausência dos dados fictícios removidos.
