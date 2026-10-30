# Pacote para revisão jurídica e de privacidade

Este documento organiza os pontos que precisam de análise profissional antes de qualquer piloto financeiro ou ativação em produção. Ele não constitui parecer jurídico.

## 1. Dados infantis

- Confirmar base legal e necessidade de coletar data de nascimento.
- Validar limite de idade, encerramento aos 13 anos e avisos prévios.
- Confirmar eliminação operacional, auditoria sem data e expiração de backups em até 30 dias.
- Revisar exportação de datas ativas e direitos do responsável.
- Validar que suporte não receba fotos, documentos ou dados de saúde infantis.

## 2. Responsável e consentimentos

- Validar idade mínima de 18 anos, CPF, endereço e autodeclaração.
- Aprovar Termos de Uso e Política de Privacidade versionados.
- Confirmar fluxos de mudança de termos, retirada de consentimento, exportação e exclusão.
- Revisar recuperação excepcional de conta, prova de vida e retenção dos arquivos.

## 3. Pagamentos e Premium

- Confirmar contrato, split, taxas, reembolso, chargeback e responsabilidade financeira do Asaas.
- Resolver a lacuna de titularidade real do cartão: comparação de CPF não comprova titularidade.
- Validar tokenização, retenção de dados e cobrança recorrente de R$ 14,90.
- Revisar comunicação de falhas, carência e cancelamento.

## 4. Marketplace e logística

- Validar ranking por idade aproximada, distância e disponibilidade auxiliar.
- Confirmar que fontes públicas não substituem dados oficiais do fabricante.
- Revisar termos de uso de Google Maps, cache, geocodificação e retenção.
- Validar responsabilidades, seguros e tratamento de dados no transporte.

## 5. Marketing, cookies e suporte

- Validar consentimento separado para promoções e medição de abertura/cliques.
- Revisar banner de cookies e precedência entre preferência local e da conta.
- Aprovar mascaramento, acesso emergencial, marca-d’água e retenção de chamados.

## Evidências técnicas anexadas

- `docs/family-profile-foundation-beta.md`
- `docs/decisions/FC-DEC-2026-10-22-dados-infantis-retencao.md`
- `docs/decisions/FC-DEC-2026-10-23-conta-premium-privacidade.md`
- `docs/decisions/FC-DEC-2026-10-30-premium-recorrencia-asaas.md`
- `docs/manufacturer-availability-production-runbook.md`
- `docs/provider-operational-configuration.md`

## Critério de encerramento

O bloqueio só pode ser removido quando houver aprovação profissional registrada, versão dos documentos aprovada e responsáveis definidos para operação, segurança e incidentes. Até lá, o projeto permanece NO-GO.
