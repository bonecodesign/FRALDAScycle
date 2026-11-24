# FC-356 — Reavaliação diferencial dos 22 requisitos ainda não concluídos

**Projeto único:** FraldaCycle (`bonecodesign/FRALDAScycle`).
**Data da revisão:** 23/11/2026 (horário de Brasília).
**Fonte de verdade:** `platform/docs/requirements-matrix.json` na `main`; fotografia anterior em 17/11/2026.
**Finalidade:** demonstrar o avanço técnico **sem converter CI em homologação externa, parecer jurídico ou liberação comercial**.

## Resultado conferido

| Estado da matriz | Quantidade |
| --- | ---: |
| `concluido` | 48 |
| `parcial` | 11 |
| `bloqueado` | 11 |
| **Total** | **70** |
| **Ainda não `concluido`** | **22** |

A taxa oficial continua **48/70 = 68,57%**. Esse indicador é binário por requisito e, sozinho, **não mede o trabalho técnico executado dentro dos itens parciais ou bloqueados**. É incorreto transformar 5/5 testes de CI em mais um requisito concluído sem vencer seu critério de aceitação integral.

O piloto BH mantém a última fotografia verificada de **16/21 evidências técnicas**, com cinco pendências; o lançamento permanece **NO-GO**. Essas 21 evidências são outra contagem, não se confundem com os 70 requisitos.

## Avanços integrados após a fotografia de 17/11

Todos os PRs públicos abaixo foram integrados à `main` após **5/5 jobs de CI aprovados** na SHA de cada PR; CI prova testes, não execução de produção:

