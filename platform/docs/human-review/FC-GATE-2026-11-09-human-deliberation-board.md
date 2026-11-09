# FraldaCycle — pauta de deliberação humana FC-GATE (09/11/2026)

> **DOCUMENTO DE RECOMENDAÇÃO, NÃO DE APROVAÇÃO.** Os 21 gates do `config/cross-functional-decision-gates.v1.json` permanecem **`pending_human_review`**. Este documento não é parecer jurídico, contábil, técnico especializado, assinatura ou comprovação contratual. A matriz continua 42/70 (60%), o piloto BH segue **NO-GO**. Não alterar o protótipo, não habilitar perfis infantis, não ativar pagamentos, fornecedores ou atendimento externo.
>
> **Local do registro:** propostas em GitHub; atas identificadas, assinaturas, dados privados, contratos e provas sensíveis devem ficar **fora do repositório público**, com apenas referência opaca após validação real. `CNPJ próprio`, responsável titular, suplentes e canais contratuais permanecem em branco até comprovação.

## 1. Protocolo de decisão

- **Deliberação de fundador/produto**: pode confirmar direção estratégica, política interna pretendida, limites de risco e prioridade de desenvolvimento. Não substitui homologação contratual, parecer jurídico/LGPD, segurança, auditoria contábil ou teste humano.
- **Validação especializada**: cada gate deve ser avaliado por seus papéis exigidos no arquivo oficial. Identificar pessoas reais, escopo da revisão, versão, data, divergências, limites e evidências em sistema privado.
- **Homologação técnica e operacional**: requer testes, evidências de execução com escopo autorizado, revisão independente e decisão GO/NO-GO separada.
- **Estados deste documento**: todos são **PROPOSTA / AGUARDA DELIBERAÇÃO**. Não há aceite presumido por conversa, recomendação, CI ou merge de documentação.
- **Atualização do quadro oficial**: só após decisão rastreável, sem inserir nomes, identificadores pessoais ou pareceres confidenciais no GitHub público; mudanças revisadas por pessoa autorizada. Nada é automaticamente marcado concluído.

## 2. Pauta PRIV — privacidade e dados de crianças (7 gates)

### Decisão do fundador registrada — escopo do perfil infantil (09/11/2026)

- **Somente dois campos** no perfil infantil: `data de nascimento` e `emoji` de um conjunto de opções **predefinidas pela plataforma**, escolhido para distinguir perfis visualmente.
- O emoji **não é livre**: sem texto digitado, nomes, apelidos, imagem própria ou foto. A seleção do emoji não é identificador para terceiros.
- **Finalidades propostas:** a data de nascimento serve à faixa etária e à adequação da vitrine; o emoji distingue visualmente perfis **na área privada do responsável**. Não transmitir nenhum dos dois a anunciantes, entregadores, instituições ou parceiros de publicidade.
- Este é um **aceite de direção de produto**, não uma aprovação jurídica/LGPD ou autorização de ativação. `PRIV-01` e `PRIV-06` continuam `pending_human_review` no quadro oficial. A necessidade de guardar o dia exato, prazos de retenção, controles de acesso e bases legais continuam sujeitos a pareceres.
- Esta deliberação corrige a leitura anterior de que seria **apenas data de nascimento**: **o emoji predefinido também integra o perfil**.


