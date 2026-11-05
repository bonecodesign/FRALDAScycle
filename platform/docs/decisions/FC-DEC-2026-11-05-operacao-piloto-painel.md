# Decisões do fundador — operação, piloto e painel administrativo

Data de consolidação: 5 de novembro de 2026.

Estado: **regras de produto aprovadas; implementação, contratação e validações externas continuam separadas**.

Este registro não ativa fornecedor, pagamento, carteira, coleta infantil, logística, marketing ou produção. Pareceres profissionais, contratos, credenciais, pessoas nomeadas, simulações e homologações continuam obrigatórios onde indicados. O projeto permanece **NO-GO** até o dossiê conjunto de prontidão.

## 1. Painel administrativo e isolamento setorial

1. Existe um único painel ADM, personalizado por login, nível, setor e escopos explícitos.
2. O número do nível não concede acesso automático a outro setor. Nível 3 técnico não acessa financeiro; nível 3 financeiro não acessa repositório.
3. Cada setor acessa integralmente apenas a própria etapa. Outros setores veem somente estado, responsável, SLA e próximo encaminhamento, sem documentos, valores, pareceres ou justificativas internas.
4. Não existe acesso excepcional temporário entre setores. Casos multissetoriais usam pedido estruturado e texto complementar minimizado; anexos não atravessam setores.
5. Informação sensível no texto complementar é mascarada antes do compartilhamento. O original não é copiado para auditoria.
6. Colaborador vê demandas atribuídas; supervisor vê a fila do próprio setor e pode reatribuir com justificativa.
7. Estados principais: `nova`, `em_triagem`, `em_analise`, `aguardando_usuario`, `aguardando_outro_setor`, `aguardando_aprovacao`, `resolvida`, `encerrada`. Estados excepcionais: `bloqueada`, `sla_vencido`, `cancelada`.
8. Atraso escala progressivamente para responsável, supervisor, nível 4 e, somente quando crítico ou reservado, nível 5.
9. Indicadores medem fila, SLA, tempo, bloqueios, reabertura e capacidade; não existe ranking punitivo de pessoas.
10. Auditoria comum fica 12 meses. Ações financeiras, sanções, dados pessoais, aprovações e decisões legais ficam cinco anos, sem copiar credenciais ou conteúdo sensível.
11. Nível 5 possui visão integral e auditada. Toda ação mostra autor, horário, fundamento, resultado e confirmação externa quando aplicável.
12. O painel permite resolver a etapa interna: suporte, moderação, documentos, reembolsos aprovados, conciliação, ocorrências logísticas, instituições, incidentes, retenções, ondas e GO/NO-GO.
13. Contrato, parecer profissional, emergência pública ou tarefa obrigatória em portal externo permanece fora do painel; o painel controla responsável, evidência, prazo e aprovação, sem simular execução.

## 2. Design e desenvolvimento

14. A regra anterior de perfil técnico nível 2 está superada. Níveis 1 e 2 registram, detalham e encaminham; não alteram código nem design.
15. Nível 3 técnico cria branch, altera código ou design, gera preview, executa testes e propõe Pull Request.
16. Nível 4 técnico revisa, solicita correção, aprova o PR e libera homologação.
17. Nível 5 autoriza publicação em produção. Autor não aprova a própria mudança.
18. Branch, preview, testes, CI, PR, rollback e auditoria são obrigatórios. Não há edição direta de `main`, terminal livre em produção, dados reais de clientes ou segredos no navegador.
19. Hotfix mantém fluxo acelerado 3 → 4 → 5, com testes mínimos e revisão completa posterior. Feature flag pode ser desligada imediatamente para conter incidente.

## 3. Sanções e encerramento

20. Sanções graduais usam janela móvel de 12 meses: advertência, 24 horas, 7 dias, 30 dias e análise excepcional de encerramento.
21. Risco crítico permite suspender novas operações por até 72 horas, preservando suporte, histórico, pagamentos devidos e operações existentes.
22. Recurso tem SLA de 48 horas e revisor independente. Decisão anulada não conta como reincidência; permanece apenas auditoria neutra.
23. Encerramento punitivo nunca é automático: nível 3 instrui, nível 4 revisa e nível 5 autoriza.
24. Exclusão voluntária usa sete dias e inventário por categoria: dados básicos após a janela; dados infantis na efetivação; conteúdo público imediatamente; backups em até 30 dias.
25. Financeiro/transacional e aceites necessários ficam cinco anos; suporte comum, 12 meses; suporte financeiro/legal, até cinco anos; logs técnicos, 30 dias, com IP completo por sete dias.
26. Pendência aceita a solicitação, bloqueia novas operações e adia somente a conclusão. Retenção excepcional exige níveis 3 → 4 → 5.

## 4. Termos, perfis familiares e piloto infantil

