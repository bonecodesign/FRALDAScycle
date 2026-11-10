# FC-LEGAL-MASTER-001 — Programa de documentação e redução de riscos jurídicos

**Versão:** 0.1 — 08/11/2026  
**Estado:** minuta de governança jurídica, não vigente, sem parecer profissional.  
**Escopo:** marketplace FraldaCycle, piloto BH e expansão futura.  
**Regra:** nenhuma minuta, teste ou aceite interno substitui análise jurídica, privacidade, segurança e homologação operacional. Piloto **NO-GO**.

## 1. Objetivo e critérios de completude

Objetivo: cobertura documental integral, rastreável, coerente com a operação real e com os direitos dos usuários; minimizar exposição financeira, trabalhista, consumerista, regulatória, tributária e de dados **sem excluir responsabilidades legalmente inderrogáveis**.

Separar três indicadores:
- **Cobertura documental:** artefatos exigidos elaborados, versionados, consistentes e com campos identificados; 100% somente quando cada artefato tiver texto integral e nenhum placeholder crítico.
- **Validação profissional:** pareceres, ajustes e assinaturas efetivas por área; nunca inferir aprovação a partir de CI ou aprovação do fundador.
- **Prontidão operacional:** evidência de implementação, fornecedores, controles e autorização GO; permanece NO-GO até gates obrigatórios.

Não prometer imunidade jurídica, ausência de vínculo empregatício, ausência de solidariedade consumerista ou isenção tributária apenas por cláusula contratual.

## 2. Hierarquia e fontes internas

Prevalecem legislação aplicável e direitos indisponíveis; condições específicas da operação; Termos; Política de Privacidade; políticas específicas; resumos. Divergências suspendem publicação. Decisões internas: `docs/decisions/FC-DEC-2026-11-03-governanca-juridica-produto.md`; minutas v2 em `docs/legal/`; matriz `docs/requirements-matrix.json`; pacote `docs/legal-privacy-review-packet.md`. A consolidação FC-JUR-01 a 50 está no PR #222, e o inventário no PR #225; verificar integração antes de reutilizar.

## 3. Matriz mestra de documentos e entregáveis

| ID | Instrumento | Conteúdo mínimo / risco a tratar | Gate de aprovação |
| --- | --- | --- | --- |
| LEG-01 | Termos gerais de uso | Intermediação, cadastro, elegibilidade, anúncios, moderação, operação, direitos e disputas; vedar exonerações abusivas | Consumerista + jurídico |
| LEG-02 | Política de privacidade | Controladora, finalidades/bases por operação, categorias, operadores, direitos, retenção, transferências, incidentes | Jurídico + encarregado |
| LEG-03 | Aviso de cookies e tecnologias | Categorias, finalidade, opt-in quando aplicável, preferência, revogação, terceiros | Privacidade + produto |
| LEG-04 | Política de anúncios e produtos | Fraldas lacradas para venda/troca; validade, recall, procedência, integridade, fiscalização e sanções proporcionais | Consumerista + segurança produto |
| LEG-05 | Política de doações | Embalagem aberta apenas sob condições, instituição habilitada, recusa, retirada direta, comprovante sem valor fiscal | Jurídico + instituições |
| LEG-06 | Política de pagamentos e repasses | Intermediação, fornecedor, tarifas, splits, estornos, chargebacks, evidência, conciliação e contingência | Jurídico + contabilidade + fornecedor |
| LEG-07 | Política de cancelamento/reembolso | Arrependimento legal, vício, defeito, divergência, custos externos e disputas, sem restringir CDC | Consumerista |
| LEG-08 | Termos Premium | Preço, periodicidade, aceite destacado, cancelamento, arrependimento, carência, reajuste, destaque | Consumerista + financeiro |
| LEG-09 | Política de entregas | Responsabilidades, parceiro externo, comprovantes, ocorrências, prazo, sinistro, reclamação | Jurídico + logística |
| LEG-10 | Instrumento de entregador autônomo | Liberdade real, recusa, ausência de exclusividade, pagamentos, certidões, segurança, riscos, recursos; prática deve corresponder ao contrato | Trabalhista + jurídico |
| LEG-11 | Política de verificação de entregadores | Critérios proporcionais, certidões, acesso, retenção até 30 dias da verificação, descarte, recurso e revisão humana | Privacidade + trabalhista |
| LEG-12 | Instrumento de adesão institucional | Elegibilidade, representação, retirada, aceitação/recusa, documentos, dados, responsabilidade e desligamento | Jurídico + instituições |
| LEG-13 | Política de dados familiares e infantis | Melhor interesse, necessidade, hipótese legal por finalidade, responsáveis, remoção, exportação, perfil aos 13 anos | Privacidade + jurídico |
| LEG-14 | Registro de operações de tratamento | Inventário por finalidade, base, titulares, campos, fornecedores, localização, retenção e controles | Encarregado + segurança |
| LEG-15 | Avaliação preliminar e RIPD | Necessidade/proporcionalidade, riscos, mitigação, risco residual, responsável e decisão; antes de abertura geral | Encarregado + jurídico |
| LEG-16 | Política de retenção e eliminação | Prazos por dado, evento inicial, backups, exceções, litígios, comprovantes e testes de exclusão real | Privacidade + segurança |
| LEG-17 | Procedimento de direitos dos titulares | Identidade, confirmação, acesso, correção, oposição, revogação, portabilidade quando aplicável, prazos e evidência | Encarregado |
| LEG-18 | Resposta a incidentes | Classificação, contenção, evidências, avaliação de risco, ANPD/titulares quando cabível, fornecedores e registros | Segurança + encarregado |
| LEG-19 | Contratos de operadores e DPA | Instruções, segurança, suboperadores, transferência internacional, incidentes, auditoria, devolução/exclusão, rescisão | Jurídico + privacidade |
| LEG-20 | Contratos com fornecedores de pagamento/logística | SLA, repasses, antifraude, riscos, indenização proporcional, seguro quando aplicável, dados e encerramento | Jurídico + financeiro |
| LEG-21 | Política de suporte, reclamações e moderação | Canais, protocolos, prazos, provas, escalonamento, recursos e preservação proporcional | Consumerista + operação |
| LEG-22 | Política de propriedade intelectual e conteúdo | Licença limitada, remoção, retenção excepcional, denúncias e proibição de IA/marketing não autorizado | Jurídico/IP |
| LEG-23 | Política de comunicação e marketing | Opt-in independente, prova, cancelamento, segmentação minimizada, fornecedores e mensagens transacionais | Privacidade + consumerista |
| LEG-24 | Política fiscal e documental | Natureza de receita, emissão fiscal, obrigações da empresa/usuários/instituições, comprovantes, sem promessas de isenção | Contabilidade + tributário |
| LEG-25 | Política de governança e aprovação | Matriz de responsáveis, revisões, versões, bloqueios, suspensão e GO/NO-GO | Jurídico + fundador |
| LEG-26 | Política de acessibilidade | WCAG 2.1 AA como meta, testes, atendimento alternativo, evidência e correções | Produto + acessibilidade |
| LEG-27 | Termos do piloto fechado | Escopo experimental, limitações transparentes, consentimentos, canal de suporte, sem renúncia de direitos | Jurídico + produto |
| LEG-28 | Matriz de risco e responsabilidade | Evento, agente, dever legal, mitigação contratual/operacional, risco residual, seguro, contingência | Jurídico + financeiro |
| LEG-29 | Política de solicitações de autoridades | Recepção, autenticação, competência, minimização, ordem judicial, sigilo, registro e prazo legal | Jurídico + privacidade |
| LEG-30 | Checklist de publicação e aceite | Versões, telas, aceites específicos, logs, tradução em UX, revogação, rollback e evidência de homologação | Jurídico + produto + segurança |

