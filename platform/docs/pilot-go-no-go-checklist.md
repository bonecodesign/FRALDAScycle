# Checklist go/no-go do piloto

Este checklist separa prontidão técnica de autorização operacional, contratual e jurídica. O estado padrão do projeto continua sendo **NO-GO** para dinheiro real e produção.

## Evidência técnica

- [x] Sintaxe de produção validada (`127 files approved`).
- [x] Testes focados de Premium/Asaas aprovados.
- [x] Testes focados de rotas aprovados.
- [x] Testes de governança de fontes e endpoints aprovados.
- [x] Idempotência e concorrência da atualização de disponibilidade cobertas.
- [x] Auditoria de fontes, promoção e ativação implementada.
- [ ] Suíte completa sem falhas ambientais.
- [ ] Testes HTTP remotos executados no CI com dependências reais de ambiente.

## Fornecedores e operação

- [ ] Contrato e credenciais de pagamento aprovados.
- [ ] Contrato e credenciais do provedor de rotas aprovados.
- [ ] Termos, limites, cache e custos dos fornecedores revisados.
- [ ] Política de suporte, reembolso e incidentes treinada.
- [ ] Monitoramento, alertas e rollback testados em ambiente controlado.

## Jurídico e privacidade

- [ ] Revisão profissional dos Termos e Privacidade concluída.
- [ ] Requisitos de dados infantis revisados e autorizados.
- [ ] Retenção, exportação e exclusão validadas.
- [ ] Fluxos financeiros e titularidade do cartão revisados.

## Decisão

O piloto só pode avançar para GO quando todos os itens obrigatórios acima estiverem evidenciados e o responsável autorizado registrar a decisão. Flags de produção permanecem desligadas até lá.

## Registro da revisão atual

Data: 2026-10-30

- Resultado: **NO-GO**.
- Evidência técnica pós-merge: `origin/main` em `86a3862`; validações focadas de fornecedores e governança aprovadas.
- Sintaxe de produção: 127 arquivos aprovados.
- CI remoto: status não confirmado nesta sessão porque a API pública retornou HTTP 403.
- Não há autorização para ativar Asaas, Google Maps, atualização horária ou coleta infantil em produção.
- Próxima ação de decisão: obter evidências de CI e homologação antes de revisar os bloqueios externos.
- Pacote de revisão jurídica e de privacidade preparado em `docs/legal-privacy-review-packet.md`.
