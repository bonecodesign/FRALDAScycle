# FC-LEGAL-AUDIT-002 — Rastreabilidade FC-JUR, 28 pendências e matriz de evidências

**Data:** 09/11/2026. **Estado:** auditoria documental interna, não parecer; PR #227 draft; piloto NO-GO.

## 1. Limite documental confirmado
O diff consultado da **PR #222** contém **um único arquivo**: `platform/docs/fc-jur-50-consolidation-and-homologation-2026-11-08.md`. Ele registra aprovações internas condicionais de FC-JUR-01 a FC-JUR-50, mas afirma expressamente que **não comprova a existência de 50 minutas individualmente versionadas**. Logo, não é possível auditar cláusula a cláusula cada FC-JUR a partir desse registro. Localizar versões integrais é requisito de evidência **aberto**.

As 30 minutas FC-LEG da PR #227 representam um conjunto **distinto**, não substituem automaticamente as 50 FC-JUR. Não inferir equivalência 1:1.

## 2. Mapa de 28 requisitos conforme consolidação da PR #222
| Grupo | IDs oficiais na consolidação | Contagem | FC-LEG a confrontar | Evidência ainda faltante |
|---|---|---:|---|---|
| Financeiro e logística | 2, 3, 9, 10, 11, 12, 17, 18 | 8 | LEG-06, 07, 09, 12, 20, 24, 27 | PSP, split, conciliação, parceiro, retirada institucional, testes P-02 |
| Dados infantis e perfis | 26, 27, 28, 31, 32, 33 | 6 | LEG-02, 13, 14, 15, 16, 17, 18, 19 | Bases legais, RIPD, prova de expurgo, backups, acesso |
| Anúncios, sanções e termos | 41, 42, 45, 46 | 4 | LEG-01, 04, 21, 22, 25 | Fluxos, notificações, recursos, versionamento de aceite |
| Comunicação, suporte e infraestrutura | 49, 50, 51, 56, 57, 59, 60 | 7 | LEG-03, 18, 19, 21, 23, 25, 30 | Fornecedores, canais, resposta, credenciais, reversão |
| Garantias, instituições e piloto | 61, 62, 67 | 3 | LEG-05, 10, 12, 26, 27, 28, 30 | Seguro, adesão institucional, acessibilidade, GO |
| **Total** | | **28** | | |

**Distribuição informada pela PR #222:** 17 parciais e 11 bloqueados. A consolidação não especifica nesta tabela quais IDs são parciais versus bloqueados; **não atribuir status individual por suposição**. O estado oficial permanece em `platform/docs/requirements-matrix.json`, a verificar separadamente.

## 3. Dependências técnicas apontadas na PR #222
- **P-01:** exclusão de certidões e dados, migração PostgreSQL, tratamento de legados, backups, armazenamento externo, segurança e prova de purga real.
- **P-02:** doações institucionais sem pagamento, frete, comissão, entregador da plataforma ou repasse; comprovar por fluxo e testes.
- PR #215: consolidação relata CI histórico de 08/11/2026, mas isso **não prova CI atual nem homologação**. Não fazer merge sem revisar head, proteção, testes e pareceres.

## 4. Matriz decisão → documento → interface → teste → parecer
| ID | Decisão / obrigação | Minuta | Interface/serviço a verificar | Evidência técnica exigida | Validação |
|---|---|---|---|---|---|
| E-01 | Cadastro infantil mínimo e estados de perfil | LEG-01, 02, 13, 15 | Cadastro, remoção, expiração 13 anos, vitrine | Testes de fluxo, acesso, backup, RIPD | LGPD + segurança |
| E-02 | Exportação e exercício de direitos | LEG-02, 17 | Exportação autenticada, suporte | Pedidos repetidos, arquivo, expiração, logs | LGPD |
| E-03 | Certidão e autonomia de entregadores | LEG-10, 11, 16 | Elegibilidade, distribuição, recursos | Purga 30 dias da verificação, recusa sem punição | Trabalhista + LGPD |
| E-04 | Pagamento protegido e repasse | LEG-06, 07, 20, 24 | Checkout, PSP, conciliação | Contrato, testes split, estorno e chargeback | Financeiro + jurídico |
| E-05 | Doação direta institucional | LEG-05, 12, 27 | Doação, instituição, retirada | Bloqueios P-02, homologação institucional | Consumerista + operação |
| E-06 | Logística e confirmação | LEG-09, 20, 28 | Entrega, prova, disputa, repasse | Evento, EXIF, 48h, foto, disputa | Segurança + jurídico |
| E-07 | Premium e destaque | LEG-08, 23 | Aceite, renovação, cancelamento, busca | Opt-in, preço, 1 destaque/5, recibos | Consumerista + financeiro |
| E-08 | Publicação e direitos | LEG-21, 22, 25 | Moderação, recursos, conteúdo | CDN 24h, acesso restrito 7d, auditoria | Jurídico + segurança |
| E-09 | Incidentes e operadores | LEG-14, 18, 19, 29 | Logs, alertas, solicitações | Simulado, DPA, escalonamento | LGPD + segurança |
| E-10 | Piloto e autorização | LEG-25, 26, 27, 28, 30 | Ambiente, acessibilidade, rollback | Pareceres, contratos, testes, decisão formal | Áreas + fundador |

