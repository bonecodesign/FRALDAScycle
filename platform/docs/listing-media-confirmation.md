# Confirmação de mídia dos anúncios

O adaptador de armazenamento deve atender à operação `verify-listing-media` no endpoint HTTPS já configurado. O backend envia `ownerId` e `storageKey` com a credencial do servidor. A resposta deve confirmar os valores exatos e conter:

- `exists`, `processed`, `immutable` e `exifRemoved`: true;
- `contentType`: image/webp, detectado e convertido pelo processamento do arquivo;
- `scanStatus`: clean;
- `sizeBytes`: inteiro entre 1 e 10000000;
- `width` e `height`: inteiros entre 1 e 1600.

O provedor deve produzir chaves definitivas não sobrescrevíveis após o processamento. Não deve preencher esses valores apenas a partir do pedido do navegador. A análise, conversão, remoção de EXIF e consulta ao objeto são responsabilidades do adaptador externo; este repositório valida a resposta e bloqueia respostas incompletas.

Criação com fotos e reenvio com fotos novas consultam esse contrato antes de persistir. Aprovação administrativa revalida todas as fotos, inclusive fotos mantidas em uma nova submissão. A transação final compara a versão consultada com o anúncio bloqueado para impedir publicação após mudanças concorrentes.

Anúncios novos exigem pelo menos uma foto confirmada e entram sempre em revisão. O painel aguarda o carregamento de todas as imagens para liberar aprovação, com bloqueio após expiração ou falha. O servidor exige contexto assinado vinculado à conta, sessão, conteúdo e validade das URLs; também revalida processamento e versão na decisão final.

Validação local com respostas simuladas. Configuração e homologação do adaptador real permanecem pendentes. Eventos de carregamento do navegador e autorização assinada não comprovam atenção humana; o moderador precisa conferir visualmente o conteúdo antes de confirmar.
