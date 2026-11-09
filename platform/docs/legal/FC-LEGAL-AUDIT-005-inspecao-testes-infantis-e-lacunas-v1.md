# FC-LEGAL-AUDIT-005 — Inspeção de testes infantis e lacunas de comprovação

**Data:** 09/11/2026. **Método:** leitura dos arquivos de teste na `main` pelo GitHub, sem execução local/CI. **Não homologado; requisitos 26, 27, 28, 31, 32 e 33 bloqueados.**

## Evidência estática inspecionada
| Arquivo | Asserções identificadas no código | O que não prova |
|---|---|---|
| `platform/tests/family-profile-foundation.test.mjs` | Derivação de faixa etária, rejeição de datas futuras/adultas, versão/hash de consentimento, flag infantil desligada e exigência de ACK independente em produção, estrutura SQL | Configuração efetiva do ambiente, adequação LGPD, coleta mínima em serviços externos |
| `platform/tests/child-profile-http-postgres.test.mjs` | Cenário HTTP/PostgreSQL com perfis sintéticos, bloqueio de papéis e contas, 2 perfis, alteração, remoção inclusive do último, `birth_date=NULL` após exclusão, evidência de consentimento sem data/emoji, `Cache-Control: no-store` | Purga de backup e fornecedor real, comportamento em produção, aprovação jurídica |
| `platform/tests/responsible-registration-http-postgres.test.mjs` | Cadastro com responsável, CPF, data de nascimento **do adulto**, endereço e perfil familiar; prova de aceite, auditoria e aviso sem data infantil | Proporcionalidade da coleta de dados do adulto, validade da base legal infantil, fluxo real de UX e fornecedores |

**Atenção à interpretação:** a proibição de coletar data de nascimento infantil em terceiros não significa proibir data de nascimento **do responsável adulto**. O teste de cadastro inclui data do adulto, CPF e endereço; inventariar esses campos no LEG-02/14 e revisar necessidade/retensão próprios.

## Lacunas de teste e homologação a priorizar
1. Confirmar execução real e resultados no SHA alvo; a presença de `assert` no código não comprova teste verde.
2. Cobrir a distinção **remoção manual do último perfil** versus **expiração automática do último perfil aos 13 anos** em operações dependentes e vitrine geral.
3. Testar **falha segura com flag infantil desligada** por HTTP, inclusive sem escrita/consulta e sem criação de interface.
4. Inspecionar exportação com senha, segundo fator por e-mail, criptografia, expiração e tratamento de pedidos adicionais legítimos.
5. Testar ausência de data infantil, identificadores e contagem de crianças em e-mail, telemetria, ranking externo e logística; evitar vazamento por inferência.
6. Validar acesso emergencial com dupla aprovação independente, leitura apenas, 15 minutos e trilha sem data.
7. Exercitar restauração de backup e eliminação real em fornecedor homologado somente após autorização.
8. Revisar campos do adulto (CPF, data de nascimento, endereço), suas bases legais, acesso, retenção e terceiros.
9. Conferir exigência de perfil inicial versus alternativa de cadastro adulto sem perfil, sujeita a decisão jurídica fundamentada.

## Sequência Codex sugerida sem dados reais
- Executar os três testes existentes em ambiente sintético e registrar SHA, comandos, resultado e skips.
- Acrescentar testes de regressão somente em branch técnica autorizada e separada, sob `platform/`.
- Confrontar `platform/docs/requirements-matrix.json` e a interface real; não alterar estados até evidência e parecer.
- Preparar dossiê para jurídico/encarregado com hipóteses legais por finalidade, teste de necessidade e melhor interesse.

**Resultado desta inspeção:** três arquivos de teste lidos; cobertura estática identificada; nenhum teste executado; nenhum bloqueio liberado. Piloto NO-GO.
