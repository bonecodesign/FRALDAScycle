# FC-LEGAL-AUDIT-001 — Auditoria jurídica cruzada inicial e plano de correção

**Data:** 09/11/2026. **Estado:** revisão interna preliminar, sem parecer profissional; PR #227 em rascunho; piloto NO-GO.

## Fontes efetivamente confrontadas
- `platform/docs/decisions/FC-DEC-2026-11-03-governanca-juridica-produto.md` (main, decisões 1–74, inclusive duplicação de número 74);
- `platform/docs/legal/rascunho-politicas-operacionais-v2.md` (main);
- `platform/docs/legal/FC-LEG-01-termos-gerais-v3-minuta.md` e `FC-LEG-02-politica-privacidade-v3-minuta.md` (branch);
- `platform/docs/legal/FC-LEGAL-MASTER-001-programa-juridico-integral.md` (branch);
- minutas FC-LEG-03 a FC-LEG-30 redigidas nesta branch, confronto preliminar de decisões centrais.

**Limite:** esta auditoria não inspecionou exaustivamente código, UX, contratos, PR #222, fornecedores nem testes de produção. As constatações abaixo são lacunas de redação e/ou prova, não afirmação de descumprimento real.

## Achados com rastreabilidade

| ID | Prioridade | Fonte da decisão | Documento afetado | Constatação / correção requerida |
|---|---|---|---|---|
| A-01 | Alta | Operacionais v2 §1 | LEG-01, LEG-04 | Limite de **3 anúncios ativos** e **3 unidades idênticas por anúncio comum / 5 Premium** não está explicitado no corpo das minutas. Inserir na versão consolidada e testar. |
| A-02 | Alta | Operacionais v2 §3 | LEG-01, LEG-09, LEG-20 | Ordem logística prevista **Lalamove quando contratada/disponível → outros homologados → entregador elegível**, sem retirada pelo comprador nem Correios no lançamento. Minutas atuais são genéricas; registrar regra com ressalva de contratação. |
| A-03 | Alta | Decisão 71 | LEG-06, LEG-20, LEG-24 | **Asaas** é verificador financeiro principal planejado; documentos usam apenas PSP genérico. Diferenciar fornecedor preferido de contrato/homologação efetivos e evitar presunção de serviço ativo. |
| A-04 | Alta | Decisão 73 | LEG-22, LEG-16, LEG-01 | Licença de conteúdo tem **sem limite territorial** e acesso restrito das partes por **7 dias corridos após conclusão**, com preservação em disputa; não está detalhado em LEG-22. |
| A-05 | Alta | Decisões 3, 7, 8, 14 | LEG-01, LEG-13, LEG-27 | Cadastro familiar inicia com perfil obrigatório; remoção manual do último perfil bloqueia operações dependentes; encerramento por idade aos 13 anos mantém relevância geral. Diferenciar explicitamente estados e exceções no UX. |
| A-06 | Alta | Decisões 15, 23 | LEG-17, LEG-13 | Exportação com senha + código por e-mail, preparação 24h, link 7 dias e limite de 1 pedido a cada 30 dias: cuidado para não restringir direitos legais de acesso e portabilidade. Rever regra de limitação com jurídico. |
| A-07 | Alta | Decisão 61 | LEG-13, LEG-15, LEG-27 | Decisão original admite RIPD completo durante piloto fechado, após avaliação preliminar; LEG-13 condiciona feature infantil a RIPD conforme risco antes da ativação. Definir fases de dados reais, melhor interesse e gate mais protetivo sem contradizer a decisão. |
| A-08 | Alta | Decisões 41–46 | LEG-10, LEG-11 | Certidão exigida como regra de produto, mas juridicamente condicionada à necessidade e proporcionalidade; sem parecer trabalhista/LGPD não tornar requisito de contratação ativo. Seguro específico de entregador ausente no piloto é risco alto. |
| A-09 | Média | Decisões 39–40 | LEG-09, LEG-16 | Foto de pacote na porta, evento, código e EXIF; prazos 30 dias após confirmação e 90 dias após decisão de disputa. Testar apagamento de objetos, CDN e backup; linguagem de prova não pode incentivar captura de terceiros. |
| A-10 | Média | Decisões 49–52 | LEG-08 | Confirmar preço R$ 14,90, cartão, carência 3 dias, aviso de reajuste 30 dias, máximo 1 destaque a cada 5; verificar UI e renovação, não apenas texto. |
| A-11 | Alta | Decisão 32 | LEG-05, LEG-12, LEG-24 | Documento fiscal eventual da instituição: a redação deve evitar afirmar que toda instituição é sempre responsável pela emissão sem enquadramento tributário concreto. |
| A-12 | Alta | Decisões 66–69 | LEG-25, LEG-30 | Aprovação final do fundador nível 5 após jurídico, privacidade, segurança e financeiro/contábil; travas críticas precisam de matriz de responsáveis e evidência verificável. |
| A-13 | Alta | Decisões 72, 74 | LEG-29, LEG-22 | Escalonamento de autoridade tem exceção específica para ordem judicial válida; retenção excepcional de conteúdo exige níveis 3, 4 e 5, renovação completa. Minutas não detalham todas as condições. |
| A-14 | Média | Decisões 34–40 | LEG-06, LEG-07, LEG-09 | Conferir fluxo de confirmação 48h, disputa suspende repasse, custo externo comprovado e ausência de débito definitivo automático por chargeback. Sem PSP e teste real, não homologar. |
| A-15 | Alta | MASTER §1 e §7 | Todos | Ter 30 arquivos não é cobertura substancial de 100%: campos societários e fornecedores faltam; contratos não assinados; RIPD não concluído; pareceres e provas ausentes. |
| A-16 | Média | Documento de decisões | Registro original | Número **74 aparece duas vezes** (retenção excepcional e hierarquia). Não alterar histórico sem autorização; citar decisões pelo assunto e normalizar em documento derivado. |
| A-17 | Alta | LGPD/CDC e produto | LEG-01, LEG-02, LEG-13, LEG-23 | Hipótese legal, minimização e melhor interesse para data infantil completa e uso em marketing precisam de parecer e prova. Não afirmar conformidade apenas por aceite. |