27. Mudança material exige novo aceite; editorial apenas comunicação. Aviso normal: 15 dias; preço Premium: 30 dias.
28. Sem aceite, bloquear somente novas operações, preservando suporte, histórico, exportação, exclusão, direitos e obrigações existentes.
29. Publicação documental segue nível 3 → 4 → 5, com versão, hash, resumo e texto integral. Segurança e Jurídico podem acelerar mudança urgente, notificando nível 5.
30. Perfis infantis exigem parecer escrito conjunto de Jurídico e Privacidade e autorização final do nível 5.
31. Piloto infantil: 60 dias, até 250 contas em cinco ondas de 50. Checklist precede cada onda; gatilho crítico interrompe nova coleta e personalização.
32. Expansão infantil exige relatório, confirmação dos pareceres e aprovação 3 → 4 → 5.

## 5. Financeiro, cartão e frete externo

33. Asaas começa em sandbox e depois produção limitada. Piloto aceita PIX e cartão à vista; Premium mantém cartão recorrente separado.
34. Vendedor paga 5% da FraldaCycle e tarifa real do Asaas, discriminadas. Repasse ocorre após entrega e janela de 48 horas.
35. Produção financeira inicial limita R$ 200 por transação e R$ 5.000 acumulados. Webhook e conciliação diária são obrigatórios.
36. Chargeback, cancelamento e tarifa irrecuperável seguem causa comprovada. Direito ao reembolso integral prevalece; retorno sempre à origem.
37. Cartão exige CPF coincidente, tokenização e antifraude. Sem autenticação reforçada, aceitar somente baixo risco até R$ 100 por transação e R$ 200 em 24 horas; acima, exigir autenticação ou oferecer PIX.
38. Token usado com CPFs distintos bloqueia e segue análise. Nível 3 propõe exceção e nível 4 autoriza.
39. Cotação externa usa prazo do parceiro, limitado a 10 minutos. Total: tarifa real do parceiro + 5% FraldaCycle, sem margem oculta.
40. Diferença posterior nunca é cobrada automaticamente. Contingência exige nova apresentação e confirmação.
41. Ordem logística: Lalamove; entregador FraldaCycle elegível mais próximo; demais parceiros homologados. Sem retirada local e Correios.
42. Piloto externo: até 30 entregas ou R$ 3.000 em fretes. Ativação real exige homologação e aprovação 3 → 4 → 5.

## 6. Troca e entregador FraldaCycle

43. Troca usa um único entregador do início ao fim no circuito A → B → A. Em B, coletar e validar operacionalmente antes de entregar o produto de A.
44. Uma oferta, custódia e remuneração cobrem o ciclo completo. Custo logístico total é dividido igualmente entre as duas cobranças.
45. Emergência permite substituição somente assistida, com bloqueio, localização dos produtos e prova de transferência de custódia.
46. Cada entrega exige código de uso único e foto do pacote na porta, sem pessoas, documentos ou interior da residência.
47. Os dois lados têm 24 horas para confirmar. Sem confirmação dupla, nenhuma coleta começa; pagamento isolado retorna à origem.
48. Primeira fase limita cinco trocas; vendas e trocas podem começar simultaneamente em grupo controlado.
49. Piloto próprio: até 25 entregadores em cinco ondas de cinco, raio de 15 km, das 8h às 20h; operação iniciada pode terminar até 21h.
50. Veículos: bicicleta, moto e carro. Bicicleta: até 5 km e 5 kg. Demais ofertas usam peso, volume e capacidade validada.
51. Localização somente online e durante entrega. Coordenadas detalhadas: sete dias; depois, resumo operacional.
52. Recusa não pune. Três ofertas ignoradas colocam offline. Cancelamento após aceite exige motivo e revisão humana quando recorrente.
53. Piso líquido inicial de simulação: bicicleta R$ 8, moto R$ 10, carro R$ 14, incluindo até 3 km; adicionais sugeridos de R$ 1,30, R$ 1,80 e R$ 2,40 por km excedente. Espera: R$ 0,30/min após dez minutos. Validar com mercado real antes do piloto.
54. Chuva intensa registrada adiciona 15%; condição insegura suspende ofertas. Gorjeta pós-entrega: R$ 2, R$ 5, R$ 10 ou R$ 1–50 livre, 100% ao entregador.
55. Checklist veicular renova a cada 90 dias, com aviso sete dias antes; pendência bloqueia ofertas, não pagamentos.

## 7. Carteira do entregador

56. Ganhos líquidos entram em carteira. Saldo pode comprar no Marketplace ou combinar com PIX/cartão; reembolso retorna proporcionalmente às origens.
57. Um saque PIX gratuito por janela móvel de sete dias, mínimo R$ 20 e processamento em até um dia útil, somente para conta/chave do mesmo CPF.
58. Saldo não expira. Encerramento paga integralmente, mesmo abaixo do mínimo. Suspensão preserva saque não contestado e bloqueia novas compras.
59. Não há depósito externo, transferência entre usuários ou saldo negativo. Valores em disputa ficam separados do disponível.
60. Carteira real exige parecer jurídico/contábil, homologação do provedor e aprovação 3 → 4 → 5; feature flag permanece desligada.

## 8. Fornecedores, comunicação e infraestrutura

