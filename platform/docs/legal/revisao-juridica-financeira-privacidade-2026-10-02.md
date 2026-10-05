# Pacote de revisão jurídica, financeira e privacidade

Data: 2 de outubro de 2026. Estado: preparação técnica concluída; pareceres e decisões pendentes.

Este registro organiza a revisão dos documentos pré-operacionais existentes. Não aprova sua publicação, não altera regras comerciais, não preenche dados societários presumidos e não substitui parecer profissional. O piloto técnico está no PR #60, ainda separado deste pacote; seus erros permanecem registrados para retomada.

## Documentos de origem

- `politicas-privacidade-cookies-termos-pre-operacionais.md`: identificação, cookies, privacidade e termos.
- `politicas-operacionais-instituicoes-pre-operacionais.md`: venda, troca, doação, pagamentos, logística, disputas, instituições, Premium e suporte.
- `../decisions/FC-ATU-PL-001-pagamentos-logistica-doacoes.md`: decisões comerciais.
- `../../apps/api/payment-service.js`: cálculo e elegibilidade de pagamentos observados.
- `../pilot-run-2026-10-02.md`: resultado técnico proposto no PR #60; não é parecer jurídico nem aprovação humana.

## Lacunas e encaminhamento

| ID | Tema | Situação observada | Decisão/evidência de encerramento | Responsável pela revisão |
| --- | --- | --- | --- | --- |
| J01 | Identificação | Razão social, CNPJ, endereço, canais e vigência em aberto | Identificar a entidade operadora e preencher dados aprovados | Fundador e jurídico |
| J02 | Papel do marketplace | Operação C2C, intermediação, assinatura e logística integradas previstas | Delimitar responsabilidades por cada serviço e incidência das regras de consumo; sem exclusão genérica de direitos | Jurídico |
| J03 | Cancelamento e arrependimento | Aplicabilidade e efeitos dependem de validação | Matriz por serviço/estado, devolução de taxas, frete, prazo e canal executável | Jurídico e financeiro |
| J04 | Instituições e doações abertas | Minuta, documentação e critérios sanitários previstos | Validar termo, aceite, responsabilidades de conferência/recusa e homologação institucional | Jurídico e operação |
| J05 | Entregadores e parceiros | Contratos e coberturas não comprovados | Revisar responsabilidades, prova de entrega, vínculo contratual e seguro efetivamente contratado, se houver | Jurídico e fornecedores |
| F01 | Venda | Política operacional soma 8% ao produto; serviço calcula comissão e valor do vendedor a partir do montante da transação | Decidir quem suporta a comissão e comprovar checkout, total, split e líquido com exemplos | Fundador, contador e fornecedor |
| F02 | Comissão logística | Política: 5% do frete; serviço usa `fee(amountCents, 500)` quando há entrega | Confirmar base separada do frete e reconciliar documento/cálculo na futura correção | Financeiro e engenharia |
| F03 | Troca | Política: 2,5% por participante; serviço usa 500 pontos-base sobre o montante da transação | Definir base de avaliação, diferença, cobranças vinculadas e comprovar 2,5% para cada parte | Fundador, financeiro e engenharia |
| F04 | Premium | R$ 12,90/mês previsto; renovação e efeitos dependem de implementação/validação | Aprovar renovação, cancelamento, inadimplência, reembolso e emissão fiscal | Jurídico e contador |
| F05 | Repasse e conciliação | Prazos, retenções e disponibilidade dependem do processador | Obter contrato, estados, prazos, chargeback, tarifas e conciliação verificável | Financeiro e fornecedor |
| P01 | Inventário de tratamento | Política lista dados possíveis sem matriz definitiva por finalidade | Preencher inventário abaixo e limitar aviso ao tratamento efetivo | Privacidade e engenharia |
| P02 | Retenção e exclusão | Matriz de prazos ainda aberta | Aprovar prazo, fundamento, expurgo, exceções e efeito nos backups para cada categoria | Jurídico, privacidade e operação |
| P03 | Cookies e terceiros | Política prevê preferência; páginas incluem referências a Google Fonts | Inventariar cookies, armazenamento local e requisições externas; testar bloqueio/recusa antes de declarar conformidade | Privacidade e engenharia |
| P04 | Direitos do titular | Canal e rotina operacional não definidos | Definir canal, autenticação proporcional, responsáveis, prazos e ensaiar pedidos sintéticos | Privacidade e suporte |
| P05 | Incidentes | Política geral existe; responsáveis e fluxo precisam de comprovação | Aprovar critérios, contagem de prazo aplicável, escalonamento e registros de comunicação | Privacidade, jurídico e operação |
| P06 | Fornecedores e transferências | Lista efetiva, papéis e mecanismos não preenchidos | DPA/contrato, suboperadores, país, mecanismo aplicável e responsabilidades documentados | Jurídico e fornecedores |

