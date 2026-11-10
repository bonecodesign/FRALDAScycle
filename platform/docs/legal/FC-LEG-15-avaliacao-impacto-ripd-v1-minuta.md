# FC-LEG-15 — Avaliação Preliminar de Riscos e Modelo de RIPD — minuta v1

**Estado:** modelo pré-operacional; **não é RIPD concluído**. Elaborar com encarregado, jurídico, segurança e responsáveis técnicos.

## 1. Identificação
Controladora [RAZÃO SOCIAL — A PREENCHER]; responsável [A DESIGNAR]; versão, data, escopo, sistemas, operadores, decisor e hipótese de necessidade do relatório.

## 2. Contexto e operações
Descrever cadastro adulto, perfis infantis (data de nascimento/emoji), anúncios, marketing, pagamento, logística, certidões de entregadores, suporte, logs e terceiros. Identificar volumes estimados, usuários vulneráveis, países, dados sensíveis eventualmente incidentais e riscos de reidentificação.

## 3. Necessidade, proporcionalidade e alternativas
Para cada finalidade demonstrar necessidade de cada campo, inclusive **comparação entre data de nascimento completa e faixa etária declarada**; avaliar se cadastro familiar obrigatório é proporcional e se pode ser opcional sem prejudicar serviço. Explicar alternativas rejeitadas, controles e impacto ao melhor interesse da criança.

## 4. Matriz de riscos preliminar
| Risco | Impacto potencial | Controles propostos | Evidência faltante |
|---|---|---|---|
| Exposição de data infantil | Privacidade e segurança de crianças | Acesso restrito, não compartilhar, expurgo | Testes de autorização, logs e backups |
| Inferência de faixa em marketing | Perfilamento e divulgação indevida | Consentimento separado, mensagem final sem faixa | Auditoria de payloads |
| Retenção de certidões | Discriminação e dados excessivos | Revisão humana e purga em 30 dias da verificação | Evidência de exclusão em fornecedores |
| Vazamento de foto/endereço | Risco físico e privacidade | Minimização, remoção EXIF, retenção | Testes e contrato logístico |
| Fraude financeira | Perdas e dados expostos | PSP habilitado, tokenização, conciliação | Contrato e homologação |
| Incidente em operador | Divulgação e atraso de resposta | DPA, SLA, suboperadores e auditoria | Contratos reais |

Classificar probabilidade, gravidade, risco inerente e residual somente após evidências, não preencher com números arbitrários.

## 5. Direitos e medidas
Mapear transparência, solicitações, correção, exclusão, revogação, incidentes, segurança, rastreabilidade e mecanismos de contestação. Registrar transferências internacionais e salvaguardas quando existentes.

## 6. Decisão e revisão
Decisão documentada: [GO/NO-GO — PENDENTE], risco residual, condições, responsável, parecer e data. **Até revisão e testes, permanece NO-GO.** Revisar após mudança de finalidade, operador, arquitetura ou incidente relevante.
## Marcos de liberação alinhados à decisão de governança
**Fase 1:** piloto fechado com dados sintéticos e avaliação preliminar; não implica tratamento de dados infantis reais. **Fase 2:** eventual tratamento infantil real em piloto restrito somente após avaliação preliminar documentada, base legal por finalidade, demonstração do melhor interesse, medidas efetivas e aprovação jurídica/privacidade/segurança. A decisão do fundador prevê concluir RIPD integral durante o piloto fechado e exige RIPD concluído e aprovado antes de abrir a funcionalidade infantil ao público geral. A avaliação de risco pode exigir antecipação do RIPD integral; se houver risco elevado sem mitigação demonstrada, manter NO-GO. Registrar o fundamento e a decisão de cada fase.