| PR | Frente | Evidência nova | Não foi comprovado |
| --- | --- | --- | --- |
| [#347](https://github.com/bonecodesign/FRALDAScycle/pull/347) | Backup / menor privilégio | Intenção de OAuth **App Folder**, caminho virtual isolado e validações sintéticas | Tipo/escopos OAuth efetivos e destino off-site com retenção real |
| [#348](https://github.com/bonecodesign/FRALDAScycle/pull/348) | Recuperação | `pg_dump`, AES-256-GCM e `pg_restore` **reais entre PostgreSQL 17 fictícios isolados** | Recuperação de banco hospedado, Auth/Storage, roles/grants e RPO/RTO |
| [#349](https://github.com/bonecodesign/FRALDAScycle/pull/349) | Recuperação / RLS | Política RLS sintética restaurada e bloqueando acesso restrito | Políticas, usuários e grants reais integralmente recuperados |
| [#350](https://github.com/bonecodesign/FRALDAScycle/pull/350) | Financeiro | 11 cenários adicionais de negação de repasse sem prova confiável | Tarifa/contrato, split e conciliação externa |
| [#351](https://github.com/bonecodesign/FRALDAScycle/pull/351) | Doações institucionais | Bloqueio por prova ausente, inválida ou com relógio incoerente | Instituição habilitada e retirada física real |
| [#352](https://github.com/bonecodesign/FRALDAScycle/pull/352) | Suporte | Contagem e página de tickets vencidos no mesmo snapshot SQL | Equipe/plantão, contato externo e SLA real |
| [#353](https://github.com/bonecodesign/FRALDAScycle/pull/353) | Dados infantis | Consentimento vigente e idade válida antes de derivar sinal | Autorização jurídica para coleta/ativação |
| [#354](https://github.com/bonecodesign/FRALDAScycle/pull/354) | Marketing / dados infantis | Aliases PT/EN bloqueados em metadados aninhados; payloads malformados recusados | Fornecedor de marketing homologado e revisão de todos os dados livres |

**Nota de transparência:** no PR #353, o job `browser-postgres` falhou numa primeira tentativa de navegação sintética e passou no rerun. O workflow completo terminou verde antes do merge. O PR #333 (inventário de possíveis resíduos históricos infantis) permanece **aberto e não integrado**, por depender de revisão de segurança; nenhuma consulta/purga de dados reais foi realizada por estes PRs.

## Os 22 requisitos, classificados sem recontagem artificial

| IDs e frente | Estado oficial | Avanço técnico comprovado ou preservado | O que impede promoção |
| --- | --- | --- | --- |
| **2, 3, 10, 12** — comissão logística, processamento produto, diferença de troca, processamento frete | 2 parciais; 2 bloqueados | Simulações financeiras, bloqueio de divergência, idempotência, checkout e reconciliação local; FC-351 ampliou casos negativos | Contratos, tarifas, gateway, split/estorno/repasses reais e decisão específica de tirar **12 do standby** |
| **26, 27, 28, 31, 32, 33** — dados/perfis infantis | 6 bloqueados | Perfis múltiplos, consentimento versionado, correção/remoção, exigência atrás de feature flag, idade válida, minimização e metadados externos barrados | Parecer jurídico/de privacidade sobre melhor interesse, hipóteses legais, retenção e direitos; homologação e ativação humana explícita |
| **41** — contatos em anúncios | Parcial | Texto e contrato de moderação de imagem com recusa segura preparados | OCR/QR/mídia reais, fornecedores homologados e revisão de falsos negativos |
| **45, 46** — exclusão de conta e termos | 1 parcial; 1 bloqueado | Fluxos e provas sintéticas de retenção, inventário, aceites versionados | Parecer por classe de dado, purga efetiva e termos finais assinados/comunicação real |
| **49, 51, 56** — avisos, suporte externo e incidentes | 2 parciais; 1 bloqueado | Fila interna, triagem, governança escalonada de suporte e incidentes, FC-353 consistentemente read-only | Canais externos, contas/provedores, pessoas nomeadas, plantão, ensaio de incidente e SLA comprovado |
| **57, 59, 60, 61** — backup, credenciais, saída de fornecedor, seguro | 3 parciais; 1 bloqueado | Backup e restauração criptografada **sintética**, RLS, menor privilégio e planejamento de segredos/saída | Conexão hospedada verificada, App Folder real, cofre, off-site/WORM, recuperação hospedada isolada, contrato de fornecedor e apólice efetiva |
| **62** — instituições aprovadas | Parcial | Verificação de papéis, suspensão e recibo institucional fail-closed | Instituições/representantes e capacidade física verificados por pessoas reais |
| **67** — piloto BH | Parcial | Fluxos locais e ensaios HTTP/PostgreSQL/Chromium; última prova **16/21** | Cinco evidências técnicas remanescentes, testes humanos/dispositivos, fornecedores, segurança externa e aprovação formal de GO |

Conferência aritmética da tabela: **11 parciais, 11 bloqueados, 22 ainda não concluídos**.

## O que mudou de verdade na interpretação

1. **Não são 22 módulos ausentes.** Parte substancial do trabalho de implementação já existe; várias pendências são de contratação, prova ambiental, pessoas e decisão jurídica.
2. **Não são 22 portas já abertas.** Um fluxo sintético aprovado não garante que um comprador, instituição ou entregador real possa usar o serviço com segurança.
3. **Supabase-BR não deve ser confundido com homologação total.** O último registro da issue #339 confirma banco hospedado saudável e proteções RLS, mas não prova TLS do cliente da API, backup off-site real, restauração integral, imutabilidade ou objetivos RPO ≤60min e RTO ≤240min. Sem ativação comercial.
4. **A documentação deve refletir progresso incremental.** Os oito requisitos 2, 10, 26, 28, 51, 57, 59 e 62 receberam referências de evidência posteriores à fotografia de 17/11. **Todos mantiveram os estados anteriores.**
5. **PR #333 segue condicionado.** Nenhum merge ou busca em banco hospedado é substituído por este relatório.

## Ordem de ações restantes sem retrabalho

**Agora, sem custos ou credenciais:** preservar testes verdes, revisar riscos residuais por família e anexar evidências objetivas à matriz; concluir apenas incrementos técnicos realmente descobertos.

**Exige autorização/prestador/parecer:** revisão jurídica PRIV-01…07; condições reais de Asaas/Lalamove e tarifa de frete; backup e cofre com verificação E1…E6; canal e escala humanos; instituições e OCR reais; políticas/seguros; ensaio em dispositivos e decisão formal do piloto.

## Regra de atualização

Não marcar requisito como `concluido` por contagem de commits, CI, documentação ou promessas do fornecedor. Promover somente quando **todas** as condições do requisito estiverem evidenciadas e os portões humanos pertinentes efetivamente aprovados. Até lá: **48/70 e NO-GO**.

Fontes internas: `docs/requirements-matrix.json`, `config/codex-action-board.v1.json`, `config/cross-functional-decision-gates.v1.json` e issues públicas [#229](https://github.com/bonecodesign/FRALDAScycle/issues/229), [#230](https://github.com/bonecodesign/FRALDAScycle/issues/230), [#231](https://github.com/bonecodesign/FRALDAScycle/issues/231) e [#339](https://github.com/bonecodesign/FRALDAScycle/issues/339).
