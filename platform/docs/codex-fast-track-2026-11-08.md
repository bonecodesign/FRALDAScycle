# Codex — fila executável, critérios de evidência e caminho para ampliar os 60%

**Data de referência:** 08/11/2026. **Fonte de estados:** `docs/requirements-matrix.json`. Este documento não aprova nem promove requisitos e não altera a autorização operacional. **Piloto BH NO-GO.**

## 1. Fotografia e objetivo

- Na última verificação, `main = f51e99be03adee9002ea3be5390ae4cdb8e53d31`; [PR #215](https://github.com/bonecodesign/FRALDAScycle/pull/215) **já integrada**, com trabalho P-01/P-02 na `main`. Portanto, textos antigos que digam que a PR #215 permanece draft são **históricos**.
- Matriz de 70: **42 concluídos (60,00%)**, 17 parciais e 11 bloqueados. **28 pendências reais**.
- Meta condicional de planejamento: **49/70 = 70,00%**; requer comprovação e aceite de **sete requisitos adicionais**, não sete PRs, nem sete testes, nem sete documentos.
- PRs em rascunho ao conferir: [#222 — FC-JUR-50](https://github.com/bonecodesign/FRALDAScycle/pull/222) e [#224 — passagem P-01/P-02](https://github.com/bonecodesign/FRALDAScycle/pull/224). Examinar head, diffs e conteúdo de cada uma antes de integrar. #222 contém referências históricas sobre #215 ainda não integrada; corrigir o estado antes de usar como fonte atual.
- `config/codex-action-board.v1.json` relaciona **todas as 28 pendências em oito trilhas**, com IDs, arquivos de teste existentes, tarefas que o Codex pode executar sem fornecedor, evidência de saída e bloqueios humanos/externos. O arquivo é um **quadro de execução**, não uma alteração da matriz oficial.

## 2. Entrada recomendada no Codex

Na raiz do repositório, sempre com uma branch nova a partir da `main` atual:

```bash
cd platform
node tools/requirements-matrix.mjs
node tools/codex-action-board.mjs
npm run check:production
node --test tests/codex-action-board.test.mjs
# Rodar os testes focados da trilha selecionada, sem credenciais reais.
# Após mudanças, validar o CI do PR nos quatro jobs obrigatórios.
```

**Critério inegociável:** só se altera `platform/`; não tocar em protótipo, arquivos da raiz, infraestrutura remunerada ou produção. Não contratar, publicar, ativar recursos sensíveis, enviar mensagens, criar pagamentos, acessar dados reais ou gravar credenciais. Não implementar agora orquestração operacional autônoma com ou sem IA.

## 3. Ordem que reduz retrabalho

**Rodada A — saneamento e seleção (Codex, sem fornecedores).** Comparar `main`, PRs #222/#224 e quadro; detectar documentos com status histórico; emitir um inventário de evidências para os oito grupos, incluindo resultados de testes, bloqueio residual e responsável **a designar**. Não alterar 42/70 por esse saneamento.

**Rodada B — execução técnica paralelizável (Codex).** Fazer PRs independentes e limitadas: (i) provas de privacidade e controle de dados familiares com a feature desativada; (ii) reversões e invariantes de pagamentos e fretes sem gateway; (iii) ensaios locais de restauração, segregação de credenciais e falhas de adaptadores; (iv) incidentes, suporte e auditoria de permissões; (v) jornada de doação, pré-validação do piloto e regressões de acessibilidade automatizáveis. Essas tarefas removem lacunas técnicas mas **não autorizam promover um item** se faltar evidência de fornecedor ou humana.

**Rodada C — portões transversais, dependentes de decisão.** Preparar um único pacote jurídico/LGPD para dados infantis, conta e termos; um pacote financeiro/contratual para gateway e logística; um pacote operacional para instituições, moderação, suporte e incidentes; um pacote de infraestrutura para backup, identidade, mensagens/OCR e seguro. Uma aprovação real desses portões pode destravar **vários requisitos**, mas nenhum deles deve ser considerado concluído antecipadamente. O item **12 é standby** e deve permanecer bloqueado até decisão expressa.

**Rodada D — promoção com prova individual.** Atualizar status somente quando o critério da própria linha for atingido, com URL/arquivo de teste, resultado, pessoa responsável, parecer aplicável e risco residual registrado. Recalcular a matriz apenas após a evidência; nunca usar número de PRs como percentual de conclusão.

## 4. Cartão obrigatório para cada tarefa Codex

| Campo | Exigência de saída |
|---|---|
| ID(s) e situação | IDs exatos, estado original no JSON, motivo de bloqueio |
| Tarefa técnica | Arquivos de `platform/` que serão lidos/alterados; efeito pretendido e limites |
| Testes | Comandos executados, resultados, SHA do commit e CI nos quatro jobs |
| Dependências | Provedor, jurídico/LGPD, operador, dispositivo ou aprovação, marcados `PENDENTE` quando ausentes |
| Evidência de conclusão | Prova correspondente à lacuna original, não apenas código local |
| Decisão | `permanece parcial/bloqueado` ou `proposto concluido para revisão humana`; jamais aprovação implícita |

**Não confundir:** prontidão técnica é diferente de prontidão operacional, revisão especializada e liberação do piloto.

## 5. Prompt curto para Codex

> Continue `bonecodesign/FRALDAScycle` a partir do HEAD atual da `main`. O protótipo é imutável e toda adaptação deve ocorrer apenas em `platform/`. Leia `platform/docs/codex-fast-track-2026-11-08.md`, `platform/config/codex-action-board.v1.json`, `platform/docs/requirements-matrix.json` e o handoff da PR #224 se já integrado. Confira as PRs #222/#224 em aberto e as decisões P-01/P-02 já integradas pela PR #215. Execute `node platform/tools/codex-action-board.mjs` e o validador da matriz, selecione a primeira tarefa técnica desbloqueada, crie branch e PR pequenos, acrescente regressões e aguarde os quatro jobs verdes antes de qualquer merge seguro. Não promova requisitos sem evidência individual e aprovação humana. Não contrate/provisione fornecedores, use credenciais, execute pagamentos ou lance o piloto BH; NO-GO. Entregue sumário de arquivos, testes, SHA, risco e próximo impedimento verificável. Não implemente a orquestração autônoma nesta etapa.

## 6. Como acompanhar evolução sem inflar a métrica

O validador `tools/codex-action-board.mjs` exige cobertura exata das pendências listadas pela matriz. Se um requisito for legitimamente concluído e o JSON oficial mudar, será necessário **reclassificar e atualizar explicitamente a fila** na mesma PR — nunca corrigir o validador para esconder divergência.

O próximo ganho percentual virá de requisitos com evidência técnica **e** portões externos resolvidos. O ganho imediato desta preparação é velocidade, rastreabilidade e menos retrabalho; nenhuma promoção de requisito ocorre apenas pela criação deste quadro.

## 7. Primeiro ciclo prioritário — três pacotes de decisão transversais (08/11/2026)

**Executar antes de iniciar novas implementações nessas frentes:**

1. [Privacidade dos dados infantis](approval-packets/01-privacidade-dados-infantis.md): direitos, minimização, melhor interesse, base legal, consentimentos, perfis, retenção e incidentes; exige revisão de privacidade/jurídico. Não ligar `CHILD_PROFILES_ENABLED`.
2. [Gateway, split e logística](approval-packets/02-financeiro-gateway-logistica.md): Asaas/Lalamove apenas **selecionados para futura homologação**, taxas e responsabilidades contratuais pendentes, item 12 segue standby. Não criar conta, cobrança ou cotação externa real.
3. [Suporte, instituições e incidentes](approval-packets/03-operacao-suporte-instituicoes.md): autoridade de representantes, doação institucional com retirada direta, SLA a definir, identidades reais e rollback humano do piloto. Não abrir canal externo nem pilotar clientes.

O arquivo [`config/cross-functional-decision-gates.v1.json`](../config/cross-functional-decision-gates.v1.json) contém **21 decisões ainda sujeitas a avaliação humana** e associa **22 dos 28 requisitos pendentes** a essas três frentes. Os outros seis IDs (41, 49, 57, 59, 60 e 61) permanecem na [fila original](../config/codex-action-board.v1.json), sem serem perdidos ou promovidos.

Na raiz do repositório, executar:

```bash
node platform/tools/requirements-matrix.mjs
node platform/tools/codex-action-board.mjs
node platform/tools/cross-functional-decision-gates.mjs
node --test platform/tests/cross-functional-decision-gates.test.mjs
```

A ferramenta **falha por segurança** se faltar algum requisito, aparecer uma aprovação fictícia, a matriz oficial mudar sem atualização explícita, ou qualquer pacote pretender liberar fornecedores, pagamento, dados pessoais reais ou piloto. Ela não assina pareceres: **zero aprovações foram registradas**.

**Sequência Codex recomendada:** gerar evidência técnica sintética para PRIV, FIN e OPS em PRs separadas; produzir checklist de dúvidas para revisores, manter nomes/assinaturas/CNPJ e contatos não comprovados em branco, e não promover requisito até pareceres verdadeiros e homologação apropriada. Reavaliar a meta de sete conclusões adicionais **apenas após** evidências individuais.
