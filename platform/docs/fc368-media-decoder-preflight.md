# FC-368 — Pré-validação de imagens antes da decodificação

Projeto único: FraldaCycle. Custo incremental autorizado: R$ 0. Laboratório artificial, sem fornecedor, fotos reais, dados pessoais ou hospedagem.

## Lacuna
O laboratório FC-362/365/366 chamava Pillow load() antes de validar dimensões, e não recusava expressamente imagens com múltiplos quadros. Uma imagem comprimida poderia exigir alocação desnecessária ou ocultar conteúdo em quadros que não seriam preservados pela conversão.

## Mudança
- Limite de entrada 1–10.000.000 bytes antes de abrir.
- Restrição de identificadores de formato JPEG, PNG e WebP.
- Dimensões 1–1600 em cada eixo verificadas antes de load().
- Recusa de animação ou múltiplos quadros antes de decodificar os pixels.
- Mantida a saída WebP, sem EXIF/GPS, e a ordem AV de entrada, decode, AV de saída, OCR/QR e decisão.

## Evidência
Cinco testes Python com Pillow real: tamanho de bytes antes de open(); JPEG de largura/altura excessiva sem chamar load(); GIF/BMP/corrompido recusados; APNG e WebP animados com dois quadros; conversão estática JPEG/PNG/WebP. Executados no workflow gratuito já existente, juntamente com a cadeia real ClamAV e a CI principal. Aprovação somente após resultados na SHA exata.

## Limites
A abertura e análise de cabeçalhos ainda executam código de biblioteca. Não constitui sandbox de produção, limite de memória global, prova contra todo arquivo malicioso, homologação de storage ou autorização para upload real. Revisão humana e MED-G01–G12 continuam exigidos. FC-41 parcial, matriz 48/70, piloto 16/21, NO-GO; PR #333 intocado.
