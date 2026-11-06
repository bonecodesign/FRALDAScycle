# Auditoria inicial de consolidação — 2026-11-06

## Escopo e limites
Inspeção remota de metadados do GitHub, diffs dos PRs #115 e #130, trechos da branch main e execuções de CI associadas aos heads consultados. Não é pentest, varredura integral do histórico, revisão de segredos do GitHub Actions nem homologação de produção. Nenhuma integração, pagamento, serviço externo ou deploy foi ativado. Protótipo original preservado.

## Achados
1. **Visibilidade pública**: `bonecodesign/FRALDAScycle` consta como `public`. Decidir se essa visibilidade é intencional; se não, restringir o acesso após avaliar colaboradores, forks e histórico. Tornar privado não revoga segredos anteriormente expostos.
2. **PR #115** (`codex/provider-live-activation-gates`): aberto, não mergeável, 16 commits, 10 arquivos. CI do head `467dcde6b54efa9394bc5ea0ba32c9d993618d67`: falha (Platform CI #1269). Introduz confirmações explícitas de ativação de pagamentos/logística, ainda ausentes no trecho verificado de `platform/apps/api/config.js` na main. Recomenda-se reimplementar em branch nova baseada na main, separar gates funcionais de mudanças incidentais em ferramentas de teste e exigir CI verde.
3. **PR #130** (`docs/central-controle-auditoria`): aberto, rascunho, não mergeável, 16 commits, 6 arquivos. CI do head `f8a2ba6d571341921f85292485d65c90065a1e8a`: sucesso (Platform CI #1360), porém desatualizado. Inclui testes RBAC baseados em papéis simples que precisam ser reavaliados à luz da autorização setorial integrada nos PRs #182–#188. Reaproveitar inventário documental e melhorias de tratamento de dados ausentes, sem mesclar diretamente.
4. **Pesquisa preliminar de segredos**: buscas por `BEGIN PRIVATE KEY` e `sk_live_` retornaram regex de detecção e fixtures sintéticas de testes. Não é evidência de ausência de credenciais reais; verificar histórico, Actions, artefatos e padrões adicionais em auditoria apropriada.
5. **Última integração confirmada**: PR #188, commit `86f3ade4138aefc54ad5a3f981a03ff26df8a13e`; CI do head aprovado antes do merge.

## Portões antes de merge
- Revisão de segurança dos novos diffs e ausência de alterações no protótipo.
- Testes unitários, integração, PostgreSQL e Platform CI aplicáveis concluídos com sucesso.
- Verificação de compatibilidade com autorização setorial atual.
- Garantia de `fail closed` e de que flags de ativação permaneçam desligadas por padrão.
- Nenhuma credencial real, contratação, publicação externa ou tráfego financeiro/logístico real.

## Decisões pendentes do responsável
1. Manter repositório público ou torná-lo privado? Recomendação: privado durante a preparação do piloto, após verificação de implicações.
2. Autorizar substituição técnica do PR #115 por PR novo, sem ativar fornecedores? Recomendação: sim.
3. Autorizar fechamento do PR #130 após reaproveitar documentação e testes compatíveis? Recomendação: sim, somente depois de nova entrega revisada.
4. Definir responsável e critérios de aprovação final para gates de produção e para revisão de segredos.