| Gate | Encaminhamento recomendado à deliberação | Prova/parecer indispensável |
| --- | --- | --- |
| **PRIV-01** Necessidade e melhor interesse | **Decisão de produto confirmada pelo fundador (09/11/2026):** o perfil infantil terá **somente data de nascimento e um emoji escolhido entre opções predefinidas pelo FraldaCycle** para identificação visual do perfil. Não permitir nome, apelido, texto livre, imagem, foto, saúde, peso, gênero, documento nem localização infantil. Perfil opcional e desativado por padrão. Submeter a necessidade da **data completa** à avaliação de melhor interesse e minimização, sem alterar esta decisão de produto automaticamente. | Justificativa de finalidade por campo; análise de alternativas menos invasivas; avaliação de risco e melhor interesse; jurídico/privacidade/produto. |
| **PRIV-02** Base legal por finalidade | **Decisão interna do fundador (09/11/2026):** exigir consentimento **específico, informado, verificável, versionado e revogável** do responsável legal antes da criação do perfil infantil opcional (data de nascimento + emoji predefinido), sem condicionar o uso básico da plataforma a esse perfil. Registrar prova mínima do aceite e oferecer retirada e exclusão do perfil. **A definição não substitui a análise jurídica das hipóteses legais de cada finalidade** (conta do adulto, perfil, auditoria, notificações, marketing e incidentes); consentimento não deve ser presumido como base universal. Não iniciar tratamentos sem justificativa e controles revisados. | Parecer por finalidade e dado, com direitos e fundamento legal; jurídico/privacidade. |
| **PRIV-03** Poder do responsável e acesso excepcional | **Item 1 aprovado como diretriz interna pelo fundador em 09/11/2026:** somente o responsável autenticado pela própria conta poderá criar, modificar ou excluir perfis infantis vinculados àquela conta. **Item 2 aprovado como diretriz interna pelo fundador em 09/11/2026:** terceiros — incluindo outros usuários, anunciantes, entregadores e instituições — não terão acesso à data de nascimento nem ao emoji dos perfis infantis; o perfil é visível apenas no contexto privado da própria conta responsável. **Item 3 aprovado como diretriz interna:** acesso excepcional de suporte aos dados infantis somente com autorização humana, justificativa documentada, acesso mínimo necessário, duração limitada e auditoria; preferir resolver sem visualizar os dados. **Item 4 aprovado como diretriz interna pelo fundador em 09/11/2026:** contestações de responsabilidade legal serão examinadas por pessoa habilitada; qualquer restrição temporária dependerá de risco fundamentado e será proporcional e revisável; verificação com dados/documentos mínimos necessários, por canal seguro; decisão registrada e sujeita a revisão. **Item 5 aprovado como diretriz interna pelo fundador em 09/11/2026:** não exigir certidão de nascimento, CPF, RG, fotografia nem outros documentos infantis no cadastro habitual; somente data de nascimento e emoji predefinido. Eventuais verificações excepcionais de responsabilidade legal serão tratadas em procedimento separado, seguro e proporcional, sujeito a revisão jurídica/privacidade/segurança. A verificação proporcional de legitimidade, controles RBAC, auditoria e segurança continuam sujeitos a parecer humano. | Modelo de ameaça, papéis e permissões, teste de abuso/contestação; jurídico/privacidade/segurança. |
| **PRIV-04** Retenção, descarte e backups | **Item 1 deliberado pelo fundador em 09/11/2026 (diretriz interna):** permitir ao responsável excluir o perfil infantil a qualquer momento, remover data de nascimento e emoji dos registros ativos, ressalvadas retenções legalmente justificadas e segregadas; excluir o último perfil desativa automaticamente a personalização infantil, sem encerrar a conta principal. **Item 2 deliberado pelo fundador em 09/11/2026 (diretriz interna):** excluir os dados ativos após solicitação validada, estabelecer **até 30 dias** como prazo máximo proposto para expiração de backups contendo perfis excluídos, impedir reativação ou ressurgimento de perfis excluídos após restauração e restringir exceções legais a dados necessários, segregados e protegidos. O prazo é **meta de projeto**, ainda não validada tecnicamente ou juridicamente. **Itens seguintes pendentes:** prazos e critérios para os demais registros, inclusive consentimento e auditoria; prova de descarte e restauração segura. | Tabela de retenção/descarte, logs sintéticos de purge/restore, exceções justificadas; jurídico/privacidade/segurança. |
| **PRIV-05** Avisos e direitos | Telas simples, aceite específico versionado e retirável; informar finalidade e direitos; não condicionar utilização básica à criação de perfil infantil. Aprovação de textos finais somente após revisão. | Minutas finais, UX de correção/exclusão/contestação e trilhas de aceites; jurídico/produto/privacidade. |
| **PRIV-06** Parceiros e marketing | **Propor veto por padrão** ao uso de dados/perfis infantis para marketing, segmentação comportamental ou identificação por parceiros. Qualquer faixa etária destinada a parceiro deve ter necessidade documentada, mínimo técnico e revisão jurídica. Revisar explicitamente **Lei 15.211/2025 (ECA Digital)** e a aplicabilidade ao produto cujo cadastro é do adulto. | Parecer de alcance legal, testes de payload sem identificadores e contrato de minimização; jurídico/privacidade/produto. |
| **PRIV-07** Incidentes | Propor detecção, registro mínimo, congelamento de exposição, classificação de risco, escalonamento humano e comunicações legais após avaliação. Não afirmar que todo incidente exige notificação automática. | Plano de resposta, simulação sem dados reais, responsável e avaliação segundo Resolução ANPD 15/2024; privacidade/segurança/jurídico. |

