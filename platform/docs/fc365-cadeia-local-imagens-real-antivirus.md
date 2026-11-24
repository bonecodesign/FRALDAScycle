# FC-365 — Ensaio completo de imagem sintética com antivírus real

**Data:** 24/11/2026. **Projeto exclusivo:** FraldaCycle (`bonecodesign/FRALDAScycle`).
**Alvo:** provar, em runner padrão público e descartável do GitHub Actions, a ordem **scan da entrada → decodificação → WebP sem EXIF/GPS → scan da saída → OCR → QR → regra de contatos**, mantendo **R$ 0 de novos custos**, sem fornecedor e sem aprovação comercial.

## Integração entre provas existentes

A FC-362 já exercitou conversão/OCR/QR com arquivos inteiramente artificiais, mas **sem AV**. A FC-364 confirmou o ClamAV real com assinaturas atualizadas, imagem de teste inofensiva e EICAR, porém **não conectou** a verificação antivírus ao mesmo arquivo convertido. Este experimento FC-365 une essas etapas **apenas no laboratório** (não no backend de produção).

- `tools/media-local-chain.py` reutiliza os geradores e a conversão de `media-local-lab.py`. Em cada artefato sintético, escreve **temporariamente** os bytes da entrada em diretório privado, executa **clamscan real** e descarta o temporário. Se a entrada falhar, **nunca decodifica nem executa OCR/QR**.
- Para entrada limpa e decodificada, converte a WebP, confere limites e retirada de EXIF/GPS e faz **nova varredura antivírus real dos bytes finais** antes de rodar Tesseract e OpenCV.
- Para telefone fictício, o avaliador `tools/media-local-chain.mjs` aplica a regra **real** `CONTENT_RULE_VERSION=FC-CONTENT-1` e exige bloqueio por telefone. Para QR sintético, exige bloqueio por presença de QR. Imagem benigna passa apenas no laboratório e continua dependendo de **revisão humana**.
- O EICAR, **padrão de teste inofensivo**, deliberadamente disfarçado com extensão `.jpg`, deve ser detectado pelo antivírus **antes** de o decodificador tentar abri-lo; arquivo corrompido sem assinatura maliciosa deve ser recusado na decodificação.
- O Node executa `executeClamavLocalLab()` de forma independente para exigir ClamAV/sigtool, base diária recente e o autoteste EICAR. **Nenhum** resultado pode virar `scanStatus=clean` no backend.

## Provas esperadas

| Caso artificial | Entrada ClamAV | Conversão/WebP | Saída ClamAV | OCR/QR | Decisão no laboratório |
|---|---|---|---|---|---|
| Pacote fictício benigno | Limpo | WebP/EXIF e GPS removidos | Limpo | Sem contato/QR | Aceito **somente no teste**, exige revisão humana |
| Imagem com telefone fictício | Limpo | WebP/EXIF e GPS removidos | Limpo | OCR acusa contato | Bloqueado |
| Imagem com QR fictício | Limpo | WebP/EXIF e GPS removidos | Limpo | Leitor detecta QR | Bloqueado |
| EICAR inofensivo em falso `.jpg` | Detectado | **Não executada** | Não executado | Não executado | Bloqueado antes do decodificador |
| Dados corrompidos e não maliciosos | Limpo | Decodificação falha | Não executado | Não executado | Bloqueado |

O testador de política `tests/media-local-chain.test.mjs` recusa aprovação simulada se houver scanner ausente, etapas fora de ordem, AV de entrada/saída inconclusivo, EICAR não bloqueado, saída WebP sem remoção de EXIF/GPS, OCR ou QR falso-negativo ou resultado aprovado em produção. A CI de laboratório deve executar **além dos mocks** a cadeia real com Python + ClamAV + Tesseract + OpenCV.

## Como executar e registrar

A workflow `.github/workflows/fc364-clamav-sandbox.yml` (agora cobrindo também FC-365) usa runner padrão `ubuntu-24.04` em repositório público, somente `contents: read`, executa `freshclam`, instala dependências Python **fixadas em versão** e Tesseract, e depois executa:

```bash
node --test tests/media-local-chain.test.mjs
node tools/media-local-chain.mjs
```

Sem `clamscan`, assinaturas recentes, OCR ou QR, a execução **falha fechado**. Os cinco casos são criados inteiramente em memória. Só o scanner recebe bytes temporários; arquivos são apagados automaticamente. O resultado final da execução Node inclui **apenas nomes de casos e decisões**, jamais texto reconhecido, QR original, fotos ou caminhos/segredos. Logs de falha da ferramenta não devem conter OCR bruto.

Documentar **SHA do PR, ID de cada workflow e status real dos jobs** após a execução; não atribuir sucesso antes disso.

## Limites de segurança e governança

Esta é uma **prova integrada real da cadeia sintética local** e não um processamento operacional de anúncios. Não implementa um serviço HTTP de mídia, isolamento multiusuário, armazenamento imutável R2, assinatura/revogação de URL, fila, quarentena, atualização contínua, escala, defesa contra imagens adversariais ou revisão humana. O uso de EICAR confirma a assinatura de teste, não eficácia contra todo malware.

**MED-G01–G12 continuam não homologados**, requisito 41 segue parcial, matriz **48/70**, evidências do piloto BH **16/21** e lançamento **NO-GO**. A escolha oficial do fornecedor fica **para depois dos testes**, preservando o teto de novos gastos em **R$ 0**. Nenhum outro projeto, Supabase hospedado, dado pessoal/infantil ou operação comercial deve ser alterado.
