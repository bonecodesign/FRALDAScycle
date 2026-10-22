# Central de Controle — auditoria inicial (22/10/2026)

## Objetivo
Consolidar os módulos administrativos existentes, sem criar painel paralelo, contratar fornecedores, ativar integrações ou alterar produção. Esta é uma auditoria documental inicial, não homologação funcional.

## Inventário confirmado na main
- `platform/apps/admin/index.html`: dashboard com resumo operacional e dados persistidos.
- `platform/apps/admin/admin-overview.js`: consulta API, formatação de indicadores, tratamento explícito de 401/403 e indisponibilidade sem dados fictícios.
- `platform/apps/admin/finance.html`: consulta financeira somente leitura, sem transferências.
- `platform/apps/admin/operations.html`: fila de suporte e filtros; encerramento não cancela nem reembolsa.
- `platform/apps/admin/alerts.html`: pendências derivadas do banco; resolução ocorre no fluxo operacional correspondente.
- `platform/apps/admin/moderation.html`: moderação e recursos com persistência.
- `platform/apps/admin/data.html`: dados transacionais e CSV existentes; ETL, warehouse, qualidade e linhagem pendentes.
- `platform/apps/admin/infrastructure.html`: health/ready e prontidão PostgreSQL; restauração de backup e telemetria externa não comprovadas.
- `platform/apps/admin/security.html`, `launch.html`, `reports.html`: arquivos identificados, comportamento ainda requer inspeção detalhada.

## Proposta de consolidação
1. Visão geral: KPIs reais, atualização e carimbo de origem/período.
2. Comercial: anúncios, vendas, trocas e doações; não reintroduzir reserva como funcionalidade.
3. Financeiro: conciliação, taxas e repasses; ações financeiras protegidas e auditáveis.
4. Operações: suporte, entregas e instituições; preservar fluxos existentes.
5. Segurança: moderação, alertas e trilhas de auditoria, com permissões por papel.
6. Atendimento: fila, responsável, SLA e encaminhamento, sem cancelamento/reembolso implícito.

## Restrições de execução
- Nenhum push direto na main: branch e PR, revisão e CI antes de merge.
- Não publicar, contratar, gravar credenciais ou habilitar tráfego real.
- Não fabricar métricas; indisponibilidade deve ser explícita.
- Preservar regras comerciais aprovadas, sobretudo ausência de reserva e bloqueios de cancelamento.
- PR #115 sobre ativação explícita de provedores deve ser considerado, sem antecipar sua integração.
- Verificar visibilidade do repositório: consulta retornou 'public', divergente da diretriz de privacidade.

## Próxima rodada de auditoria
- Mapear rotas e endpoints por tela e perfis autorizados.
- Confrontar `requirements-matrix.json` e documentação com comportamento implementado.
- Executar testes existentes e registrar resultados, sem afirmar aprovação antecipadamente.
- Propor primeiro incremento pequeno da Central, preferencialmente somente leitura.
- Medir avanço apenas com evidências; relatório de 09/10 aponta 8/70 requisitos formalmente concluídos, 50 parciais e 12 bloqueados.
