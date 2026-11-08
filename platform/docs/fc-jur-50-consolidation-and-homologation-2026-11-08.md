# FC-JUR-01 a FC-JUR-50 — Consolidação e plano de homologação (08/11/2026)

> **Status: APROVAÇÕES INTERNAS CONDICIONAIS.** Esta nota registra a conclusão da fase de elaboração e **não** certifica revisão profissional, conformidade LGPD, contratação, prontidão de produção ou autorização de lançamento. Piloto BH: **NO-GO**.

## Controle documental

- A sequência FC-JUR-01 a FC-JUR-50 foi declarada concluída para **elaboração** pelo fundador em conversa de governança. Esta declaração **não** prova que cada minuta esteja versionada individualmente neste repositório.
- FC-JUR-37 a FC-JUR-50: aprovações internas sujeitas às revisões especializadas indicadas em cada minuta; não converter aprovação interna em parecer jurídico ou aceite técnico.
- **Antes de homologar:** localizar as 50 versões integrais, atribuir identificador de versão, responsável, revisão, data, evidências e referência de decisão; apontar documentos ausentes. Não inferir completude documental.
- FC-JUR-50: portões de homologação jurídica, consumerista, privacidade, segurança, financeira/contábil, infraestrutura, produto, acessibilidade, suporte, operação e governança. Autorizações reais exigem decisão formal e rastreável.

## Matriz de 28 pendências — fotografia de 08/11/2026

| Frente | Requisitos | Estado e encaminhamento |
| --- | --- | --- |
| Financeiro e logística | 2, 3, 9, 10, 11, 12, 17, 18 | Revisão de regras, provedor financeiro, comissões, frete, trocas e retirada institucional; separar fluxos P-02 |
| Dados infantis e perfis | 26, 27, 28, 31, 32, 33 | Bloqueios de base legal, minimização, perfis, múltiplas crianças, correção e exclusão; exigir avaliação de privacidade |
| Anúncios, sanções e termos | 41, 42, 45, 46 | Revisar canais externos, fraude/moderação, direitos de exclusão e aceite de mudanças |
| Comunicação, suporte e infraestrutura | 49, 50, 51, 56, 57, 59, 60 | Fornecedores reais, canais de suporte, resposta a incidentes, backup, credenciais e saída contratual |
| Garantias, instituições e piloto | 61, 62, 67 | Validar ausência de promessa de seguro, instituição habilitada, acessibilidade, responsáveis humanos e gates do piloto |

**Total:** 17 requisitos parciais e 11 bloqueados. O estado oficial continua sendo o do arquivo `docs/requirements-matrix.json`; esta nota não altera seus status.

## P-01 / P-02 — evidência técnica e portões de integração

- PR [#218](https://github.com/bonecodesign/FRALDAScycle/pull/218) incorporada à `main` no commit `aa00998cdf7da431b9f065f3b7a60fa21ee2eeaa`.
- PR [#219](https://github.com/bonecodesign/FRALDAScycle/pull/219) e [#220](https://github.com/bonecodesign/FRALDAScycle/pull/220) incorporadas **somente** à branch draft da PR [#215](https://github.com/bonecodesign/FRALDAScycle/pull/215).
- Head da #215 verificado: `c37509f4bf184b4bb0f153964a819fbebc4a596f`. [CI 42498979044](https://github.com/bonecodesign/FRALDAScycle/actions/runs/42498979044): quatro jobs verdes (`foundation`, `listing-postgres`, `containers`, `browser-postgres`); 1.221 testes aprovados, zero falhas, 16 pulados.
- Logs do `foundation` confirmaram: migração e purga sintética P-01 em PostgreSQL; preflight de legados; rejeição de frete, pagamento e repasse em doações institucionais P-02.
- A `main` avançou posteriormente pelo commit `fb195d605dbb1b1e77359201046e09ac895e3b28` (PR #221, documentação). A branch #215 ficou **um commit atrás**; sincronizar e repetir o CI no novo head antes de considerar merge.
- Em 08/11/2026, **zero revisões formais** registradas na #215. Não efetuar merge sem revisão humana requerida, verificação de regras de proteção, testes atuais e resolução dos apontamentos.
- Evidência sintética não comprova exclusão física no armazenamento real. P-01 requer revisão jurídica/privacidade, tratamento de legados, prova de purga externa e política de backup. P-02 requer revisão consumerista/produto/financeira e confirmação operacional da retirada direta.

## Portões e responsáveis a designar

1. **Engenharia/DBA:** revisar migração 150, claims, idempotência, dados legados, transações e compatibilidade com `main`; anexar logs PostgreSQL e CI do head final.
2. **Segurança/Privacidade/Jurídico:** revisar fundamento da certidão, minimização, retenção, prova real de exclusão, auditoria e backups; assinar pareceres.
3. **Produto/Consumerista/Financeiro:** validar doação institucional sem frete, comissão, entregador da plataforma, pagamento ou repasse; preservar frete de venda/troca.
4. **Infraestrutura/Operação:** homologar fornecedor e adaptação de armazenamento, procedimentos de falha, monitoramento, suporte e reversão.
5. **Governança:** registrar responsáveis identificados, revisões formais, status de proteção de branch e decisão de GO/NO-GO.

## Ordem de execução

1. Reconciliar PR #215 com `main` e verificar o diff; manter draft enquanto faltar aprovação.
2. Executar e documentar os quatro jobs de CI e testes PostgreSQL no head resultante.
3. Obter revisões formais e pareceres especializados; corrigir apontamentos e repetir testes quando houver mudança.
4. Somente então avaliar merge seguro da #215; não realizar merge por inferência de CI verde.
5. Consolidar as 50 minutas e evidências; auditar cada uma das 28 pendências sem promoção automática.
6. Submeter piloto BH a autorização formal separada. **NO-GO** até todos os portões obrigatórios.

Referências: [prontidão P-01/P-02](p01-p02-technical-readiness-2026-11-08.md), [pacote jurídico/privacidade](legal-privacy-review-packet.md), [auditoria das PRs](open-pr-governance-review-2026-11-08.md), [decisões de governança](decisions/FC-DEC-2026-11-03-governanca-juridica-produto.md).