As divergências financeiras são achados de inspeção, não conclusão sobre cobrança real: integrações e transações reais permanecem bloqueadas. Nenhum desses cálculos foi alterado nesta etapa.

## Exemplos para decisão financeira

Usar valores fictícios, centavos inteiros e política explícita de arredondamento. Não transformar estes exemplos em configuração antes da decisão.

| Exemplo | Referência matemática | Questão que precisa de resposta |
| --- | --- | --- |
| Venda de R$ 100,00 | Comissão de 8% = R$ 8,00 | Vendedor recebe R$ 92,00 ou R$ 100,00? Comprador paga R$ 100,00 ou R$ 108,00 antes do frete? |
| Frete de R$ 20,00 | Comissão de 5% = R$ 1,00 | Comissão incluída no frete ou adicionada? Quem paga e quem recebe? O valor do produto não deve substituir a base aprovada do frete |
| Troca com base de R$ 100,00 | 2,5% = R$ 2,50 por participante | Quem define a base? Como tratar diferença de valor e cancelamento de apenas uma rota? |
| Doação | Produto R$ 0,00; sem comissão comercial | Quem paga o frete e a comissão logística? Como registrar subsídio ou isenção? |
| Premium | R$ 12,90 por ciclo mensal | Quando começa/termina benefício? O que acontece com anúncios excedentes e cobrança após cancelamento? |

Para cada exemplo aprovado, registrar: produto, frete, comissão comercial, comissão logística, tarifa do processador, descontos, total cobrado, líquido de cada recebedor e lançamentos de estorno. Encaminhar o tratamento tributário e emissão de documentos ao contador; não presumir regime fiscal ou alíquota.

## Inventário de dados para preenchimento

Matriz preliminar de trabalho, não inventário certificado. Finalidades e bases legais devem ser validadas por atividade; não usar consentimento genérico para tudo.

| Categoria | Finalidade a confirmar | Acesso/compartilhamento a mapear | Retenção e exclusão |
| --- | --- | --- | --- |
| Conta, contato e autenticação | Cadastro, sessão, verificação e recuperação | Usuário, suporte autorizado e provedor de mensagens | Prazo/fundamento pendentes; incluir tokens e sessão |
| Anúncio e fotos | Publicação, busca e moderação | Público conforme campos; mídia e moderação | Prazo pendente; remoção de fotos/metadados |
| Endereço e localização | Busca aproximada, coleta e entrega | Exato apenas quando necessário; parceiro logístico | Prazo pendente; evitar endereço público |
| Transação e pagamento tokenizado | Cobrança, repasse, conciliação e disputa | Provedor financeiro e pessoal autorizado | Prazo fiscal/contratual a validar; sem cartão bruto |
| Chat, suporte e evidências | Comunicação operacional e mediação | Participantes e suporte conforme permissão | Prazo pendente; tratar informações sensíveis incidentais |
| Instituições e representantes | Verificação, parceria e recebimento | Revisores autorizados e instituição | Prazo pendente; documentos não devem ser públicos |
| Logs, auditoria e telemetria | Segurança, diagnóstico e rastreabilidade | Operação autorizada e fornecedores contratados | Prazo pendente; minimização/redação de dados |
| Cookies e armazenamento do navegador | Sessão, preferências e continuidade | Inventariar cada chave/domínio e terceiros | Duração, limpeza e categoria pendentes |