## 5. Evidências e status
Os itens E-01 a E-10 têm **mapeamento documental inicial**; status de implementação, teste e parecer: **NÃO VERIFICADO / PENDENTE**. A tabela não constitui prova de que interfaces ou controles existam. Cada linha deve receber link permanente para arquivo, commit, teste, contrato, parecer, responsável e data antes de mudança de status.

## 6. Plano de próxima verificação
1. Ler `platform/docs/requirements-matrix.json` na branch relevante e extrair estado individual dos 28 IDs.
2. Inspecionar documentos `legal-privacy-review-packet.md`, `p01-p02-technical-readiness-2026-11-08.md` e decisões correlatas; apontar conflitos concretos.
3. Localizar os textos integrais FC-JUR-01 a 50, se existirem; marcar os ausentes explicitamente.
4. Conferir telas/código, testes e CI do head atual; não extrapolar evidência sintética.
5. Obter pareceres e assinaturas de responsáveis antes de GO.

**Restrições:** sem merge, alteração do protótipo, contratação, ativação financeira, credenciais ou publicação.


## 7. Conferência individual com a matriz oficial em `main` (09/11/2026)

**Fonte consultada:** `platform/docs/requirements-matrix.json`, campo `updatedAt: 2026-11-07`, denominador 70. Esta é uma leitura do estado registrado, não execução de testes. A divisão dos 28 IDs confirma **17 parciais e 11 bloqueados**:

| Grupo | Parciais | Bloqueados |
|---|---|---|
| Financeiro/logística | 2, 9, 10, 11, 17, 18 | 3, 12 |
| Infantil/perfis | nenhum | 26, 27, 28, 31, 32, 33 |
| Anúncios/termos | 41, 42, 45 | 46 |
| Comunicação/infra | 49, 50, 56, 57, 59 | 51, 60 |
| Garantias/instituições/piloto | 61, 62, 67 | nenhum |

**Títulos oficiais dos bloqueados:** 3 Processamento do produto; 12 Processamento do frete; 26 Dados do bebê; 27 Obrigatoriedade do dado infantil; 28 Parceiros e idade; 31 Perfis distintos; 32 Mais de um bebê; 33 Correção/remoção de datas; 46 Mudanças nos termos; 51 Suporte externo; 60 Saída de fornecedor.

**Fotografia geral registrada no runbook técnico:** 42 concluídos, 17 parciais, 11 bloqueados, 70 itens (60% tecnicamente concluídos no escopo da matriz). O percentual não mede conformidade jurídica ou prontidão de produção.

## 8. Confronto complementar do pacote de revisão
`platform/docs/legal-privacy-review-packet.md` acrescenta questões específicas ainda não resolvidas:
- Titularidade efetiva do cartão não pode ser comprovada somente por comparação de CPF (LEG-06, 08, 20).
- Geocodificação, cache, Google Maps, ranking por distância e termos de fornecedores exigem revisão (LEG-02, 03, 19, 20).
- Prova de vida e recuperação excepcional de conta exigem finalidade, retenção e proteção adequadas (LEG-02, 14, 16).
- Preferências de cookies locais versus preferências de conta e medição de abertura/cliques exigem teste e fundamento (LEG-03, 23).
- Legados de certidões sem data de decisão histórica não podem receber prazo presumido; migração P-01 falha por segurança e exige deliberação humana.

**Nota de controle:** `p01-p02-technical-readiness-2026-11-08.md` comprova testes **históricos** e sintéticos na PR #215; não comprova estado atual do CI, exclusão real no provedor ou revisão profissional. Não alterar estados oficiais por causa deste relatório.
