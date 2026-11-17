# FraldaCycle — estado consolidado e sincronização remota

**Referência: 17/11/2026.** Este documento registra a situação verificada no repositório remoto GitHub, não um deploy, aceite humano, parecer jurídico, certificação de acessibilidade ou operação de fornecedores.

## Fontes e escopo

- Código e histórico remoto: `bonecodesign/FRALDAScycle`; base da fotografia: commit `894049a4a16358c5f119fce0411bfed872facaa2` da `main` (merge #305).
- Fonte normativa de percentuais: [matriz oficial](requirements-matrix.json), `updatedAt=2026-11-17`. Nenhum requisito foi promovido por esta sincronização.
- Fonte normativa do piloto: [registro histórico de evidências](../config/pilot-evidence.v1.json), [classificação técnica vigente](../config/pilot-technical-preflight.v1.json) e [validador](../tools/pilot-technical-preflight.mjs).
- Quadro para continuidade: [codex-action-board.v1.json](../config/codex-action-board.v1.json), com trabalho dentro de `platform/`.

## Situação oficial (70 requisitos)

| Estado | Quantidade | Percentual |
| --- | ---: | ---: |
| Concluído | **48** | **68,57%** |
| Parcial | **11** | 15,71% |
| Bloqueado | **11** | 15,71% |
| Total | 70 | 100% |

**Piloto interno BH = NO-GO; produção = não autorizada.** Nenhum dos estados oficiais acima sobe por quantidade de PRs, documentação ou testes sintéticos.

## Atualização implementada na `main`

| PR | Entrega comprovada no código e CI | Limite da evidência |
| --- | --- | --- |
| [#300](https://github.com/bonecodesign/FRALDAScycle/pull/300) | Preflight deixa de contar falhas e itens não executados como aprovados | Registro histórico não foi reescrito nem pilotagem autorizada |
| [#301](https://github.com/bonecodesign/FRALDAScycle/pull/301) | Campo de preço sem valor fictício pré-preenchido; validação de quantidade e rótulo | Não comprova fornecedor de foto nem publicação completa |
| [#302](https://github.com/bonecodesign/FRALDAScycle/pull/302) | Regressões de recuperação, retentativa e idempotência no envio de anúncios | Testes sintéticos, sem pagamento/provedor real |
| [#303](https://github.com/bonecodesign/FRALDAScycle/pull/303) | Proteção de preços variáveis do vendedor e rótulos associados aos campos | Teste estrutural não substitui acessibilidade humana |
| [#304](https://github.com/bonecodesign/FRALDAScycle/pull/304) | Chromium com API/PostgreSQL locais, teclado, **32 cenários (8 etapas × 4 viewports)**, preço real do rascunho, busca negativa e chat bloqueado sem pagamento | **Não** executa publicação de ponta a ponta com foto homologada, leitor de tela humano nem dispositivo físico |
| [#305](https://github.com/bonecodesign/FRALDAScycle/pull/305) | Prévia financeira de venda (8%), frete (5%), troca (2,5% de cada participante + 5% por perna e diferença separada) e doação institucional sem monetização | Custo do processador desconhecido, sem liquidação ou repasse |

O CI das PRs [#304](https://github.com/bonecodesign/FRALDAScycle/actions/runs/44193763114) e [#305](https://github.com/bonecodesign/FRALDAScycle/actions/runs/44194841192) terminou com os **cinco** jobs obrigatórios aprovados: `foundation`, `wallet-postgres`, `listing-postgres`, `containers` e `browser-postgres`. São evidências de CI nas SHAs respectivas, não homologação de produção.

## Divergência documental resolvida nesta atualização

O preflight **vigente** contabiliza **16/21 evidências aprovadas**, com **cinco pendências**: `publish-search-negotiate`, `keyboard-check`, `device-matrix`, `screen-reader-check` e `rollback-owner`.

O manifesto original ainda registra **16 passed, 1 failed e 4 skipped**, conforme a rodada histórica. PRs novas corrigem componentes e ampliam regressões, mas **não alteram retroativamente** esses resultados. As referências antigas a **19/21 e duas pendências** foram ultrapassadas; não devem nortear decisões de lançamento.

A PR #304 fornece nova evidência técnica automatizada para navegador/teclado/viewports, porém **não encerra** o item composto `publish-search-negotiate`, a matriz real de dispositivos nem a observação por leitor de tela. Uma reexecução formal do roteiro com critérios, resultados e rastreabilidade deverá preceder qualquer reclassificação. Mesmo 21/21 técnico não autoriza lançamento sem portões externos e decisão humana.

## Cloud: o que foi e não foi sincronizado

**GitHub remoto** é o ambiente de nuvem efetivamente atualizado por PR/merge e pela documentação versionada. Esta sincronização se limita ao repositório e GitHub Actions. **Não houve deploy para hospedagem de produção, provisionamento de Hostinger/AWS/Google Cloud/Azure, ativação de Supabase para FraldaCycle, criação de bucket, alterações em servidores de produção nem migração/backup remoto.** Não presumir cloud de produção configurada.

O protótipo original da raiz é imutável: toda evolução permanece sob `platform/`. Não contratar, pagar, publicar externamente, registrar credenciais, executar transações reais, usar dados infantis reais nem ligar o piloto sem autorização expressa.

## Ordem de retomada do projeto

1. **Publicação e moderação realista (FC-41/67):** confirmar armazenamento/mídia e validação visual por fornecedor habilitado; reexecutar publicação, aprovação, busca e negociação com evidência controlada. Sem isso, a jornada E2E segue não homologada.
2. **Acessibilidade (FC-67):** realizar teste humano com leitor de tela e dispositivos físicos reais, registrar resultados em repositório **privado** e corrigir achados.
3. **Operação e segurança (FC-56/57/59):** designar titular e suplente do rollback, demonstrar restauração/recuperação e secret management em infraestrutura autorizada, realizar exercício supervisionado.
4. **Finanças e fornecedores (FC-02/03/10/12):** revisar contratos, tarifas, pagamentos, logística e reconciliação externa; processamento do produto é do vendedor, mas tarifa permanece desconhecida; item **12 em standby**.
5. **Jurídico/LGPD/instituições (FC-26–33/46/62):** concluir revisão humana dos instrumentos, direitos dos titulares, dados de crianças e representação institucional; CNPJ próprio a preencher futuramente, nunca inventado.
6. Manter a direção de **orquestração híbrida futura** como planejamento, não implementação imediata; decisões críticas com supervisão humana.

**Próxima ação técnica sem contratação:** preparar evidências e testes integrados adicionais para os bloqueios acima, sempre com CI de cinco jobs verde no commit exato. Não alterar a matriz sem prova individual de conclusão.
