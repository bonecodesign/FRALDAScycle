# Auditoria de lacunas — acervo aprovado × protótipo

Regra desta auditoria: cada prancha é uma especificação relevante. Telas semelhantes
não se substituem e percentuais/status de sprint não são requisitos do produto.

## Legenda

- **Presente:** existe como tela ou fluxo navegável.
- **Parcial:** aparece resumido, sem todos os estados, ações ou desdobramentos.
- **Ausente:** ainda não existe como experiência navegável própria.

## Site responsivo

| Item do acervo | Situação | Complemento necessário |
|---|---|---|
| Home, busca, resultados, detalhe e login | Presente | Auditoria visual final |
| Mapa imediatamente após resultados | Presente | Manter vínculo visual marcador/anúncio |
| Publicação de anúncio em oito passos | Presente | Fluxo web navegável com tipo, produto, foto obrigatória aprovada, condição, preço e splits, entrega, localização protegida, revisão, rascunho e confirmação |
| Perfil público do vendedor e reputação | Presente | Página web própria conectada ao anúncio, com verificação, reputação, avaliações, indicadores de confiança e anúncios ativos |
| Favoritos | Presente | Página web própria, acesso na navegação e estados loading, preenchido e vazio implementados |
| Impacto socioambiental | Presente | Classificar métricas como simuladas/projetadas |
| Central de ajuda e suporte | Presente | Incluir canais e estados do acervo |
| Tema escuro | Presente | Tema global persistente, alternância navegável e tokens semânticos documentados |

## Aplicativo

| Item do acervo | Situação | Complemento necessário |
|---|---|---|
| Autenticação completa e OTP | Presente | Fluxo conectado com validação inline, erro de credenciais, bloqueio temporário, recuperação, OTP e autenticação offline com nova tentativa |
| Home, busca, mapa e detalhes | Presente | Filtros completos, ordenação e mapa após resultados implementados |
| Publicação em oito passos | Presente | Estados de upload, erro e rascunho |
| Chat protegido | Presente | Manter validação cliente/servidor como regra de produto |
| Proposta, contraproposta e recusa | Presente | Decisão explícita, contraproposta, recusa, protocolo e registro navegável de evidências implementados |
| Reserva temporária | Presente | Regras, cancelamento com motivo, protocolo e expiração automática implementados |
| Pagamento, carteira e reembolso | Presente | Extrato detalhado, cartões tokenizados, reembolso e disputa/mediação implementados |
| Split financeiro | Presente | Venda 8%; troca 5% total; entrega 5%; doação 0% |
| Logística e rastreamento | Presente | Modalidades, reagendamento, prova de entrega e seguro implementados |
| Perfil e reputação | Presente | Perfil, anúncios, favoritos, histórico, avaliações, endereços, configurações, ajuda e impacto individual conectados |
| Notificações | Presente | Filtros, leitura, estado vazio e preferências por canal/assunto, segurança obrigatória e horário silencioso implementados |
| Moderação, denúncia e bloqueio | Presente | Fluxo conectado ao chat, com confirmação, protocolo e histórico preservado |
| Experiência do entregador | Presente | Painel, aceite de rota, rastreamento, prova de entrega, histórico e repasses implementados |
| Estados globais obrigatórios | Presente | Offline, permissão negada e conteúdo removido implementados como experiências navegáveis |

## Painel administrativo

