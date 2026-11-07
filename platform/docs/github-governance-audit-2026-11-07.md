# Auditoria não intrusiva de governança do GitHub — 07/11/2026

Repositório: `bonecodesign/FRALDAScycle`, branch principal `main`.

## Observações da consulta remota

| Controle | Evidência observável | Conclusão limitada |
| --- | --- | --- |
| Visibilidade | A API do repositório informou `visibility=public` e `private=false`. | Código e documentos públicos exigem higiene de dados. A escolha de manter o repositório público ou torná-lo privado cabe ao proprietário. |
| Rulesets | Consulta `GET /repos/bonecodesign/FRALDAScycle/rulesets?includes_parents=true` retornou lista vazia. | Não foi identificada regra de ruleset nessa consulta; não prova que outras formas de controle não existam. |
| Proteção tradicional da `main` | `GET /repos/bonecodesign/FRALDAScycle/branches/main/protection` retornou HTTP 403, `Resource not accessible by integration`. | **Não verificável com esta integração**. Não afirmar que o branch esteja protegido nem desprotegido. |
| CODEOWNERS | A listagem de `.github/` continha `pull_request_template.md` e `workflows/`, sem `CODEOWNERS`. | Não foi encontrado `.github/CODEOWNERS`. Nenhuma identidade real foi atribuída. |
| Regras locais | `config/code-governance.v1.json`, `packages/contracts/code-governance.js`, `tests/code-governance.test.mjs`. | Classificação e testes de revisão apenas **locais**; não criam aprovação remota de nível 4/5 nem impedem push direto. |

Estas evidências foram consultadas sem modificar configuração remota, credenciais, colaboradores ou visibilidade.

## Escopo do endurecimento local

O classificador de revisão agora inclui expressamente incidentes, pausa/retomada, notificações, workers, módulos de banco e contratos, componentes administrativos, controles do piloto, matriz oficial, documentos de decisão e governança. Arquivos da raiz fora de `platform/` não são classificados como alterações ordinárias: recebem escalonamento para revisão de nível 5. **Isto não autoriza alteração do protótipo imutável**.

Além disso, entradas com segmentos `.` ou `..`, separadores ambíguos, controles ou caminhos absolutos são rejeitadas. A política local permanece independente da configuração remota: mesmo com CI aprovado, o GitHub não passará a exigir aprovador apenas por existir este contrato.

## Portões remotos para autorização futura do proprietário

1. O proprietário deve confirmar a decisão de privacidade/visibilidade do repositório antes de expor evidências humanas, registros operacionais ou contratos futuros. Nunca versionar credenciais ou identificação pessoal de participantes.
2. Identificar **pessoas/contas reais** dos níveis 2 (contribuição), 4 (revisão geral) e 5 (decisão fundadora) e verificar as permissões efetivas. Não gerar equipes ou proprietários fictícios.
3. Configurar proteção da `main` com PR obrigatória, checks essenciais obrigatórios, revisão de pessoas autorizadas, vedação de autoaprovação e bloqueio de push direto, respeitando o acesso do proprietário.
4. Criar `CODEOWNERS` com nomes reais confirmados e exigir a revisão do proprietário onde houver suporte do GitHub, em especial alterações de segurança, dados, pagamentos, incidentes e produção.
5. Verificar com acesso administrativo as regras efetivamente aplicadas à `main` e testar um PR benigno e uma tentativa controlada de mudança sensível, sem comprometer a branch principal.
6. Registrar a decisão e evidências da homologação remota; até lá, marcar **governança remota não homologada**.

**Estado:** a governança local é testável, mas a aplicação remota de aprovações e bloqueios permanece **não verificada**. Nenhum dos itens acima foi executado no GitHub nesta rodada.
