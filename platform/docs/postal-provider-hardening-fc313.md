# FC-313 — CEP externo: validação da resposta e prazo total

**Escopo:** `platform/apps/api/postal-code-service.js` e testes associados, sem consumir API real nesta PR.

## Lacuna encontrada

O serviço já usa HTTPS e valida se o CEP de retorno coincide com o consultado. Entretanto:

- Aceitava qualquer UF de **duas letras**, como `XX` ou `CA`, como evidência de endereço brasileiro.
- Aplicava `AbortSignal.timeout` ao `fetch`, mas não tinha prazo independente para um adaptador que ignorasse abort ou para `response.json()` que não terminasse.
- Convertia tipos arbitrários em cidade, rua e bairro com `String(...)`, incluindo objetos e arrays.

## Proteções

1. **UF:** somente as 27 unidades federativas brasileiras, normalizadas em maiúsculas, são admitidas.
2. **Campos:** a cidade deve ser texto com 2–120 caracteres; rua e bairro podem vir ausentes, mas, quando presentes, devem ser textos com até 255 caracteres. Valores coercíveis, tamanhos exagerados ou caracteres de controle são recusados como `invalid_postal_provider_response` (HTTP 502).
3. **Prazo total:** o máximo de **5.000 ms** é aplicado a toda a consulta, inclusive leitura do JSON. A operação usa `AbortController` e um limite independente via `Promise.race` contra adaptadores que ignoram o cancelamento. Um prazo esgotado retorna `postal_provider_unavailable` (503).
4. **Redirecionamentos:** `redirect: "error"` impede reenvio silencioso a outro host.
5. **Invariantes:** CEP divergente, payload sem formato esperado ou UF inválida não gera endereço/evidência. CEP inexistente continua retornando `postal_code_not_found` (422).

## Evidências automatizadas

`tests/postal-code-service.test.mjs` contém regressões para siglas inválidas, payloads nulos ou de tipo incorreto, campos arbitrários, normalização `mg`→`MG`, prazo excedido sem resposta e JSON indefinido. Estas verificações usam exclusivamente funções falsas em memória e não efetuam chamadas externas.

**Limitações:** validação de formato não comprova endereço físico, abrangência real de CEP, existência de domicílio, qualidade do ViaCEP ou homologação com fornecedores. O piloto BH permanece **NO-GO**, com matriz oficial 48/70 e preflight 16/21. Não foram realizadas transações, ativações ou mudanças no protótipo.
