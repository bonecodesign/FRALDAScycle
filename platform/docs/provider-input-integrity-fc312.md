# FC-312 — Integridade de coordenadas e entradas de provedores

**Estado:** correção técnica local, somente mocks e API em loopback. **Não** ativa geocodificação real nem armazenamento externo. Piloto BH: **NO-GO**.

## Falha concreta e impacto

O adaptador anterior aplicava `Number(result.latitude)` e `Number(result.longitude)`. Em JavaScript, `Number(null)`, `Number("")` e `Number(false)` produzem **0**, um número finito e dentro dos intervalos geográficos. Assim, um provedor com resposta incompleta poderia retornar uma localização `0,0` sem haver informado coordenadas válidas, gerando falsa confiança e mapas incorretos.

O adaptador também convertia nomes de localidades arbitrários por `String(...).slice(...)`, de modo que `state: "California"` poderia ser mostrado como `CA`, mesmo sem UF brasileira válida. O endereço de entrada poderia ser um objeto convertido em `"[object Object]"`; o tamanho de upload poderia ser uma string numérica convertida em número.

## Correção implementada

- **Coordenadas:** respostas do provedor devem conter números JSON efetivos, finitos, latitude -90 a 90 e longitude -180 a 180. `null`, vazio, string, booleano, objeto, array, infinito, NaN e valores fora dos limites são recusados com `invalid_provider_response` (HTTP 502). Um **zero numérico explícito** continua sendo uma coordenada válida: esta correção elimina coerção, não tenta deduzir país a partir de longitude/latitude.
- **Localidade:** nome da cidade, quando presente, deve ser texto não vazio até 120 caracteres; a UF, quando presente, deve ser uma das 27 siglas brasileiras (com conversão segura para maiúscula). Não truncar valores inválidos para aparentarem uma cidade/UF legítima.
- **Entradas:** `address` deve ser uma string com tamanho válido; `signedUpload.sizeBytes` deve ser inteiro numérico, sem coerção de strings e booleanos. Solicitações inválidas são recusadas **antes** de qualquer chamada ao provedor.
- **HTTP:** regressão para `POST /v1/geocoding/resolve` verifica autenticação obrigatória, falha 502 por coordenadas incompletas, ausência de `location` no resultado e `cache-control: no-store`.
- **Não extrapolar:** validar valores informados por um provedor não prova que as coordenadas estão corretas ou dentro da área de atendimento. Uma geocodificação autêntica e a logística da região dependem de homologação externa.

## Verificações

`tests/marketplace-providers.test.mjs` acrescenta casos de `null`, coerções e formatos inválidos, UF não brasileira, recusa de entradas mal tipadas sem invocar `fetch`, além de normalização legítima de `mg` para `MG`. Todos são **dados sintéticos**.

Nenhum novo fornecedor, custo, credencial, dado pessoal real ou publicação externa. Toda a alteração está em `platform/`, sem modificar o protótipo imutável. O preflight permanece **16/21**, a matriz **48/70**, e o piloto BH **NO-GO**. Merge condicionado aos cinco jobs obrigatórios aprovados.