Acrescentar por linha: campos efetivos, origem, base legal, sistema, país, operador/controlador, suboperadores, controles de acesso, prazo, fundamento de retenção, rotina de exclusão e responsável. Manter documentos pessoais e pareceres confidenciais fora do Git; aqui registrar apenas decisões e referências autorizadas.

## Procedimento de revisão e aceite

1. Fundador confirma entidade, contatos, operação pretendida e responsáveis de revisão. Não presumir que existe equipe jurídica interna.
2. Jurídico avalia termos, responsabilidades, direitos, instituições, fornecedores e compatibilidade entre política e jornada.
3. Contador/financeiro fecha incidência, tributação, documentos, repasses, exemplos e conciliação.
4. Privacidade fecha inventário, bases, retenção, terceiros, direitos e incidentes com engenharia e operação.
5. Engenharia transforma decisões aprovadas em correções e testes em PRs próprios; erros do piloto permanecem na fila para retomada.
6. Revisores conferem a versão corrigida e registram nome/função, data, commit/documento, resultado, ressalvas e referência do parecer.
7. Só recomendar encerramento quando dados obrigatórios estiverem completos, divergências resolvidas e aprovações obtidas. Publicação e lançamento continuam sendo decisões separadas.

| Aprovação | Estado | Registro necessário |
| --- | --- | --- |
| Decisões comerciais do fundador | Pendente | Versão, decisões, data e responsável |
| Revisão jurídica | Pendente | Parecer e ressalvas resolvidas |
| Revisão contábil/financeira | Pendente | Exemplos, regime/documentos e conciliação aprovados |
| Revisão de privacidade | Pendente | Inventário, retenção, direitos e contratos aprovados |
| Correspondência entre política e implementação | Pendente | PRs e evidências após retomada das correções |

## Referências oficiais consultadas

Consulta em 2 de outubro de 2026. Referências para revisão; conferir texto vigente e aplicabilidade antes do parecer.

- [LGPD — texto compilado](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709compilado.htm): bases/finalidades, direitos, registros, segurança e incidentes.
- [Código de Defesa do Consumidor](https://www.planalto.gov.br/ccivil_03/leis/l8078compilado.htm): informação, contratos e direitos, conforme relação jurídica aplicável.
- [Decreto 7.962/2013](https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2013/decreto/d7962.htm): informação, atendimento e contratação no comércio eletrônico.
- [ANPD — Comunicação de Incidente de Segurança](https://www.gov.br/anpd/pt-br/canais_atendimento/agente-de-tratamento/comunicado-de-incidente-de-seguranca-cis): critérios, papéis, procedimento e prazos. Validar regra aplicável, exceções e responsabilidades contratuais no plano de resposta.

Não houve envio a profissionais, contratação, publicação de políticas ou preenchimento de credenciais. Desktop e protótipo raiz preservados.

## Reconciliação em 5 de outubro de 2026

O levantamento acima é histórico. As decisões comerciais do fundador foram registradas no FC-DEC-2026-10-02 (PR #62, integrado); 69 itens aprovados e item 12 em standby. A implementação posterior está documentada em `../approved-rules-implementation.md` e nos PRs #63–#74. Venda desconta 8% do vendedor; troca e logística têm cálculos separados. A homologação em PostgreSQL e Chrome do PR #74 usa somente fixtures e não habilita fornecedores, operação real ou termos jurídicos.

Os pareceres jurídico, contábil e de privacidade, a matriz de retenção, os dados societários e os canais oficiais continuam pendentes. A tabela de aprovações original não deve ser usada para concluir que a decisão comercial ainda aguarda resposta, nem que as revisões profissionais já aconteceram. Não ativar este material como termos. Sem cobrança, repasse, mensagens, contratação, publicação, dados reais/infantis ou desktop.