**Referências normativas para revisão, sem dispensar parecer:** [LGPD/Enunciado CD-ANPD 1/2023](https://www.gov.br/anpd/pt-br/assuntos/noticias/anpd-divulga-enunciado-sobre-o-tratamento-de-dados-pessoais-de-criancas-e-adolescentes), [ECA Digital — ANPD](https://www.gov.br/anpd/pt-br/assuntos/noticias/eca-digital), [Lei 15.211/2025, art. 22](https://www2.camara.leg.br/legin/fed/lei/2025/lei-15211-17-setembro-2025-797997-normaatualizada-pl.html), [Comunicação de incidente ANPD](https://www.gov.br/anpd/pt-br/canais_atendimento/agente-de-tratamento/comunicado-de-incidente-de-seguranca-cis).

### Deliberação de fundador — PRIV-02 (09/11/2026)

**Diretriz interna aprovada em conversa:** cadastro de perfil infantil é **opcional**, exige aceite específico, informado e verificável do responsável legal; a retirada desse aceite deve ser possível, com exclusão do perfil sujeito às retenções legais cabíveis. O registro de aceite deve minimizar dados e preservar versão, finalidade e momento, sem divulgar dados de crianças em logs ou notificações.

**Escopo do aceite:** direção de produto para desenvolvimento e minuta, **não homologação do gate**. Jurídico e privacidade devem ainda determinar base(s) legal(is) por finalidade, forma proporcional de comprovar responsabilidade, fluxo de revogação e retenção de evidência. **PRIV-02 continua `pending_human_review` na matriz de gates; nenhum tratamento real foi autorizado.**

### Deliberações internas do fundador — PRIV-03, itens 1 a 5 (09/11/2026)

**Itens 1, 2, 3, 4 e 5 aprovados como diretrizes internas de produto:** o responsável autenticado poderá criar, alterar e excluir perfis infantis da própria conta. Nenhum terceiro externo — usuário, anunciante, entregador ou instituição — terá acesso à data de nascimento ou ao emoji. Excepcionalmente, membro habilitado do suporte poderá acessar somente os dados indispensáveis quando houver autorização humana prévia, justificativa, escopo e prazo limitados e registro auditável, preferindo solução sem leitura desses campos. A regra de produto não concede poderes sobre perfis de outras contas. A implementação deverá exigir autorização por conta e sessão, com testes negativos de acesso cruzado e não exposição dos dois campos em APIs, payloads, listagens, notificações e interfaces de terceiros.

**Item 4 aprovado pelo fundador (09/11/2026):** contestação de responsabilidade legal deve passar por análise humana; permitir restrição temporária de acesso **somente com risco fundamentado**, limitada ao necessário, com comprovação mínima em canal privado e seguro, decisão fundamentada, registro auditável e possibilidade de revisão. Nenhuma denúncia gera exclusão automática ou transferência automática do perfil.

**Item 5 aprovado pelo fundador (09/11/2026):** o cadastro habitual do perfil infantil não solicitará certidão de nascimento, CPF, RG, foto ou qualquer outro documento da criança. O perfil mantém apenas **data de nascimento + emoji escolhido entre opções predefinidas**. Eventual verificação excepcional de vínculo, quando necessária, é um fluxo separado e minimizado, sem transformar documentos infantis em campos habituais do perfil. **As cinco diretrizes internas de PRIV-03 estão deliberadas; a homologação do gate não está concedida.**

**O acesso excepcional do item 3 é uma regra proposta para implementação posterior, não uma autorização de acesso atual; seus critérios concretos exigem desenho de menor privilégio, revisão por segurança/privacidade e testes de abuso. Gate PRIV-03 permanece `pending_human_review`** até finalização da deliberação, revisão jurídica/privacidade/segurança e provas específicas. Não ativar perfis reais, não mudar matriz, flags ou código do produto com este registro.

### Deliberações do fundador — PRIV-04, itens 1 e 2 (09/11/2026)

**Aprovada como diretriz interna de produto — não como homologação jurídica ou técnica:**

1. O responsável autenticado pode solicitar a exclusão do perfil infantil vinculado à sua conta a qualquer momento.
2. Após o processamento de exclusão, remover **data de nascimento e emoji dos registros ativos**, com eventuais retenções legalmente justificadas segregadas e restritas; nenhuma retenção genérica ou indefinida fica autorizada por esta decisão.
3. Ao excluir o **último perfil infantil**, desativar automaticamente a personalização infantil.
4. **Preservar a conta principal** do responsável, sem obrigá-lo a realizar novo cadastro.

**Item 2 aprovado pelo fundador como diretriz interna:** exclusão dos dados ativos após solicitação válida e processamento técnico necessário; expiração de backups que contenham perfis infantis excluídos em **até 30 dias**; restauração condicionada a mecanismo que mantenha tais perfis excluídos (sem reativação por cópia antiga); retenções excepcionalmente exigidas por fundamento jurídico válido serão limitadas ao estritamente necessário, segregadas e com acesso restrito.

**Condições e provas ainda pendentes:** documentar horários/efeitos da exclusão, mecanismos de rotação de backups e bloqueio de reintrodução após restore, testes sintéticos de purga/restore, inventário de retenções por classe de dado, justificativa jurídica para exceções e testes sem dados reais de criança. **O prazo de 30 dias é meta aprovada de desenho, não SLA já homologado ou afirmação de que a infraestrutura atual o cumpre.** Isolamento de conta, permissão e ausência de exibição em caches/APIs/notificações continuam exigidos.

**Estado oficial inalterado:** `PRIV-04 = pending_human_review`, sem liberação de tratamento real, sem mudança na matriz de 70 requisitos, piloto BH **NO-GO**.

## 3. Pauta FIN — financeiramente viável sem assumir capacidade de provedor (7 gates)

| Gate | Encaminhamento recomendado à deliberação | Prova/parecer indispensável |
| --- | --- | --- |
| **FIN-01** Arranjo e responsabilidades | Manter plataforma intermediária sem autocustódia planejada, sujeito a confirmação de elegibilidade do split, KYC/onboarding e responsabilidades do provedor. Não anunciar proteção absoluta ou exoneração geral da plataforma. | Contratos e enquadramento por jurídico/financeiro. |
| **FIN-02** Tarifas e repasse | Manter regras internas propostas (8% venda, 2,5% por lado em troca, 5% frete, Premium R$ 14,90) como parâmetros, não margens líquidas garantidas. Tarifa desconhecida = **desconhecida**, nunca zero. | Proposta comercial vigente, calendário e regras de split, taxas/chargeback e análise contábil. |
| **FIN-03** Antifraude e webhooks | Propor idempotência, tolerância a reentrega/fora de ordem, autenticação de callback, segregação, tokenização externa, testes de cartões e Pix negativos. Não guardar credenciais no Git nem armazenar cartão. | Testes de segurança, contrato e sandbox **só após autorização distinta**. |
| **FIN-04** Disputas e estornos | Propor retenção/bloqueio prudente até condições contratuais de liberação; trilhas de entrega, contestação, estorno e chargeback; responsabilidades transparentes e direitos do consumidor preservados. | Parecer jurídico, contratos, fluxos por evento e simulações de conciliação. |
| **FIN-05** Frete e trocas | Preservar 5% sobre frete nas operações elegíveis e calcular pernas distintas da troca. **Item 12 continua standby**; não atribuir tarifa de processamento do frete sem decisão/contrato. Doação institucional nunca gera frete/cobrança da plataforma. | Cotação/contrato logístico, testes de conservação, exceções e decisão do item 12. |
| **FIN-06** CNPJ e tributos | **Manter CNPJ próprio em branco** e não presumir enquadramento, faturamento líquido, notas ou responsabilidade tributária. | Cadastro real em canal privado e parecer contábil-fiscal/jurídico. |
| **FIN-07** Continuidade e reconciliação | Recomendar conciliação diária, razão de diferenças, separação entre autorização/captura/liquidação/repasse, alertas de perdas, reserva de estorno calibrada e plano de saída. | Teste simulado, responsável/suplente identificados, tarifa e contrato real. |

**Referência:** `docs/approval-packets/02-financeiro-gateway-logistica.md`; Asaas/Lalamove são **candidatos à homologação**, não contratados.

## 4. Pauta OPS — operação, instituições e responsabilidade humana (7 gates)

| Gate | Encaminhamento recomendado à deliberação | Prova/parecer indispensável |
| --- | --- | --- |
| **OPS-01** Papéis e suplência | Propor funções mínimas de suporte, privacidade, segurança, financeiro, instituição e incidentes; uma pessoa pode acumular funções compatíveis **somente** após avaliar conflitos e capacidade; ações críticas exigem revisão independente. | Nomes e suplentes reais, aceites individuais e matriz RACI/RBAC privada. |
| **OPS-02** Instituições | Exigir verificação de identidade/autoridade de representantes, revalidação, revogação, capacidade efetiva e critérios verificáveis de aceite/recusa. Cadastro sozinho não autoriza recebimento. | Documentos mínimos em repositório privado, teste de permissões, jurídico/produto/operação. |
| **OPS-03** Doação e retirada | Confirmar decisão de produto existente: instituição organiza **retirada direta**, sem comissão, cobrança, frete, entregador ou repasse da plataforma. Protocolo de confirmação, disputa, extravio e ausência de seguro contratado. | Jornada testada, registro de retirada, exceções, parecer jurídico/operacional. |
| **OPS-04** Suporte e SLA | Não publicar canal ou promessa de 24/7 antes de capacidade humana real. Definir prioridade de risco, janela de funcionamento, tempos-alvo após teste de carga, resposta a denúncias e contingência. | Plano de atendimento, canal validado, escala e responsáveis reais. |
| **OPS-05** Sanções e incidentes | Propor gradação documentada, direito de contestação e reversão. Casos críticos, sanções irreversíveis e retomada de produção necessitam humano com autorização; registrar auditoria mínima. | Simulado com responsáveis designados e segregação de funções. |
| **OPS-06** Acessibilidade e piloto | Exigir ensaio humano de leitor de tela e de rollback, além de CI. Formalizar GO/NO-GO separado; as 19 de 21 evidências sintéticas citadas no pacote não bastam. | Aceite independente, testes e ata de liberação, inclusive condições jurídicas e operacionais. |
| **OPS-07** Operação enxuta | Propor modelo enxuto **sem prometer operação integralmente autônoma**; dimensionar filas e custos, limites de casos, plantões, gatilhos de pausa e escalonamento a pessoa. IA/automação seguem possibilidade futura, sem implementação. | Exercício de saturação, orçamento, responsável e substituto com aceite. |

## 5. Ordem recomendada de decisões

1. **Fundador — política de privacidade do produto:** a definição interna já explicitada para PRIV-01 é **data de nascimento + um único emoji de catálogo predefinido pela plataforma**, para identificação visual do perfil; nenhum nome, apelido, texto ou imagem enviada pelo usuário. Ainda é necessário examinar a proporcionalidade da data completa e a finalidade de uso, além de deliberar PRIV-06. Não operar com criança real.
2. **Fundador — modelo financeiro:** preservar comissões aprovadas sem confundi-las com tarifa contratual; decidir expressamente manter FIN-05/#12 standby.
3. **Fundador — limites operacionais:** confirmar retirada institucional direta, ausência de promessa 24/7, e pessoas como decisoras de situações críticas; revisar OPS-03/04/05/07.
4. **Revisores externos/reais:** colher pareceres e provas nos 21 portões; registrar objeções e mudanças; não usar modelo como signatário.
5. **Codex:** implementar somente alterações aprovadas e não externas, rodar provas técnicas e CI; atualizar matriz por requisito com evidência e decisão, nunca por número de PRs.

## 6. Registro a preencher somente após deliberação real

| Campo | Valor |
| --- | --- |
| Gate | **PENDENTE** |
| Versão da proposta revisada | **PENDENTE** |
| Decisão do fundador e justificativa | **PENDENTE** |
| Responsável técnico/jurídico/financeiro exigido | **A DESIGNAR** |
| Referência privada do parecer ou contrato | **PENDENTE** |
| Evidência de teste com escopo | **PENDENTE** |
| Risco residual aceito expressamente | **PENDENTE** |
| Autorização para produção | **NÃO CONCEDIDA** |
| Alteração de status da matriz | **NENHUMA** |

O documento foi criado para facilitar a **avaliação humana**, e não para converter a recomendação do assistente em aprovação humana fictícia.
