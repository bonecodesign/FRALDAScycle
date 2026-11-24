# FC-358 — Segunda barreira no navegador antes de enviar a foto do anúncio

**Projeto:** exclusivamente FraldaCycle (`bonecodesign/FRALDAScycle`). **Data:** 23/11/2026 (BRT).
**Escopo:** publicação de anúncios e mídia; código/teste com dados sintéticos, sem fornecedor, upload externo real, dados pessoais ou lançamento.

## Lacuna localizada sem repetir FC-310/FC-316

FC-310 já especifica a cadeia obrigatória de armazenamento, WebP, remoção de EXIF, antimalware, OCR/QR, revisão humana independente e bloqueio quando não há prova de processamento. FC-316 já valida, no **servidor**, o endereço assinado devolvido pelo provedor contra esquemas/hosts perigosos.

O método de navegador `packages/contracts/marketplace-ui.js:uploadListingMedia`, contudo, ainda pegava `upload.uploadUrl` da resposta da API e enviava o objeto `File` por um `fetch` direto, com os valores de `upload.headers` inseridos sem conferência local, **sem indicar `redirect: 'error'` e sem garantir `credentials: 'omit'`**. Esse é um caminho adicional relevante em caso de resposta adulterada, falha no contrato do fornecedor ou mudança futura no servidor. Um redirect HTTP 30x não deve transformar uma autorização assinada em autorização para enviar a foto a outro destino.

## Controles acrescentados no navegador

- O novo `packages/contracts/browser-media-upload-policy.js` valida a autorização recebida: endereço absoluto **HTTPS** com domínio de DNS não local, sem credenciais no URL, sem fragmento, não literal de IP; chave de objeto de anúncio válida; validade temporal ainda ativa de no máximo 15 minutos.
- Reconfere o tipo JPEG, PNG ou WebP e o tamanho de **1 a 10.000.000 bytes**, rejeitando entradas incorretas.
- Confere cabeçalhos da resposta antes da requisição, rejeitando cookies, autorização, origem, host, caracteres proibidos, CR/LF e `content-type` divergente do arquivo escolhido.
- O PUT assinado usa explicitamente **`redirect: 'error'`** e **`credentials: 'omit'`**, preservando a assinatura por URL e os cabeçalhos de upload legítimos, mas não encaminhando cookies ou seguindo redirecionamentos.
- O fluxo só recebe a chave de arquivo após HTTP de upload bem-sucedido; resposta inválida/expirada ou falha de rede deixam a publicação sem nova chave confirmada. O estado anterior do rascunho continua sob controle do componente de upload já existente.

## Testes

A suíte `tests/browser-media-upload-policy.test.mjs` exercita:
- URL assinada sintética válida, com assinatura em query string e cabeçalho permitido;
- URL HTTP, IP e endereços internos, userinfo, fragmento, espaços, expiração e chave inválida;
- cabeçalhos de autorização/cookies/content-type incompatíveis;
- tipo, tamanho, status HTTP e redirecionamento/erro do adaptador `fetch`;
- prova negativa de **nenhuma chamada à rede** quando a autorização é inválida;
- confirmação de que o caminho do app não executa mais `fetch(upload.uploadUrl)` diretamente.

## Restrições e riscos residuais

Não foi feito envio de fotografia real. O filtro do navegador não tem acesso à resolução DNS do destino e **não substitui** DNS/egress em rede, HTTPS pinning, política de redirecionamentos no gateway, token restrito de objeto, antimalware, OCR/QR, análise visual nem homologação/contrato do fornecedor. Uma assinatura pode apontar para domínio com DNS mutável ou domínios de aparência pública; esse risco permanece até políticas e homologação externas.

O item do piloto `publish-search-negotiate` **continua pendente**: precisa de publicação com imagem autorizada e processada, moderação humana independente, busca, negociação e prova observada de ponta a ponta. Os outros quatro itens do piloto (teclado, dispositivos físicos, leitor de tela humano e responsável por rollback) também não foram reclassificados.

**Matriz:** 48/70, **piloto BH:** 16/21, **estado:** NO-GO. `CHILD_PROFILES_ENABLED`, pagamentos, entregas, fornecedores e demais operações reais permanecem desligados. Nenhum outro projeto ou repositório foi alterado.
