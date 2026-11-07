# Auditoria incremental de segurança, matriz e evidências — 07/11/2026

## Base verificada

- Repositório: `bonecodesign/FRALDAScycle`, `main` em `02b3c66fdecb8965da8e148c5da77e14fdcbc8d0` (PR #205 integrado).
- Matriz formal: **70 requisitos: 42 concluídos, 17 parciais, 11 bloqueados**. Conclusão estrita 60%; cobertura parcial/concluída 59/70 (84,29%) **não é** porcentagem de prontidão.
- Piloto e produção: **NO-GO**; sem fornecedor contratado, credencial, cobrança, repasse ou publicação externa.
- Escopo desta rodada: somente `platform/`, sem edição do protótipo, sem orquestração operacional autônoma.

## Auditoria dos três PRs antigos

| PR | Estado em 07/11 | CI do head consultado | Conduta |
| --- | --- | --- | --- |
| [#115](https://github.com/bonecodesign/FRALDAScycle/pull/115) | aberto, não mergeável, desatualizado | #1269: **falha** | Não mesclar. Reaproveitar somente o gate de confirmação explícita de ativação dos adaptadores genéricos de pagamento/logística e seus contratos/testes; não importar diagnósticos de navegador e mudanças de teste antigas. |
| [#130](https://github.com/bonecodesign/FRALDAScycle/pull/130) | aberto, não mergeável, desatualizado | #1360: **sucesso para aquele head**, sem validar compatibilidade com a `main` atual | Não mesclar. Confrontar eventuais melhorias do painel com autorização setorial integrada posteriormente; evitar nova Central paralela. |
| [#189](https://github.com/bonecodesign/FRALDAScycle/pull/189) | aberto, não mergeável, auditoria até PR #188 | #1550: **sucesso no head antigo** | Usar achados como referência histórica; atualizar aqui com progresso até PR #205, sem mesclar branch defasada. |

Status `mergeable=false` significa que não devemos tentar integração automática dessas versões. Uma CI verde em branch antiga não substitui revisão sobre o código atual.

## Achado de exposição e governança

O GitHub informa `visibility=public`. Isso **não** demonstra vazamento de segredos, mas aumenta a importância de revisar commits, artefatos, Actions, colaboradores, proteção de `main` e regras `CODEOWNERS`. A checagem preliminar de padrões em #189 não é uma auditoria exaustiva de credenciais. Decidir a visibilidade e aplicar regras de proteção remota requer ação/autorização específica e verificação de permissões; esta rodada **não** altera essas configurações.

## Correções incrementais propostas

1. **Proteção de provedores genéricos:** configuração de produção com endpoint de pagamento ou logística passa a exigir confirmação literal própria, sem dispensar URL, segredo, webhook ou os gates já existentes para Asaas/Lalamove. Diagnóstico recusa `false` ou ausência como aprovação. Valores de exemplo ficam desativados. Nenhuma chamada externa é acrescentada.
2. **Matriz:** corrigir cabeçalho desatualizado da visualização Markdown, registrar evidências de 07/11 e esclarecer que a retenção citada no requisito 10 concerne à conciliação financeira da diferença; não há decisão jurídica generalizada de retenção. Os **estados continuam 42/17/11**.
3. **Requisito 41 (contatos nos anúncios):** contrato de mídia já falha fechado para resultados incompletos de OCR, QR ou varredura de contato. Acrescentar regressões de campos ausentes/ambíguos e esclarecer o contrato no documento. A homologação de mídia real continua pendente; não promover a concluído.
4. **Requisito 42 (burlas/sanções):** ciclo técnico de suspensão temporária, recurso e restauração idempotente já existe. Continuam pendentes revisão humana, treinamento e capacidade operativa; não aplicar sanção definitiva automática.
5. **Requisito 50 (suporte interno):** atribuição exclusiva, notas privadas, auditoria e filas já existem. Política de SLA, equipe responsável e ensaio humano ainda não comprovados; não declarar concluído.

## Portões de integração

- Fazer revisão dos diffs e restringir caminhos a `platform/`.
- Conferir testes de configuração e diagnóstico de produção, validação da matriz, regressões de mídia, suites de integração aplicáveis e todos os jobs do `Platform CI`.
- Não fazer merge se o head mudar, CI falhar ou houver bloqueio/revisão de segurança.
- Não utilizar aprovação de testes sintéticos para alterar requisito externo para concluído ou liberar o piloto.
