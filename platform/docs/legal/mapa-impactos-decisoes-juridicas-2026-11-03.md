# Mapa de impactos — decisões jurídicas do fundador

Data: 3 de novembro de 2026.

Fonte: `docs/decisions/FC-DEC-2026-11-03-governanca-juridica-produto.md`.

Estado: planejamento técnico e documental; não representa parecer profissional nem eleva o percentual formal.

| Pacote | Mudança necessária | Situação atual | Evidência esperada | Gate externo |
|---|---|---|---|---|
| Cadastro familiar | Fluxo único, perfil obrigatório e descarte de incompleto em 24h | Implementado localmente e desligado por padrão | HTTP/PostgreSQL, concorrência e expiração | Jurídico/Privacidade |
| Remoção infantil | Permitir remover último perfil, diferenciar remoção manual de encerramento aos 13 e avisar alterações sem expor a data | Implementado localmente, inclusive aviso interno por 12 meses; feature ainda desligada | Testes de remoção, purga, aviso minimizado e relevância geral | Jurídico/Privacidade |
| Consentimento infantil | Texto versionado, evidência por conta + 5 anos e aviso curto no ponto de coleta | Implementado localmente e desligado por padrão; fechamento da conta ainda não executa retenção | Migração 128, interfaces e testes PostgreSQL | Texto profissional e integração ao fechamento |
| Marketing etário | Opt-in separado, faixa ampla interna e fornecedor sem segmento | Decisão documentada, implementação incompleta | Contrato, outbox minimizada e testes | Fornecedor/Privacidade |
| Acesso emergencial | Dupla aprovação, 15 minutos, somente visualização e marca-d'água | Janela anterior diverge | Testes de expiração e auditoria | Segurança/Privacidade |
| Disputa de responsabilidade | Nível 1 registra; nível 2 verifica plausibilidade e só então suspende; nível 3 decide; referências de evidência expiram em 30 dias | Fundação e retenção diária implementadas localmente e desligadas por padrão | Migração 129, serviço, rotas, worker limitado e PostgreSQL | Jurídico/Privacidade/Operação |
| Doação aberta | Preferência geral da instituição e recusa na retirada | Parcial | Interface, persistência e testes | Política institucional |
| Impacto socioambiental | Estimativas agregadas com metodologia e incerteza | Não implementado | Documento metodológico e teste de anonimização | Especialista ambiental |
| Cancelamento e taxas | Suporte, custos externos comprovados e demonstrativo | Parcial | Cálculo, recibo e cenários de culpa | Asaas/Contabilidade |
| Chargeback e repasse | Conciliação antes do débito; repasse após entrega + 48h | Parcial | Máquina de estados e testes PostgreSQL | Asaas/Jurídico |
| Prova de entrega | Evento, código e foto minimizada; 30/90 dias | Parcial | Upload seguro, EXIF removido, retenção | Lalamove/Privacidade |
| Entregador | Certidão 30 dias, recurso, autonomia e ausência de seguro | Parcial; textos anteriores divergem | Políticas, bloqueios e testes | Trabalhista/Jurídico |
| Premium | Arrependimento inicial, aceite recorrente e reajuste em 30 dias | Parcial | Checkout, cancelamento, evidência e notificações | Asaas/Consumerista |
| Produtos | Whitelist; piloto somente fraldas; recall e devolução | Parcial | Catálogo, moderação e alertas | Jurídico/Segurança do produto |
| Piloto | Fechado, sem dinheiro; fase financeira pequena após gates | Preparação técnica | Checklist e relatório de execução | Todos os aprovadores |
| Acessibilidade | WCAG 2.1 AA com validação manual | Parcial | Auditoria automática e humana | Validador especializado |
| Autoridades | Fluxo 1→2→3; nível 4 avisado; exceção 3→4→5 com ordem | Não implementado | Workflow segregado e auditoria | Jurídico |
| Conteúdo | Licença operacional restrita e sem IA/publicidade externa | Texto antigo incompleto | Termos versionados e moderação | Jurídico/IP |
| Fornecedores | Revisão individual e matriz contratual | Não contratado | Contratos e pareceres anexos | Asaas, Lalamove e operadores |

## Ordem de execução aprovada

1. Consolidar decisões e conflitos — este pacote.
2. Produzir rascunhos jurídicos coerentes com as decisões, ainda pré-operacionais.
3. Implementar alterações técnicas em pacotes pequenos, mantendo flags desligadas.
4. Submeter textos, contratos e relatório preliminar a profissionais.
5. Executar piloto fechado sem dinheiro real.
6. Somente depois considerar piloto financeiro limitado.

## Critérios de rastreabilidade

- Toda implementação deve citar a decisão e o requisito afetado.
- “Decidido” não significa “implementado”, “contratado”, “validado” ou “ativo”.
- A matriz de requisitos não muda de status apenas por esta consolidação.
- Divergência entre interface, código, contrato ou política mantém o gate fechado.