## Conclusões de revisão
- **30/30 minutas existentes**: indicador de existência documental, não completude substancial, aprovação ou operação.
- **Achados:** 17 pontos de confronto preliminar, incluindo regras omitidas, riscos de divergência e evidências ausentes.
- **Bloqueadores:** CNPJ e identidade empresarial, pareceres, contratos e PSP, segurança e exclusão reais, governança de dados infantis, regras trabalhistas e fiscais, telas/aceites, suporte, acessibilidade e decisão formal GO.
- **Não alterar a matriz geral de requisitos nem declarar CI verde** com base nesta revisão.

## Ordem de correção proposta
1. Harmonizar LEG-01, LEG-04, LEG-09, LEG-20, LEG-22 com limites de anúncios, logística, PSP preferido e conteúdo.
2. Harmonizar LEG-13, LEG-15, LEG-17, LEG-27 com cadastro familiar, exportação e gates de RIPD.
3. Harmonizar LEG-10, LEG-11, LEG-12, LEG-24, LEG-25, LEG-29 e LEG-30 com riscos, autoridade, tributos e aprovações.
4. Confrontar FC-JUR-01 a FC-JUR-50 no PR #222, documentos v2 restantes e interfaces reais; produzir matriz decisão → texto → tela → teste → evidência.
5. Obter revisão profissional, fornecedores e provas; manter **NO-GO** até conclusão.

**Restrições:** somente `platform/`, sem alterar protótipo, sem contratação, credenciais, deploy, cobrança real ou merge automático.


## Rodada 2 — harmonização textual executada em 09/11/2026

**Documentos ajustados nesta rodada:** LEG-10, LEG-11, LEG-13, LEG-15, LEG-17, LEG-25, LEG-29 e LEG-30. Os achados A-05, A-06, A-07, A-08, A-12 e A-13 receberam **tratamento documental preliminar**; não estão encerrados para homologação porque exigem revisão profissional, telas, contratos ou testes.

| Achado | Tratamento realizado | Evidência ainda necessária |
|---|---|---|
| A-05 | Diferenciados remoção manual do último perfil e encerramento automático aos 13 anos | Testes de UX, cadastro, vitrine e autorização |
| A-06 | Exportação reforçada e limite antifraude não impeditivo de direitos legais | Parecer LGPD e testes de solicitações sucessivas |
| A-07 | Separados piloto sintético, piloto restrito com dados reais e público geral; avaliação preliminar e RIPD conforme risco | Avaliação real, fundamento por finalidade e aprovação |
| A-08 | Auditoria de autonomia efetiva, certidão proporcional e risco securitário | Parecer trabalhista/LGPD e operação observável |
| A-12 | Sequência de aprovações e veto crítico documentados | Responsáveis nomeados e assinaturas |
| A-13 | Escalonamento de autoridades e retenção excepcional documentados | Validação jurídica e workflow auditável |

**Status honesto:** 30 minutas, 17 achados preliminares, correções textuais realizadas em 12 instrumentos ao longo das rodadas 1 e 2. Os achados continuam abertos até demonstração das evidências e aprovação competente. Não atualizar automaticamente a matriz geral de 70 requisitos.

## Próximo confronto obrigatório
Comparar integralmente FC-JUR-01 a FC-JUR-50 no PR #222, demais minutas v2, contratos e telas reais; validar cronogramas e requisitos da ANPD na data da publicação. Nenhuma ativação, contratação ou merge decorre desta auditoria.
