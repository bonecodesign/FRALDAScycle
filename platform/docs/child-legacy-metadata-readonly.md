# FC-PRIV — verificacao restrita de residuos historicos de perfil infantil

**Status:** roteiro tecnico adicional preparado; **nenhuma consulta hospedada executada** por esta entrega. O projeto e os perfis infantis permanecem inativos para dados reais. O portao PRIV-01…PRIV-07, os requisitos 26/27/28/31/32/33 e o piloto nao mudam de status.

## Por que existe este pequeno incremento

A auditoria `docs/child-profile-dataflow-audit-2026-11-09.md` e os testes existentes ja demonstram que **novos** eventos de criacao de perfil e notificacoes de ciclo etario nao devem carregar nascimento/emoji. Nao repetir essa implementacao.

A lacuna distinta e documentada: eventos **anteriores** a essas correcoes podem permanecer em `audit_events`, `notification_outbox` e `account_notices`. A mitigacao na saida de uma notificacao nao remove seu registro antigo. O objetivo aqui e preparar uma contagem privada desses possiveis residuos, **sem abrir, imprimir, exportar ou alterar dados pessoais**.

## Artefato preparado

`infra/supabase/child-legacy-metadata-readonly.sql` e uma consulta PostgreSQL com transacao `READ ONLY`. Retorna exclusivamente quatro campos por fonte:

- `source`: nome da tabela analisada;
- `records_examined`: total de registros no escopo;
- `records_needing_review`: candidatos a revisao (contagens, nao linhas ou identificadores);
- `limitation`: cobertura e limite da checagem.

A verificacao procura nomes de chaves sensiveis em JSON de eventos familiares e notificacoes de ciclo infantil. Em `account_notices`, contabiliza **todos** os avisos de perfil infantil para revisao posterior por politica autorizada, pois texto livre pode esconder variacoes. O total nao significa que todos estejam contaminados.

### Condicoes para uma execucao futura

1. Confirmar o projeto/ambiente **isolado de homologacao**, sem dados de pessoas reais, e obter autorizacao explicita para a consulta.
2. Usar identidade de banco **somente leitura**, dentro de canal autenticado; nunca colocar senha ou URL do banco no GitHub, chat, script ou CI.
3. Executar a consulta pelo console SQL do ambiente autorizado. Registrar **somente as contagens agregadas**, data, versao e referencia privada da execucao. Nao copiar eventos, payloads, enderecos ou dados de usuarios para relatorios publicos.
4. Se houver registros candidatos, **nao apagar, editar ou migrar automaticamente**. Primeiro realizar avaliacao de privacidade, base legal, retencao/obrigacao de auditoria e plano de preservacao das evidencias, com pessoa responsavel e aprovacao formal.
5. Confirmar separadamente historico em outros destinos (backups, logs, exportacoes, sistemas de mensagens) e ensaiar regras de eliminacao somente em ambiente permitido. O resultado zero nunca significa ausencia de todos os dados historicos.

### Limitacoes

Este e um inventario aproximado de **nomes de chaves** no JSON, nao uma busca exaustiva por valores, documentos, datas em texto livre, atributos escapados, outros formatos ou sistemas externos. No caso de `account_notices`, ha falsos positivos deliberados. A consulta pode exigir ajuste de escopo caso o esquema autorizado seja diferente.

**Validacao local:** `node --test tests/child-legacy-metadata-inventory.test.mjs` impede que este roteiro passe silenciosamente a escrever no banco ou exponha uma selecao de linhas brutas. Essa prova estatica nao equivale a executar SQL no PostgreSQL.

**Fronteira:** nao altera nenhum esquema, dado, flag de ativacao, contrato, regra aprovada, decisao juridica, status da matriz ou porcentagem. Permanecem necessarios parecer juridico/LGPD e ensaio autorizado antes de concluir qualquer requisito.
