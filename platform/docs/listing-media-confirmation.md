# Confirmação de mídia dos anúncios

O adaptador de armazenamento deve atender à operação `verify-listing-media` no endpoint HTTPS já configurado. O backend envia `ownerId` e `storageKey` com a credencial do servidor. A resposta deve confirmar os valores exatos e conter:

- `exists`, `processed`, `immutable` e `exifRemoved`: true;
- `contentType`: image/webp, detectado e convertido pelo processamento do arquivo;
- `scanStatus`: clean;
- `contactScanStatus`: clear; `contactRuleVersion`: FC-CONTENT-1;
- `ocrTextStored`: false, `qrCodeDetected`: false e `contactReasons`: lista vazia;
- `sizeBytes`: inteiro entre 1 e 10000000;
- `width` e `height`: inteiros entre 1 e 1600.

O provedor deve produzir chaves definitivas não sobrescrevíveis após o processamento. Não deve preencher esses valores apenas a partir do pedido do navegador. A análise, conversão, remoção de EXIF e consulta ao objeto são responsabilidades do adaptador externo; este repositório valida a resposta e bloqueia respostas incompletas.

Criação com fotos e reenvio com fotos novas consultam esse contrato antes de persistir. Aprovação administrativa revalida todas as fotos, inclusive fotos mantidas em uma nova submissão. A transação final compara a versão consultada com o anúncio bloqueado para impedir publicação após mudanças concorrentes.

Anúncios novos exigem pelo menos uma foto confirmada e entram sempre em revisão. O painel aguarda o carregamento de todas as imagens para liberar aprovação, com bloqueio após expiração ou falha. O servidor exige contexto assinado vinculado à conta, sessão, conteúdo e validade das URLs; também revalida processamento e versão na decisão final.

Validação local com respostas simuladas. Configuração e homologação do adaptador real permanecem pendentes. Eventos de carregamento do navegador e autorização assinada não comprovam atenção humana; o moderador precisa conferir visualmente o conteúdo antes de confirmar.

Em 07/11/2026, a regressão de contrato foi ampliada para respostas com campos obrigatórios ausentes ou ambíguos (OCR, QR, regra e resultado de contato). O provedor **não está homologado**: os novos casos usam respostas sintéticas e continuam sujeitos ao CI. A resposta `verified:true` só é informada depois de validar todas as fotos, e não equivale à inspeção humana de mídia real. O requisito formal 41 permanece parcial.

## FC-307 — prazo rígido das verificações de mídia (17/11/2026)

O adaptador exige agora um prazo **máximo total de 8 segundos** para cada requisição de provedor, cobrindo conexão, retorno HTTP e leitura/decodificação JSON. Um `AbortController` solicita interrupção; um limite independente com `Promise.race` também encerra a operação quando um adaptador ignora o cancelamento. Esgotamento do prazo resulta em `provider_unavailable` (HTTP 503), nunca em sucesso fictício.

Respostas JSON nulas, listas ou valores primitivos retornam `invalid_provider_response` (HTTP 502). Sem resposta positiva estruturada, o backend não reconhece foto como confirmada. Os testes simulam conexões e respostas que nunca terminam e rejeição por tipo de resposta; **nenhum fornecedor foi acionado**.

O requisito FC-41 continua **parcial**: não há prova real de OCR/QR, revisão de imagens, taxa de falsos negativos, armazenamento externo ou inspeção humana. A alteração não autoriza publicação, ativação de serviços nem uso de dados pessoais reais.