61. OCR: Google Cloud Vision; QR local. Sem persistir texto reconhecido. Inconclusivo vai à revisão humana em 24 horas; recurso independente em 48 horas; qualquer QR bloqueia no piloto.
62. Homologação OCR: 500 imagens, 98% telefone/e-mail, 99% QR, até 5% falso positivo e auditoria mensal de 100 imagens. Privacidade e aprovação 3 → 4 → 5 precedem produção.
63. E-mail transacional: Amazon SES. Push: Firebase Cloud Messaging. WhatsApp crítico: Meta Cloud API. Marketing SES usa subdomínio separado.
64. Notificação crítica escala push/e-mail e WhatsApp autorizado como contingência. Tokens push saem no logout, invalidação ou 90 dias. Metadados de entrega ficam 90 dias.
65. Suporte: aplicativo e e-mail; WhatsApp somente emergência. Geral em dias úteis 8h–18h; entrega/crítico todos os dias 8h–21h. SLA inicial: 15 min crítico, 4 h úteis financeiro/bloqueio, 1 dia útil demais.
66. Incidentes têm quatro gravidades, equipe multidisciplinar, comunicação protetiva, evidência proporcional, simulação trimestral, exercício anual e prontidão 3 → 4 → 5.
67. Backup: S3+KMS em conta separada na região de São Paulo; incremental horário, completo diário, janela 30 dias, RPO 1 h, RTO crítico 4 h, Object Lock 30 dias e restauração trimestral.
68. Segredos: AWS Secrets Manager, identidade por serviço/ambiente, rotação conforme criticidade, acesso temporário e testes de revogação. Prontidão 3 → 4 → 5.

## 9. Instituições, marketplace e marketing

69. Instituição usa CNPJ, representante, autodeclaração e eventual indicação de parceiro. Nível 2 verifica, nível 3 aprova e nível 4 é notificado. Renovação anual.
70. Todas as instituições do piloto aceitam embalagem aberta, mas podem recusar livremente na retirada. Recusas frequentes geram revisão humana de capacidade.
71. Doação usa chat para retirada, confirmação bilateral e reserva de 48 horas. Até cinco instituições; expansão após 20 retiradas e aprovação 3 → 4 → 5.
72. Marketplace não possui catálogo central obrigatório. Usuário cria foto, dados, condição, quantidade e preço. Referência do fabricante apenas auxilia.
73. Correspondência e OCR sugerem marca, linha, tamanho e quantidade; usuário confirma. Um anúncio ativo por produto idêntico: até três unidades comum e cinco Premium.
74. Referência de preço é opcional e anônima, somente após dez vendas semelhantes nos últimos 90 dias.
75. Dados de fabricante podem nascer de sugestão do usuário e captura automatizada permitida, mas só entram na prioridade após conferência oficial: nível 1 recebe, nível 2 verifica, nível 3 aprova; revisão a cada 90 dias.
76. Matomo é hospedado pela FraldaCycle. Antes do consentimento, somente cookies necessários. Preferência mais restritiva prevalece. Marketing real exige Jurídico/Privacidade e aprovação 3 → 4 → 5.

## 10. Piloto geral e dossiê de prontidão

77. Piloto geral: regiões contíguas de Belo Horizonte, até 250 contas por cadastro público limitado e duração de 90 dias. Entregadores, instituições e equipe não contam no limite.
78. Critérios mínimos: nenhum incidente crítico aberto; pagamentos e carteira conciliados; ao menos 95% das entregas sem intervenção crítica; ao menos 90% dos chamados no SLA; direitos de dados, consentimentos e restauração comprovados.
79. Incidente crítico, divergência financeira sem controle ou saldo sem lastro pausa o piloto. Retomada exige correção e aprovação 3 → 4 → 5.
80. O painel reúne dossiê por área em `GO`, `NO-GO` ou `GO condicionado`. Jurídico, Privacidade, Segurança, Financeiro e Operação podem registrar NO-GO em seu domínio.
81. Nível 3 consolida, nível 4 revisa e nível 5 autoriza por último. Código pronto não substitui contratos, pessoas, credenciais, testes ou pareceres.

## Conflitos superados

- Desenvolvimento e design deixam de ser capacidade de nível 2; passam ao fluxo técnico 3 → 4 → 5.
- Níveis não são cumulativos entre setores. Acesso exige nível, setor e escopo.
- Na troca, as duas pernas não usam entregadores independentes; um único entregador executa o ciclo A → B → A.
- Instituições do piloto aceitam embalagens abertas como condição, embora possam recusá-las livremente na retirada.
- Piloto institucional não possui seguro nem garantia adicional da FraldaCycle. Não existe prazo obrigatório de reavaliação; interfaces não podem prometer cobertura.
- Marketplace é formado por anúncios dos usuários; tabela de fabricante não cria catálogo obrigatório.

## Gates mantidos

- Todas as flags de produção e reconhecimentos formais permanecem falsos.
- Carteira, dados infantis, Asaas, logística, OCR, marketing, WhatsApp, backups e demais integrações reais não são ativados por este documento.
- Decisão aprovada não significa código implementado, fornecedor contratado, operação ativa ou validação profissional concluída.
- Percentuais formais da matriz não mudam apenas por estas decisões.