**Status inicial:** todos os LEG-01 a LEG-30 = `A AUDITAR`. Existência de minuta correlata não implica cobertura integral nem aprovação. Atualizar por documento: `não localizado`, `minuta`, `revisão interna`, `parecer profissional`, `homologado`, `vigente`, com link e data.

## 4. Controles prioritários de redução de exposição

1. **Intermediação verdadeira:** descrever com precisão o que a FraldaCycle faz, cobra, controla e garante; a realidade operacional e o CDC prevalecem sobre rótulos.
2. **Responsabilidade por terceiros:** selecionar e fiscalizar fornecedores proporcionalmente, criar trilhas de prova e seguro/garantias quando exigidos ou economicamente recomendados; cláusulas de regresso não afastam direitos do consumidor.
3. **Trabalhista:** revisar não só contrato, mas design do algoritmo, distribuição de tarefas, penalidades, autonomia efetiva, fiscalização e subordinação na prática.
4. **LGPD:** minimizar dados infantis e certidões; registrar hipóteses legais por finalidade, inclusive tratamento de crianças; não presumir que consentimento isolado resolve todos os tratamentos.
5. **Financeiro:** não custodiar recursos ou assumir serviços financeiros regulados sem enquadramento; revisar contrato com PSP e reconciliação, tributos e risco de chargeback.
6. **Consumidor:** preservar informação clara, canais de atendimento, arrependimento e garantias aplicáveis; não transferir indiscriminadamente deveres legais ao vendedor.
7. **Segurança:** exigir provas reais de eliminação, logs minimizados, segregação de acesso, incidentes e backups; CI sintético não prova operação real.
8. **Societário:** pessoa jurídica, CNPJ, contratos em nome da empresa, segregação patrimonial e contabilidade; nenhuma estrutura garante blindagem absoluta.

## 5. Processo de produção documental

**Lote 1:** inventário e confronto das minutas existentes com FC-JUR-01 a 50 e decisões; matriz de lacunas com links.  
**Lote 2:** consolidar LEG-01 a LEG-09, LEG-21, LEG-22, LEG-23 e LEG-27, com linguagem clara e anexos de operação.  
**Lote 3:** LEG-02, LEG-03, LEG-11, LEG-13 a LEG-19 e LEG-29, inventário de dados, bases legais e RIPD.  
**Lote 4:** LEG-10, LEG-12, LEG-20, LEG-24, LEG-28, instrumentos e modelos contratuais.  
**Lote 5:** LEG-25, LEG-26, LEG-30; checagem cruzada com interfaces, contratos, testes e evidências.  
**Lote 6:** revisão profissional especializada, ajustes, assinatura, versionamento, checklist de publicação e autorização de produção separada.

## 6. Campos externos ainda indispensáveis

Razão social, CNPJ, sede, endereço e canal de suporte; encarregado e canal LGPD; fornecedores e contratos reais; estrutura fiscal; responsável por operação e segurança; foro validado; data de vigência; seguro/risco; dados técnicos de infraestrutura. **Não preencher por suposição.**

## 7. Critério de encerramento

A cobertura documental somente alcança 100% após cada LEG-01 a LEG-30 possuir documento integral ou justificativa fundamentada de não aplicabilidade, consistência entre textos e operação, nenhum placeholder crítico, versão e evidência de revisão. A conformidade jurídica e o GO de produção exigem, adicionalmente, pareceres e provas independentes. A matriz geral de 70 requisitos não muda automaticamente.

**Restrições:** protótipo imutável; mudanças apenas em `platform/`; sem contratação, pagamento, deploy, publicação externa, credenciais ou ativação do piloto por este plano. Orquestração autônoma permanece futura.
