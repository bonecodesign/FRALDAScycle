# Revisão das PRs abertas e da numeração de migrações — 08/11/2026

**Natureza:** auditoria técnica preparatória. Não constitui aprovação jurídica, consumerista, de privacidade, de segurança nem autorização de lançamento. Nenhum PR antigo foi integrado ou encerrado nesta revisão.

## PR #215 — P-01 retenção de certidões / P-02 retirada institucional

PR [#215](https://github.com/bonecodesign/FRALDAScycle/pull/215) permanece em **rascunho**. A revisão foi registrada na conversa da PR. O CI do head consultado estava verde, porém isso **não resolve**:

1. **Migração 133 duplicada.** A `main` já contém `database/migrations/133_account_closure_retention_classification.sql`; o rascunho acrescenta `133_courier_clearance_verification_retention.sql`. O migrador ordena por nome completo e guarda checksum por nome, não por versão. A numeração ambígua não é aceitável como nova convenção. Na `main` consultada, o maior prefixo era `142`; selecionar o próximo prefixo livre após nova conferência.
2. **P-01: incompatibilidade entre contrato e persistência.** O novo contrato exige ausência de referências de objeto e chave após retenção `deleted`. Entretanto a tabela criada em `060_courier_eligibility_foundation.sql` exige `encrypted_object_reference` e `encryption_key_reference` não nulos; `completeMaintenanceTask` marca `status='deleted'` sem zerar essas referências. Exigir prova de purga externa, migração de esquema compatível, leitura coerente e testes PostgreSQL do estado final.
3. **P-01: legados e prazo.** A proposta muda a contagem de `delete_at` para no máximo trinta dias após a verificação. Ainda é necessária a definição e execução segura para registros legados, sem estender prazos ou tratar metadados como prova de remoção do arquivo. O alcance da base legal e da retenção exige revisão humana de privacidade/jurídico.
4. **P-02: regra econômica sem prova de execução ponta a ponta.** O rascunho documenta retirada institucional direta sem frete, comissão logística, entregador ou cobrança. Antes de homologar, conferir APIs, estados financeiros e testes de doação/entrega para impedir cobrança indevida, preservando entrega intermediada em vendas e trocas.

**Decisão de engenharia:** não fazer merge da PR #215 até resolver os itens, revisar código, migrações, testes e obter os pareceres humanos aplicáveis.

## Atualização posterior — estado verificado em 08/11/2026

O diagnóstico acima documenta **a versão anterior** da PR #215, quando havia colisão da migração 133. **A colisão foi corrigida no draft**: a migração passou a ser `150_courier_clearance_verification_retention.sql`, sem reutilização de prefixo da `main` verificada. As [PRs auxiliares #219](https://github.com/bonecodesign/FRALDAScycle/pull/219) e [#220](https://github.com/bonecodesign/FRALDAScycle/pull/220) foram integradas **à branch da #215**, não à `main`.

A branch draft #215 foi sincronizada com a `main` `aa00998cdf7da431b9f065f3b7a60fa21ee2eeaa` e testada no head `c37509f4bf184b4bb0f153964a819fbebc4a596f`: [CI 42498979044](https://github.com/bonecodesign/FRALDAScycle/actions/runs/42498979044), 4/4 jobs verdes, 1.221 testes aprovados, zero falhas e 16 pulados. Os documentos [P-01/P-02 — prontidão técnica](p01-p02-technical-readiness-2026-11-08.md) e [pacote jurídico/privacidade](legal-privacy-review-packet.md) registram as evidências e os portões humanos restantes.

**O que mudou desde o diagnóstico original:** agora existem purga transacional sintética com atestação opaca e limpeza de ponteiros, validação dos legados sem inventar datas e testes PostgreSQL. **O que não mudou:** a PR #215 está em rascunho, sem merge na `main`; a exclusão externa real, a política de legados, a validação operacional P-02 e os pareceres jurídicos/de privacidade seguem pendentes. Piloto BH **NO-GO**.

## PRs históricos

| PR | Escopo original | Tratamento nesta rodada |
| --- | --- | --- |
| [#115](https://github.com/bonecodesign/FRALDAScycle/pull/115) | Reconhecimento de ativação explícita de fornecedores | Aberta, anterior aos controles posteriores de ativação; requer comparação de equivalência funcional com a `main` antes de qualquer decisão. |
| [#130](https://github.com/bonecodesign/FRALDAScycle/pull/130) | Consolidação do painel administrativo e auditoria | Aberta como rascunho; toca código e testes antigos. Requer reconciliação de alterações concorrentes com a `main`. |
| [#189](https://github.com/bonecodesign/FRALDAScycle/pull/189) | Auditoria documental dos PRs #115 e #130 | Aberta como rascunho; não transformar documento antigo em aprovação remota ou operacional. |

Não executar merge em massa ou fechamento automático de PRs antigos. Verificar sua necessidade, conflitos e eventual substituição técnica de forma individual.

## Salvaguarda de migrações preparada

`database/migrate.js` valida os prefixos numéricos antes da primeira transação SQL e rejeita colisões futuras. Permanecem permitidos **somente** os pares legados, cujos nomes exatos já existem no histórico:

- `044_monthly_pricing_listing_lifecycle.sql` e `044_notification_auth_token_binding.sql`;
- `061_child_profile_active_only_retention.sql` e `061_pilot_invitations.sql`.

A exceção não admite um terceiro arquivo com a mesma versão, nem alterações de checksum de migrações já aplicadas. Números escritos com zeros à esquerda são normalizados para impedir a reutilização disfarçada. A salvaguarda **não altera dados, não executa a migração P-01 e não transforma o CI em homologação de exclusão de documentos**.

## Portões permanentes

- Modificações exclusivamente em `platform/`; protótipo da raiz intocado.
- Quatro jobs verdes no commit exato de cada PR antes de considerar integração: `foundation`, `listing-postgres`, `containers` e `browser-postgres`.
- Revisão de privacidade, jurídico, segurança, produto e responsáveis humanos conforme o caso, sem autodeclarações de aceite.
- Piloto BH continua **NO-GO**; a preflight técnica permanece 19/21, com leitor de tela e aceite do responsável de rollback pendentes.
- Governança remota e CODEOWNERS reais ainda não homologados. Nenhum serviço pago, pagamento, credencial ou canal externo foi ativado.
