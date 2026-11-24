# FC-361 — Opção de testes locais sem novos custos, antes de escolher fornecedor de mídia

**Decisão de planejamento em 24/11/2026:** registrar a alternativa **local e gratuita em licenças** para teste do processamento de fotos do FraldaCycle, **sem adotá-la ainda como arquitetura oficial ou homologação de produção**.

## Ordem aprovada para avaliação

1. **Primeiro testar localmente** com imagens integralmente artificiais, usando *Sharp* (conversão WebP/remoção de metadados), *ClamAV* (antimalware), *Tesseract* (OCR) e *ZXing* ou leitor QR equivalente. São **candidatos**, não dependências instaladas nem ferramentas já validadas.
2. Documentar se os testes conseguem remover EXIF/GPS, detectar e impedir contato externo em texto e QR, respeitar dimensões/tamanho, recusar arquivo inseguro, não armazenar OCR bruto, bloquear lote parcialmente processado e entregar evidências redigidas, inclusive em casos de falha.
3. **Somente depois dos resultados** estudar oficialmente os fornecedores de armazenamento/processamento, custos e viabilidade (R2, Cloudinary ou alternativas). A comparação **não** autoriza contratação nem configura uma escolha definitiva.
4. Uma escolha oficial e homologação de fornecedor requerem autorização separada, revisão jurídica/segurança/financeira e cumprimento de MED-G01–G12, com provas reais no ambiente autorizado.

## Regras não negociáveis

- **Teto de novos gastos desta etapa: R$ 0.** Nenhuma assinatura, cartão de pagamento, cobrança por consumo, compra de domínio, criação automática de serviço ou contratação. Evitar inclusive testes gratuitos que possam converter automaticamente para um plano pago.
- Ferramentas open source **não significam infraestrutura gratuita**: CPU, RAM, disco, energia, hospedagem e manutenção precisam caber em recursos já disponíveis. O resultado do teste deve informar consumo observado e limites, sem prometer operação gratuita em produção.
- Sem conta externa de fornecedor, segredos, dados infantis, fotos reais ou publicação comercial. Somente testes sintéticos e locais explicitamente seguros.
- **Não habilitar o piloto.** Requisito 41 ainda parcial, matriz 48/70, piloto BH 16/21 e **NO-GO**. Testes locais de processamento não substituem moderação humana independente nem pareceres LGPD.

**Registro técnico:** `config/provider-selection.v1.json` — campo opcional `selection[id=media].evaluationPlan`. Os candidatos `recommended=cloudflare-r2` e `alternative=cloudinary` permanecem como pesquisa **não aprovada para contratação**; a opção local não transforma nenhum deles em fornecedor escolhido.

**Ponto de retomada:** concluído o teste local com evidência verificável, apresentar a comparação técnica e financeira para decisão formal sobre fornecedor.
