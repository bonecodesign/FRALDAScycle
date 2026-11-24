# FC-362 — Execução real do laboratório local de imagens, sem novas despesas

**Data da execução:** 24/11/2026 (BRT). **Escopo:** somente FraldaCycle, testes com imagens artificiais **no contêiner isolado da sessão ChatGPT**, **não** no computador do usuário, na produção ou no Supabase hospedado. **Novas despesas: R$ 0.** Nenhum pacote instalado por este trabalho; utilizadas somente ferramentas já presentes.

## Resultado observado, com limites

Foram geradas em memória três imagens **100% artificiais**: embalagem fictícia com quantidade de fraldas, anúncio fictício contendo telefone sintético, e cartela de QR sintético sem pessoa real. As três passaram por **JPEG → WebP** com Pillow. Todas as entradas tinham EXIF e GPS **fictícios**; a saída WebP foi novamente aberta e não continha EXIF nem GPS. O OCR real (Tesseract) leu o telefone sintético e a função **original do FraldaCycle** `detectProhibitedContent` (regra `FC-CONTENT-1`) retornou `phone`. O leitor OpenCV detectou o QR na imagem sintética. O produto sem contato não foi reprovado. Dados que não eram uma imagem e dimensão de 1601 px foram rejeitados.

**Oito verificações locais concluídas:** WebP, EXIF, GPS, contato via OCR e regra do projeto, presença de QR, produto benigno, arquivo corrompido e dimensão excessiva. **Antivírus não executado:** a ferramenta ClamAV não estava disponível nesse contêiner. Sharp e ZXing também **não foram executados**; usaram-se Pillow e OpenCV como ferramentas gratuitas já presentes. Não confundir substitutos de experimento com a seleção definitiva de bibliotecas.

### Evidência rastreável

- `tools/media-local-lab.py`: gera as imagens e executa codificação, OCR, leitor QR e casos negativos **somente em memória**, sem chamadas de rede e sem imagens de pessoas.
- `tools/media-local-lab.mjs`: usa o contrato **real** `packages/contracts/content-moderation.js` e só registra um resumo sanitizado com hashes dos arquivos artificiais. Texto do OCR fica apenas no fluxo entre processos, não é persistido no relatório.
- `tests/media-local-lab-evidence.test.mjs`: testes de negação contra relatórios falsos, inclusive OCR, QR, EXIF, GPS, dimensões e alegações indevidas de homologação.
- `docs/evidence/fc362-local-media-lab-2026-11-24.json`: resultado observado no laboratório de 24/11/2026, com versões Pillow 12.3.0, OpenCV 4.13.0 e Tesseract 5.5.0, 3 hashes SHA-256 dos arquivos de entrada e saída e **sem texto OCR, QR bruto, imagens nem dados reais**.

O JSON é **evidência do contêiner temporário da sessão**, não atestado independente de fornecedor nem benchmark do computador do usuário. Os hashes dependem da implementação, fonte e versões; diferenças em outro sistema não indicam por si só falha. Não anexar stdout bruto do script Python a tickets, pois o stdout transporta as leituras sintéticas para o avaliador Node.

## Reprodução sem novas instalações automáticas

Em cópia local confiável do repositório, na pasta `platform/`, se **Python 3 com Pillow, OpenCV, NumPy, qrcode e pytesseract, binário Tesseract com idioma inglês e Node >=20** já estiverem presentes:

```bash
node --test tests/media-local-lab-evidence.test.mjs
node tools/media-local-lab.mjs
```

O script **não** instala nada nem se conecta à internet. Se faltar uma dependência, a execução falha e **não transforma ausência em aprovação**. Não usar o botão do piloto, APIs reais ou dados pessoais nesses testes. Execução opt-in, **não incluída em deploy/CI automatizado** pela dependência de programas externos; a suíte Node de consistência dos relatórios integra o CI existente.

## O que não está concluído

- **Antivírus/ClamAV real** (não instalado e nenhum arquivo malicioso analisado);
- reconhecer todos os formatos e variações de contato/QR ou medir falsos negativos, modelos hostis e desempenho com concorrência;
- processador operacional isolado, imutabilidade/storage, segurança DNS, upload remoto, autorização de acesso e retenção;
- homologação de fornecedor, custos de infraestrutura continuados e parecer LGPD;
- revisão humana real de fotografias e fluxo completo de publicação.

**Decisão FC-361 preservada:** primeiro testes gratuitos, depois avaliar fornecedor oficialmente. **Nenhum fornecedor selecionado, contratado ou ativado.** Requisito 41 parcial, matriz oficial 48/70, evidências piloto BH 16/21 e lançamento **NO-GO**, até cumprir MED-G01–G12. PR #333 infantil histórico permanece separado e intocado.

## Próxima prioridade segura

Para fechar a lacuna AV, futuramente testar uma instalação **autorizada e gratuita** de ClamAV em ambiente isolado, com assinaturas atualizadas e imagens de teste permitidas. Nunca marcar `scanStatus=clean` em caso de ClamAV ausente, desatualizado ou indisponível. Depois repetir testes negativos em lote e medir tempo/memória antes de estudar fornecedor.
