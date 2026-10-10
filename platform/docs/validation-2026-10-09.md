# Validações locais após o PR #86

Data de referência do usuário: 9 de outubro de 2026, America/Sao_Paulo. A execução avançou para 10 de outubro em UTC. Evidências estruturadas em `validation-2026-10-09.json`. Esta rodada retoma os testes HTTP mediante autorização do usuário; o adiamento registrado anteriormente não se aplica à seleção executada aqui.

## Resultados comprovados

| Verificação | Resultado | Limite |
| --- | --- | --- |
| Suíte completa `npm test` | 438 encontrados, 427 aprovados, zero falhas, 11 não executados sem URL do banco dedicado | Os 11 foram executados e aprovados separadamente pelo executor PostgreSQL; 438 testes distintos aprovados entre as duas execuções |
| `npm run test:listing-postgres` | 11 aprovados, zero falhas, zero skips; 45 migrações | Banco temporário com dados sintéticos, removido ao final |
| Chat HTTP com PostgreSQL | Consulta, envio e controle de abertura comprovados | Bloqueio antes de `paid`, valor divergente, referência ausente, terceiros, cancelamento, reembolso e doação; sessão fictícia no teste HTTP |
| Beta integrada em PostgreSQL e Chromium | Aprovada dentro da suíte completa | Serviços reais locais, dados e eventos financeiros/mídia sintéticos; sem fornecedor, entrega física ou repasse |
| Backup/restauração | `pg_dump` e `pg_restore` reais; igualdade de tabelas, sequências e migrações; segunda restauração e isolamento | Somente bancos descartáveis, arquivo temporário com permissão 0600 |
| Navegador | Chrome 151; Space, Tab e Enter; nove conjuntos de telas em 320, 375, 768 e 1280 pixels | Sem overflow nos conjuntos verificados; contratos de rótulos verificados; não substitui leitor de tela ou auditoria WCAG completa |
| Protótipo | 83/83 verificações aprovadas | Contratos automatizados; não é comparação visual completa com o acervo |
| Sintaxe de produção | 119 arquivos aprovados | Não mede comportamento em infraestrutura real |
| Contêineres | Builds de API, site, app e admin aprovados; Compose válido | Imagens locais, sem publicação em registry ou deployment |
| Interfaces nos contêineres | HTTP 200 e modo production em `/site/home`, `/site/search`, `/app/home`, `/courier/home` e `/admin/login` | Apenas carregamento das rotas; não comprova API de produção ou jornada financeira real |
| Manifestos de fornecedores e piloto | Validadores estruturais aprovados | Validade do documento não significa fornecedor contratado nem piloto aprovado |
| `production:doctor` | `ready: false` | Configuração real ausente; produção permanece bloqueada |

O navegador cobriu preferências operacionais, Premium sem cobrança, chat persistido e moderação, solicitação de alteração de endereço, privacidade sem exclusão, denúncias/recursos de avaliações, representação institucional, revisão administrativa e doação com retirada, coleta e aprovação do recebedor. Cadastro, recuperação e MFA possuem testes de serviço, concorrência em PostgreSQL, contratos HTTP e lógica de interface; esta rodada não comprova todos esses fluxos completos pela interface real.

## Correções da validação

- O HTTP de publicação agora usa uma conta com declaração de maioridade e também comprova o bloqueio 403 para conta sem declaração. A exigência de segurança da API foi preservada.
- Contratos antigos do protótipo foram atualizados para fotos do anúncio, solicitação de código recebida, envio para revisão e sessão administrativa autenticada. Nenhum bypass foi introduzido para fazer os testes passarem.
- Cenários da beta foram adequados às fotos obrigatórias, anúncios em revisão e MFA administrativo real, usando o código da fila sintética para confirmar o desafio.
- O executor da beta admite PostgreSQL 16 descartável em Docker quando a instalação nativa está ausente; backup/restauração usam as ferramentas reais desse mesmo contêiner. A prontidão aguarda TCP, evitando o servidor provisório de inicialização.
- A montagem da API de teste inclui o serviço de instituições necessário à jornada. O limite de requisições do cenário integrado foi elevado para 1000 apenas na configuração de teste; os testes específicos de rate limit continuam na suíte e a configuração de produção permanece intacta.
- A auditoria automatizada de rótulos exclui inputs hidden, que não possuem `labels`, e aceita nomes acessíveis via ARIA. Erros de avaliação do navegador agora mostram contexto útil.
- O build da API aceita certificado opcional de proxy por secret mount de BuildKit, com validação TLS ativa. O certificado da sessão não entra nas camadas da imagem.

## Pendências para ativação

1. Homologar pagamento, split, taxas, estorno, disputa, conciliação e webhooks com o fornecedor real.
2. Homologar logística externa, processamento do frete, mídia, geocodificação, e-mail/SMS e notificações. Os testes atuais comprovam contratos e cenários sintéticos.
3. Configurar banco, sessões, integrações, segredos, limitação distribuída e telemetria no ambiente real; validar domínio, TLS, migração, restauração, observabilidade, rollback e carga nesse ambiente.
4. Percorrer autenticação e publicação/checkout completos nas interfaces reais e comparar todas as telas com o acervo aprovado. Esta rodada não atribui percentual de fidelidade visual.
5. Executar piloto humano, leitor de tela e aparelhos físicos; confirmar responsável e substituto pelo rollback. O piloto histórico preserva 16 aprovados, uma falha e quatro não executados; não foi convertido automaticamente em aprovação.
6. Publicar estas correções e executar o CI do GitHub. O PR #86 já foi incorporado; esta rodada foi executada no workspace e não equivale a uma execução remota do CI.

Conclusão formal dos requisitos permanece 8/70 (11,43%) e cobertura parcial/concluída 58/70 (82,86%). Suíte aprovada não encerra automaticamente dependências externas ou homologação humana.
