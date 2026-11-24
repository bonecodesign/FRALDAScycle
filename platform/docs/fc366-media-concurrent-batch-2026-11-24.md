# FC-366 — Lotes concorrentes de fotos artificiais, sem custos novos

**Data:** 24/11/2026. **Repositório único:** `bonecodesign/FRALDAScycle`. **Piloto:** BH, **NO-GO**. **Custo novo:** R$ 0.

## Lacuna distinta da FC-365

A FC-365 provou o encadeamento real de ClamAV na entrada e na saída, WebP sem EXIF/GPS, OCR, QR e regra de contato, com **casos sequenciais artificiais**. Ela **não** testava vários anúncios e fotos sendo tratados de forma concorrente, nem a decisão do **lote inteiro** diante de erro, timeout, mídia indevida ou troca acidental de proprietário.

A FC-366 entrega **um novo laboratório opt-in**, não uma fila de produção nem uma API. Nenhum dado de usuário, fotografia real, provedor hospedado, processamento comercial, certificado ou URL assinada é envolvido.

## Operação de teste, com limites

- `tools/media-local-chain.py --case synthetic-...` permite executar **um** dos cinco tipos artificiais fixos, sem ler caminho externo, sem baixar arquivos, sem abrir foto de cliente. A execução habitual da FC-365 sem argumento permanece intacta.
- `tools/media-local-chain.mjs` agora exporta a mesma validação de caso individual já usada na FC-365; não foi adicionada uma regra de aprovação mais permissiva.
- `tools/media-local-batches.mjs` exige **self-test real** da engine e assinaturas do ClamAV FC-363 antes de abrir subprocessos. Aceita apenas **1 a 8 anúncios artificiais**, com **1 a 8 fotos por anúncio**, total máximo **16 fotos**; cada anúncio, proprietário e foto recebe identificador exclusivamente sintético e único. Rejeita caminhos reais, fotos arbitrárias ou cruzamento de IDs.
- Um conjunto fixo de **3 anúncios e 6 fotos** é processado com no máximo **2 subprocessos simultâneos**. Cada subprocesso passa novamente por **ClamAV original → decodificador → WebP sem EXIF/GPS → ClamAV de saída → Tesseract → leitor QR → regra original FC-CONTENT-1**. Perda do scanner, falha, corrupção, timeout, resultado errado ou fora do lote bloqueiam a decisão da foto.
- A decisão **somente acontece depois de todas as fotos do anúncio terminarem**. Se houver foto com telefone, QR ou ameaça sintéticos, o **anúncio inteiro** é bloqueado, sem liberar as outras. Uma falha/timeout em qualquer foto resulta em `blocked-batch-error` para o anúncio. Outros anúncios independentes não são aprovados indevidamente nem contaminados.
- Mesmo o anúncio formado apenas por imagem benigna recebe **`local-only-review-required`**; **nunca** é publicado nem recebe URL de revisão. O relatório só contém ID fictício, contagem de fotos, status e pico de paralelismo; nenhum texto OCR, payload QR, resultado bruto do scanner ou material da imagem é persistido.

## Casos exercitados

| Anúncio artificial | Composição | Resultado esperado |
| --- | --- | --- |
| `listing-a` | 1 foto benigna | `local-only-review-required` |
| `listing-b` | 1 foto benigna + 1 telefone fictício | `blocked-batch` para o anúncio todo |
| `listing-c` | QR sintético + EICAR inofensivo + arquivo corrompido | `blocked-batch` para o anúncio todo |

Os testes Node `tests/media-local-batches.test.mjs` também usam falhas **simuladas** para cobrir concorrência limitada, timeout, exceções, resultado atribuído ao proprietário/foto errado, estados `published` indevidos, lote com mais de 8 fotos, mais de 16 fotos na execução e 8 fotos benignas que continuam aguardando revisão humana. **Mocks de timeout não substituem scanner real**, que é invocado separadamente pela workflow.

## Execução e evidência

A workflow `.github/workflows/fc364-clamav-sandbox.yml` foi ampliada: na **máquina descartável padrão, gratuita para o repositório público**, instala temporariamente ClamAV, atualiza assinaturas oficiais, Tesseract e bibliotecas de imagem gratuitas; roda a FC-365 e depois:

```bash
node --test tests/media-local-batches.test.mjs
node tools/media-local-batches.mjs
```

O subprocesso Python é executado com timeout; nenhum arquivo além das cópias **temporárias** para scanner fica no disco. Uma possível indisponibilidade/rate-limit do `freshclam`, ausência de dependência ou falha de qualquer caso real reprova o job. A workflow principal `Platform CI` testa a lógica Node sem instalar ClamAV.

**Na revisão do PR:** verificar ambos os resultados na SHA exata. Não declarar execução real aprovada antes de registrar IDs dos runs/logs. O limite de 2 workers não é uma medida de capacidade de produção nem demonstra resistência a 100–300 usuários simultâneos. O laboratório não possui persistência, retry, operações de negócio ou garantia transacional distribuída.

## Gates ainda externos

Mesmo com execução real no runner, **MED-G01–G12 continuam não homologados**: falta processamento real de uploads hospedados, isolamento multiusuário, storage imutável, URLs de leitura assinadas, quarentena e updates contínuos, medidas de latência/memória sob carga operacional, custo de infraestrutura continuado, LGPD e revisão humana independente.

**A matriz permanece 48/70, piloto BH 16/21, requisito de imagens FC-41 parcial, NO-GO**. A decisão FC-361 é preservada: primeiro opções/testes locais a **R$ 0 de novos gastos** e só depois considerar oficialmente um fornecedor, com autorização humana separada. PR #333 de privacidade infantil não é alterado.