| Item do acervo | Situação | Complemento necessário |
|---|---|---|
| Dashboard, usuários, operações, relatórios e alertas | Presente | Aprofundar ações e filtros |
| RBAC e permissões | Presente | Gestão visual de papéis, matriz de permissões, criação de papéis e registro de alterações implementados |
| Anúncios e produtos | Presente | Catálogo, pesquisa, filtros, revisão, aprovação, pausa e remoção implementados |
| Pagamentos, splits, repasses e disputas | Presente | Fluxos do usuário e módulo administrativo financeiro completos |
| Logística e entregadores | Presente | Fluxos do usuário e módulo operacional administrativo completos |
| Moderação, segurança e antifraude | Presente | Fila, filtros, evidências, decisões fundamentadas e histórico de auditoria implementados |
| Logs, auditoria e webhooks | Presente | Trilha imutável, filtros, exportação, logs técnicos, monitor de eventos e reprocessamento controlado implementados |
| Configurações da plataforma | Presente | Regras do marketplace, taxas aprovadas, comunicação, manutenção, proteção de alterações e integrações navegáveis implementadas |
| 2FA administrativo | Presente | Entrada, confirmação por código, reenvio e sessão administrativa implementados |
| Exportação CSV/PDF/XLSX e agendamento | Presente | Seleção de relatório e período, exportação, confirmação, agendamento e histórico implementados |

## Relatórios, impacto e operação

| Item do acervo | Situação | Complemento necessário |
|---|---|---|
| KPIs e relatórios básicos | Presente | Informar natureza, período, fonte e atualização |
| ETL, Data Warehouse e qualidade de dados | Presente | Pipeline, cargas por domínio, catálogo analítico, linhagem, qualidade, governança e incidentes implementados |
| Previsão de demanda e alertas inteligentes | Presente | Horizonte, região, cenário, demanda por produto, alertas explicáveis, recomendações e revisão humana implementados |
| Impacto completo | Presente | Instituições, empregos, geografia, metas, períodos, fontes, metodologia e exportação implementados |
| Escalabilidade, segurança e observabilidade | Presente | Painel administrativo com alta disponibilidade, capacidade, segurança, observabilidade, alertas, backups e recuperação |
| Expansão e parcerias | Presente | Funil, mapa regional, gestão de parceiros, receitas, aquisição, documentos, riscos e indicadores |
| Hub de inovação e portfólio | Presente | Funil, portfólio, pesquisas, testes com usuários, experimentos, roadmap, backlog e adoção |
| Finalização, suporte e lançamento | Presente | Go-live, checklist, saúde operacional, suporte, adesão, NPS, alertas, treinamentos e plano pós-lançamento |

## Design System e fidelidade

| Item do acervo | Situação | Complemento necessário |
|---|---|---|
| Cores, tipografia, cards, botões e inputs | Presente | Refinamento visual contínuo |
| Componentes avançados | Presente | Date picker, upload por clique/arraste, accordion, tooltips acessíveis, tabela com busca/ordenação e paginação |
| Estados de componentes | Presente | Referência navegável por grupo com padrão, hover, pressionado, foco, loading, sucesso, erro, vazio e desabilitado |
| Temas claro e escuro | Presente | Cobertura global com preferência persistida e página navegável de tokens |
| Breakpoints oficiais | Presente | Laboratório navegável valida mobile, tablet, desktop e wide com grids e gutters oficiais |
| WCAG 2.1 AA | Presente | Auditoria navegável de contraste, teclado, foco visível, leitores de tela, toque mínimo e textos escaláveis |
| Motion oficial | Presente | Laboratório navegável com durações, curvas, microinterações e redução de movimento |

## Ordem recomendada de execução

1. Completar estados e ações pequenas nas telas existentes.
2. Completar perfil, reputação, favoritos, carteira e logística.
3. Validar continuamente os módulos administrativos financeiro e logístico na regressão.
4. Criar experiência do entregador.
5. Criar inteligência, impacto, segurança e observabilidade.
6. Criar expansão, parcerias, inovação e lançamento.
7. Auditoria final de responsividade, acessibilidade e fidelidade visual concluída estruturalmente. A regressão automatizada foi aprovada em 56 de 56 verificações; resta somente o aceite visual humano do render em navegador e dispositivos reais.

## Fechamento da auditoria

A consolidação final está registrada em `RELATORIO_AUDITORIA_FINAL.md`. Não há lacunas funcionais conhecidas na matriz automatizada. Integrações externas, dados reais, homologação em dispositivos e publicação pertencem à etapa de produção.
