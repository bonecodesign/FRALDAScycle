# FC-310 — Critérios verificáveis de aceite da cadeia de mídia

**Estado em 17/11/2026:** preparação documental e testes sintéticos concluídos para revisão; **nenhum fornecedor de mídia homologado, contratado ou conectado**. Piloto BH: **NO-GO**. O requisito FC-41 permanece **parcial**.

## Desacoplamento necessário

A escolha preliminar de **Cloudflare R2** em `config/provider-selection.v1.json` trata da camada de **armazenamento de objetos**. Ela **não constitui evidência** de que exista, esteja contratado ou tenha sido aprovado qualquer processador externo capaz de realizar transformação, antimalware, OCR, QR Code e remoção de metadados. A arquitetura exige quatro responsabilidades diferenciáveis:

1. **Armazenamento:** upload assinado de curta validade, chave vinculada ao anunciante, isolamento, retenção/exclusão, exportação e impossibilidade de sobrescrever imagens definitivas após processamento.
2. **Processamento:** conferência de existência e tipo detectado, conversão imutável para WebP, dimensão 1–1600 px em cada eixo, tamanho 1–10.000.000 bytes, EXIF removido, resultado antimalware `clean`, OCR/QR e ausência de contatos externos.
3. **Adaptador de confirmação:** o backend aceita `verify-listing-media` apenas se **todas as fotos** retornarem `ownerId` e `storageKey` corretos, `processed/immutable/exifRemoved=true`, `scanStatus=clean`, `contactScanStatus=clear`, `contactRuleVersion=FC-CONTENT-1`, `ocrTextStored=false`, `qrCodeDetected=false`, `contactReasons=[]` e metadados válidos. Rejeição, resposta incompleta e timeout bloqueiam publicação. A consulta tem limite de 8 segundos por requisição.
4. **Revisão independente:** tela autenticada, URL de leitura assinada que expira, associação ao revisor/sessão/versão e inspeção visual **humana**, com decisão justificada e auditada. O upload/processamento automático não substitui esse aceite.

Os prestadores dessas funções podem ser distintos. A disponibilidade de uma API de armazenamento não autoriza inferir que as demais existam.

## Gates verificáveis para futura homologação

| ID | Aceite necessário | Evidência aceitável |
| --- | --- | --- |
| MED-G01 | HTTPS, credenciais restritas no cofre e URL de upload de vida curta | Registro redigido de teste do sandbox; sem tokens |
| MED-G02 | Rejeitar uploads de outro usuário, tipo/tamanho incompatíveis e objetos sobrescrevíveis | IDs de testes e capturas sem dados pessoais |
| MED-G03 | Conversão efetiva para WebP, tamanho/dimensões dentro do limite e EXIF eliminado | Hashes de arquivos artificiais e laudo de metadados |
| MED-G04 | Antimalware executado e resultado `clean`, inclusive quarentena/falhas | Evidência de rejeição com arquivos sintéticos aprovados pela segurança |
| MED-G05 | OCR e QR Code impedem contatos externos; texto de OCR não é armazenado | Conjunto de imagens artificiais com texto/QR e resultados auditáveis |
| MED-G06 | `contactRuleVersion` corresponde ao contrato; resultados desconhecidos reprovam | Teste de versão incompatível e payload incompleto |
| MED-G07 | Todas as 1–8 fotos precisam passar; sucesso parcial não publica | Teste com lote misto pronto/não pronto |
| MED-G08 | Leitura assinada breve e revisão por pessoa independente | Sessão supervisionada e aceite humano documentado |
| MED-G09 | Indisponibilidade, timeout, retry e conflito mantêm estado conservador | Logs redigidos, métricas e evidências de rollback |
| MED-G10 | Exclusão, retenção, exportação e suboperadores aprovados sob LGPD | Parecer jurídico/privacidade e teste de ciclo de vida |
| MED-G11 | Responsáveis e limites financeiros claros (armazenamento + processamento) | Cotação e decisão financeira revisadas |
| MED-G12 | Integração ponta a ponta executada em ambiente autorizado sem dados reais | Relatório de homologação com artefatos e assinatura dos responsáveis |

**Critério de GO para mídia:** todos os gates G01–G12 comprovados e aprovados com fornecedor real e revisão humana. Não aceitar respostas inventadas, contratos não revisados nem apenas sucesso de testes unitários.

## O que FC-310 efetivamente entrega

- `config/provider-readiness.v1.json` contém a lista completa de verificações, inclusive as de processamento e revisão, sem armazenar credenciais.
- `tools/provider-readiness.mjs` falha se o item de mídia desaparecer, se suas variáveis necessárias forem removidas ou se qualquer gate obrigatório for omitido.
- `config/provider-due-diligence.v1.json` e seu validador exigem perguntas adicionais sobre processador, regras de contato, vínculo de propriedade, revisão e falhas, **sem contato com fornecedores**.
- `config/provider-selection.v1.json` separa a seleção preliminar de armazenamento da homologação integral da cadeia.
- `tests/marketplace-providers.test.mjs` agora exercita upload, validação de duas fotos, leitura assinada e rejeição de lote parcialmente processado **somente com respostas fictícias**.
- Todos os cenários executados localmente são preparação para aceite; não são evidência G01–G12 de fornecedores reais.

## Proteções de projeto mantidas

Protótipo original intocado; alterações restritas a `platform/`. Sem serviço pago, credenciais, produção, dados de crianças, transações, publicação externa ou aceite jurídico presumido. A matriz de requisitos continua **48/70** e o preflight do piloto **16/21** até comprovação formal de cada pendência.
