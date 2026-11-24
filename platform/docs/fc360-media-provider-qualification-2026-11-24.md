# FC-360 — Qualificação técnica da cadeia de imagens do FraldaCycle

**Data:** 24/11/2026 (Brasil). **Projeto único:** `bonecodesign/FRALDAScycle`.
**Estado:** investigação pública + melhoria de contrato + testes sintéticos. **NENHUM fornecedor, cofre, bucket, cobrança, upload hospedado, varredura real ou homologação externa foi ativado.**

## O que já existe no código

- Upload assinado, limitação de tipo/tamanho, URLs HTTPS e bloqueio de redirecionamentos/cookies no navegador (FC-310, FC-316, FC-358).
- Contrato do processamento exige imagem resultante WebP, imutável, tamanho/dimensões conhecidos, EXIF removido, antivírus `clean`, OCR/contatos `clear`, QR não detectado, versão `FC-CONTENT-1`, nenhum texto OCR armazenado e 1–8 imagens vinculadas ao anunciante.
- A prévia de moderação verifica o lote **antes** de fornecer URLs temporárias (FC-359); a aprovação de anúncio volta a verificar e ainda requer decisão humana independente.
- A FC-360 adiciona recusa de **conteúdo bruto** de OCR, QR Code, código de barras, EXIF/GPS ou imagem original no envelope de atestação do processador, mesmo que as flags digam `clean/clear`. Não registra esses valores nem os devolve nos erros.
- Esses são **controles de software e respostas sintéticas**. Um processador real pode mentir, errar OCR ou não executar varredura; nenhuma flag isolada comprova execução do algoritmo.

## Triagem pública — fornecedores, sem contato ou contrato

| Candidato | Cobre segundo documentação | Não assumir como resolvido |
| --- | --- | --- |
| **Cloudflare R2 + processador a definir** | R2 oferece armazenamento de objetos S3 compatível, operações e upload. Preço publicado para Standard: US$ 0,015/GB-mês, 1M gravações e 10M leituras incluídas/mês, 10GB-mês incluídos/mês. | O armazenamento **não** implementa, por si só, OCR, QR, antimalware e descarte seguro de EXIF. Transformações Cloudflare Images têm preços separados e a opção `metadata=none` é necessária para descartar os metadados invisíveis. Não pressupor que WAF de análise de uploads examine PUT assinado diretamente no R2; exige prova da rota de entrada. |
| **Cloudinary + componentes/add-ons** | Documentação de add-ons descreve OCR e análise antimalware via Perception Point, além de transformação. `fl_force_strip` é relevante ao uso de transformação de entrada para eliminar metadados. | Não há evidência pública suficiente aqui de QR obrigatório, preços combinados no Brasil, integração com a mesma API/contrato ou garantia de que todos os campos são omitidos. OCR/add-ons podem ter planos/tarifas distintas; exigem cotação e homologação antes de mudar a seleção. |
| **Processador próprio isolado + R2** | Arquitetura possível com biblioteca de re-encode WebP, antimalware atualizado e OCR/QR em ambiente controlado, e atestação mínima. | **Não implementado nem homologado.** Exige hospedagem, atualizações de assinatura, monitoramento, timeouts, logs redigidos, testes de falso negativo, retenção, segurança de dependências e orçamento. Não presumir custo zero. |

Fontes oficiais consultadas em 24/11/2026:
- Cloudflare R2: https://developers.cloudflare.com/r2/pricing/
- Cloudflare Images e remoção EXIF (`metadata=none`): https://developers.cloudflare.com/images/optimization/features/
- Cloudflare WAF — análise de uploads (escopo de tráfego precisa ser validado): https://developers.cloudflare.com/waf/detections/malicious-uploads/
- Cloudinary Add-ons OCR + malware: https://cloudinary.com/documentation/manage_and_analyze_addons
- Cloudinary `fl_force_strip`: https://cloudinary.com/documentation/transformation_reference

**Decisão conservadora:** preservar R2 apenas como **candidato preliminar de armazenamento**. Não escolher ou contratar processador até custo, LGPD, cobertura funcional e sandbox comprovados; não tratar Cloudinary como integração já concluída.

## Como obter prova real: kit de homologação MED-G01–G12

Preparar um ambiente **autorizado**, com credenciais só no cofre, e imagens 100% artificiais, sem pessoas, crianças, telefones ou endereços verdadeiros. Para cada caso, guardar **ID de execução, horário, hash do arquivo, versão do processador/assinatura, resultado `accepted/denied` e revisor humano**, sem armazenar texto OCR reconhecido, URLs assinadas ou segredos.

| Gate | Desafio presencial/sandbox e evidência que ainda falta |
| --- | --- |
| MED-G01 | HTTPS, escopos mínimos e URL assinada que expira: capturar IDs de teste redigidos, sem publicar links |
| MED-G02 | Usuário B tenta ler/sobrescrever imagem de A; JPG/PNG/WebP falso e arquivo acima de 10 MB: todas as ações rejeitadas |
| MED-G03 | Entrada artificial com EXIF/GPS fictício: saída WebP identificável por MIME real, com EXIF/GPS ausente e hash distinto |
| MED-G04 | EICAR **somente se aprovado pelo responsável de segurança e pelo fornecedor**; indisponibilidade do antivírus deve bloquear, sem alegar detecção sem scan |
| MED-G05 | Cartela artificial com texto de telefone/e-mail/URL e outra com QR sintético: resultado deve bloquear sem guardar conteúdo OCR bruto |
| MED-G06 | Versão inválida de regra, saída parcial ou campo ausente: bloquear antes da prévia e da publicação |
| MED-G07 | Lote de 2–8 fotos com apenas uma pendente/insegura: bloquear **todo** o lote; nenhuma URL de revisão |
| MED-G08 | URL do revisor expira; sessão e revisor distintos não aprovam; revisão visual humana justificada e auditada |
| MED-G09 | Timeout, redirecionamento, falha temporária, retry, concorrência e indisponibilidade: resultado fechado, sem publicação |
| MED-G10 | Exclusão, retenção, exportação, suboperadores e LGPD: parecer + logs redigidos de ciclo de vida |
| MED-G11 | Cotação do fornecedor (armazenamento + re-encode + OCR + QR + AV + operações), teto mensal e mecanismo de bloqueio de gastos |
| MED-G12 | Integração completa no sandbox autorizado, teste humano e assinaturas dos responsáveis; **nenhuma simulação substitui** |

### Critério de validação

- Se não houver processamento real confirmado, o estado é **não homologado**.
- Se qualquer um dos 12 gates estiver sem teste/documento/aceite, a cadeia permanece **NO-GO**.
- A API `verify-listing-media` pode confirmar estados de um fornecedor; **não prova por si só** que houve antivírus, OCR, QR ou remoção de EXIF.
- O PR #333 de inventário de resíduos infantis segue separado e aberto; não usar dados infantis em testes.
- Matriz oficial **48/70**, piloto BH **16/21**, e requisito FC-41 **parcial**. Não atualizar esses números por novas provas sintéticas.

## Próximo passo externo real

Quando houver autorização para criar ou usar **conta de homologação de mídia** e orçamento/teto definidos, executar os casos acima com fornecedor escolhido, guardar evidências redigidas e obter revisão jurídica/segurança antes de qualquer mudança de status. **Não contrate, não faça upload real e não ative produção por causa deste documento.**
