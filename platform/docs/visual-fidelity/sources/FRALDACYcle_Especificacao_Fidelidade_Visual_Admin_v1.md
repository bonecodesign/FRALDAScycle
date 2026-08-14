# FraldaCycle — Especificação de Fidelidade Visual do Admin v1

## Base e objetivo

- Repositório: `bonecodesign/FRALDAScycle`
- Base de continuidade: `main` no commit `5421eb595ce5814fd60ebc3aaa8d8a8e727958a5`
- Superfície: painel administrativo, com prioridade para autenticação, Dashboard, Usuários, Anúncios, Doações, Pedidos, Moderação, Financeiro, Logística, Relatórios e Configurações.
- Objetivo: aproximar o Admin das pranchas oficiais, preservando as capacidades posteriores e tornando clara a separação entre operação do piloto e módulos futuros.
- Este documento especifica alterações futuras; não altera a `main`, não concede acesso real, não ativa integrações e não autoriza publicação.

## Hierarquia de decisão

1. Segurança, privacidade, documentos jurídicos e controle de acesso.
2. Regras de negócio vigentes e necessidades operacionais do piloto.
3. Identidade visual e pranchas oficiais.
4. Implementação atual, quando não conflitar com os itens anteriores.

Não restaurar: Reserva; boleto; cartão de débito; fraldas reutilizáveis; números fictícios como métricas reais; credenciais demonstrativas em produção; integrações ou operações reais sem homologação.

## Princípio de organização

A prancha original define o núcleo visual do Admin. As áreas acrescentadas depois não precisam ser apagadas, mas devem deixar de competir com a operação diária.

Organizar a navegação em três camadas:

1. **Operação do piloto** — visível e prioritária;
2. **Gestão e controle** — acessível conforme perfil;
3. **Expansão futura** — identificada como planejada, desativada ou demonstrativa até existir capacidade real.

Nenhum módulo futuro deve aparentar estar ativo apenas porque possui uma tela estática.

## Sistema visual obrigatório

| Elemento | Especificação |
|---|---|
| Tipografia | Poppins em títulos e Inter em textos, tabelas, formulários e controles |
| Paleta | Verde da marca, branco e neutros claros; cores semânticas reservadas a estados reais |
| Espaçamento | Escala base de 4 px; densidade de desktop sem sacrificar leitura |
| Raios | 4, 8, 12, 16 e 24 px; cards principais com 12 ou 16 px |
| Sombras | Sutis; hierarquia por superfície e espaçamento, não por contornos pesados |
| Ícones | Vetoriais e lineares, da mesma família, sem caracteres Unicode improvisados |
| Tabelas | Cabeçalho fixo quando útil, alinhamento consistente, ações previsíveis e colunas responsivas |
| Gráficos | Legenda, período, unidade, fonte e estado vazio; não depender somente de cor |
| Movimento | 150–250 ms; menus, drawers, filtros e confirmações; respeitar `prefers-reduced-motion` |
| Acessibilidade | WCAG 2.1 AA, teclado, foco visível, rótulos, contraste e alvos mínimos de 44×44 px |

## Estrutura global

### Barra lateral

Primeiro nível recomendado:

1. `Dashboard`;
2. `Usuários`;
3. `Anúncios`;
4. `Doações`;
5. `Pedidos`;
6. `Mensagens`;
7. `Denúncias`;
8. `Financeiro`;
9. `Logística`;
10. `Relatórios`;
11. `Configurações`.

Regras:

- manter a ordem e os nomes centrais da prancha sempre que não houver conflito funcional;
- agrupar permissões, auditoria, antifraude, integrações e webhooks dentro de Gestão/Configurações ou Segurança, conforme o perfil;
- agrupar dados, previsões e inteligência dentro de Relatórios;
- manter expansão, parcerias, inovação e lançamento em grupo `Planejamento`, visualmente secundário;
- permitir recolhimento da barra sem ocultar rótulos acessíveis;
- indicar item ativo por mais de um atributo visual;
- não exibir ao usuário módulos sem permissão;
- badges devem representar pendências reais ou dados sintéticos explicitamente identificados.

### Barra superior

- título e contexto da página;
- busca administrativa quando houver escopo claro;
- ambiente visível: `Demonstração`, `Homologação` ou `Produção`;
- notificações administrativas com contagem confiável;
- perfil, função e encerramento de sessão;
- alternância de tema pode permanecer secundária;
- nenhuma credencial, token ou dado sensível deve aparecer no cabeçalho.

### Área de conteúdo

- largura máxima e gutters consistentes;
- breadcrumb somente onde ajudar a orientação;
- título, descrição curta, ações primária/secundária e filtros em ordem previsível;
- estados de carregamento, vazio, erro, acesso negado e dados indisponíveis;
- ações destrutivas separadas das ações rotineiras.

## Telas e estados finais esperados

### 1. Login administrativo

- tela exclusiva do Admin, sem mistura com login de compradores/vendedores;
- logotipo oficial, título `Acesso administrativo` e explicação curta;
- campos de e-mail/usuário e senha com rótulos permanentes;
- mostrar/ocultar senha com ícone vetorial e nome acessível;
- CTA principal `Entrar`;
- recuperação de acesso e suporte administrativo;
- estados de carregamento, credencial inválida, bloqueio temporário e indisponibilidade;
- suporte visual a 2FA quando ativado;
- nunca incluir senha padrão ou credencial funcional em código, documentação visual ou interface de produção.

### 2. Dashboard

Hierarquia da prancha a preservar:

1. título, período e estado do ambiente;
2. métricas principais;
3. gráfico operacional;
4. atividade recente;
5. pedidos e alertas;
6. atalhos administrativos.

Cards prioritários do piloto:

- usuários cadastrados;
- anúncios ativos;
- transações por modalidade;
- volume financeiro processado;
- taxa de aprovação/conclusão;
- doações concluídas;
- denúncias ou disputas pendentes;
- entregas em acompanhamento.

Requisitos:

- limitar a grade para evitar estouro horizontal;
- mostrar período, variação e unidade;
- métricas sintéticas devem trazer `Simulado` no próprio card;
- não apresentar `+12 mil`, `+50 mil`, `+300 cidades` ou outros números conceituais como realidade;
- gráfico deve possuir legenda, descrição textual e estado sem dados;
- alertas críticos não podem competir visualmente com indicadores informativos.

### 3. Usuários, papéis e acessos

- tabela com nome, identificação mínima, perfil, verificação, reputação, status e data relevante;
- filtros por status, papel, verificação e período;
- detalhe do usuário em página ou drawer consistente;
- ações conforme permissão: revisar, restringir, suspender, reativar e consultar histórico;
- toda ação sensível exige motivo, confirmação e registro de auditoria;
- dados pessoais mascarados por padrão;
- papéis claros: administrador, operação, suporte, moderação, financeiro e somente leitura, conforme contrato vigente;
- não permitir escalada de privilégio por mera alteração visual no cliente.

### 4. Anúncios e produtos

- lista com foto, modalidade, marca/modelo, categoria, tamanho, condição do pacote, anunciante, status e data;
- categorias permitidas: fraldas descartáveis infantis e para piscina;
- venda e troca: pacote fechado;
- doação: pacote fechado ou aberto, com unidades sem uso e condição informada;
- estados: Disponível, Indisponível e Finalizado, além dos estados de moderação necessários;
- filtros e busca persistentes durante análise;
- detalhe com histórico de alterações e evidências sintéticas em demonstração;
- ações de moderação com motivo obrigatório;
- nenhuma ação ou documento deve usar `Reserva`.

### 5. Doações

- manter entrada própria na navegação, como previsto na prancha;
- distinguir pacote aberto e fechado;
- informar quantidade estimada/confirmada de unidades sem uso;
- acompanhar publicação, análise, combinação protegida, entrega/retirada e conclusão;
- não representar doação como venda de valor zero;
- qualquer custo de entrega ou taxa permitida deve aparecer separado e explicado;
- indicadores de impacto devem ser verificáveis ou marcados como simulados.

### 6. Pedidos e operações

- visão unificada com modalidade: Compra, Troca ou Doação;
- mostrar identificador, participantes mascarados, anúncio, valor, comissão/taxa, entrega, pagamento e status;
- linha do tempo auditável do pedido;
- filtros por modalidade, status, período, meio de pagamento e forma de recebimento;
- meios permitidos: Pix, cartão de crédito e saldo FraldaCycle;
- não apresentar boleto ou cartão de débito;
- item fica indisponível no momento definido pelo contrato vigente, sem estado `Reservado`;
- detalhes exatos de contato/entrega devem respeitar a liberação posterior ao pagamento protegido.

### 7. Mensagens e suporte

- fila organizada por tipo, urgência, responsável e SLA interno;
- separar conversa entre usuários, mensagens do sistema e atendimento;
- evidenciar quando o chat operacional foi liberado;
- alertar para tentativas de pagamento externo ou compartilhamento indevido de dados;
- histórico somente leitura quando necessário à investigação;
- ações administrativas sempre registradas;
- não simular leitura irrestrita de mensagens privadas sem base jurídica e permissão.

### 8. Denúncias, disputas e antifraude

- entrada `Denúncias` deve permanecer clara na navegação central;
- filas separadas por anúncio, usuário, pagamento, entrega e conteúdo;
- prioridade, prazo, evidências, responsável e status;
- decisões com motivo, evidências e possibilidade de revisão conforme política;
- cores semânticas acompanhadas de texto;
- padrões antifraude e scores devem ser explicáveis para a equipe autorizada;
- estados sintéticos não podem acionar bloqueios ou comunicações reais.

### 9. Financeiro

- resumo de transações, comissões, taxas de troca, entrega, reembolso e disputa;
- composição financeira visível por pedido;
- percentuais conforme regras vigentes, sem inferir valores não aprovados;
- exportação apenas para perfis autorizados e com dados protegidos;
- cartões e identificadores financeiros mascarados;
- conciliação, estorno e pendência com status textual;
- integrações externas devem aparecer `Não configurado` ou `Bloqueado` enquanto não homologadas;
- nenhum botão demonstrativo pode executar transação real.

### 10. Logística

- modalidades: retirada combinada e entrega parceira;
- parceiros/tipos: motoboy, carro e bicicleta, conforme disponibilidade futura;
- tabela ou kanban com coleta, em rota, entregue, falha e disputa;
- prazo estimado, custo, capacidade/restrição e atualização de status;
- mapas não podem ser necessários para concluir uma tarefa administrativa;
- dados pessoais e endereços exibidos somente quando necessários e autorizados;
- deixar explícito que a integração é simulada ou não configurada até homologação.

### 11. Relatórios, dados e inteligência

- consolidar relatórios operacionais, financeiros, impacto, suporte, moderação e logística;
- filtros de período e modalidade consistentes;
- mostrar fonte, atualização, unidade e definição das métricas;
- distinguir dado real, sintético, estimado e indisponível;
- previsões não devem ser exibidas como fatos;
- exportações respeitam permissão, mascaramento e trilha de auditoria;
- estados vazios orientam o próximo passo sem inventar informação.

### 12. Configurações, segurança e integrações

- separar configurações gerais, catálogo, regras, acesso, segurança e integrações;
- alterações de regras de negócio exigem permissão elevada e confirmação;
- 2FA, sessões, políticas de senha e auditoria em área própria;
- webhooks e provedores exibem estado, última verificação e ambiente, nunca segredos;
- credenciais devem vir de armazenamento seguro, não de HTML ou JavaScript cliente;
- integrações bloqueadas permanecem visual e funcionalmente bloqueadas;
- ação destrutiva exige confirmação contextual, motivo e registro.

### 13. Planejamento e módulos futuros

Áreas como expansão, parcerias, inovação, previsões e lançamento podem permanecer documentadas, porém:

- agrupadas fora do núcleo operacional;
- com rótulo `Planejado`, `Demonstração` ou `Não configurado`;
- sem métricas que pareçam produção;
- sem CTAs que provoquem operação externa;
- ocultas por feature flag quando não forem úteis ao piloto;
- não devem aumentar artificialmente a percepção de completude do produto.

## Padrões de tabela e filtros

- busca, filtros e ordenação devem compartilhar a mesma linguagem entre módulos;
- filtros ativos aparecem como chips removíveis;
- ação `Limpar filtros` não pode apagar dados;
- paginação informa posição e total quando conhecido;
- seleção em massa somente onde segura e necessária;
- ações por linha em menu consistente, com rótulos textuais;
- colunas secundárias podem recolher em telas estreitas, sem ocultar status e ação principal;
- tabelas devem possuir alternativa navegável em viewport reduzido.

## Responsividade

### Desktop amplo

- barra lateral expandida;
- grade de métricas com no máximo quatro cards por linha, conforme largura;
- gráfico e atividade recente podem compartilhar a linha sem overflow;
- tabelas usam o espaço disponível sem texto excessivamente esticado.

### Laptop e tablet

- barra lateral recolhível;
- cards em duas colunas;
- filtros em drawer ou linha quebrável;
- ações principais permanecem visíveis.

### Mobile administrativo

- não precisa reproduzir toda a densidade do desktop;
- navegação em drawer acessível;
- cards em uma coluna;
- tabelas transformadas em cartões ou rolagem controlada com contexto;
- nenhuma página pode gerar overflow horizontal global em 320 px;
- ações sensíveis não devem depender de gesto oculto.

## Estados e linguagem

Todos os módulos críticos devem possuir:

- carregamento;
- vazio;
- erro;
- acesso negado;
- conexão ausente;
- dado não configurado;
- sucesso e confirmação;
- dado sintético claramente marcado.

Usar linguagem direta, respeitosa e operacional. Evitar jargão técnico desnecessário, culpa automática do usuário e promessas de segurança absoluta.

## Critérios de aceite visual e funcional

### Identidade e composição

- [ ] Poppins e Inter aplicadas conforme função.
- [ ] Paleta e tokens compartilhados com Site e App.
- [ ] Ícones Unicode substituídos por SVGs da família aprovada.
- [ ] Dashboard sem overflow e com hierarquia equivalente à prancha.
- [ ] Tabelas, filtros, drawers e formulários compartilham padrões.

### Navegação

- [ ] Núcleo da prancha visível no primeiro nível.
- [ ] Módulos posteriores agrupados sem competir com o piloto.
- [ ] Item ativo e permissões são perceptíveis e acessíveis.
- [ ] Nenhum módulo bloqueado aparenta estar operacional.

### Segurança e operação

- [ ] Login e senha obrigatórios; 2FA preparado quando vigente.
- [ ] Perfis sem permissão não veem nem executam ações restritas.
- [ ] Ações sensíveis exigem confirmação, motivo e auditoria.
- [ ] Dados pessoais e financeiros aparecem mascarados por padrão.
- [ ] Nenhuma credencial ou segredo aparece na interface ou no repositório.

### Regras do FraldaCycle

- [ ] Não existe `Reserva` em interface, status ou documentação operacional.
- [ ] Não existem boleto ou cartão de débito.
- [ ] Somente fraldas descartáveis infantis e para piscina.
- [ ] Venda e troca exigem pacote fechado; doação aceita aberto ou fechado.
- [ ] Chat e dados de entrega respeitam a etapa protegida.
- [ ] Motoboy, carro e bicicleta aparecem apenas como opções homologáveis/simuladas.

### Dados e acessibilidade

- [ ] Toda métrica informa período, unidade, origem e condição real/sintética.
- [ ] Gráficos possuem descrição e não dependem somente de cor.
- [ ] Contraste, foco, teclado e leitores de tela atendem WCAG 2.1 AA.
- [ ] Viewports de 320, 768, 1024, 1280 e 1440 px não apresentam overflow global.

## Testes mínimos para implementação no Codex

1. teste de contrato da navegação e dos agrupamentos;
2. teste de ausência de `Reserva`, boleto, débito e credenciais;
3. teste de RBAC para rotas, menus e ações;
4. teste de marcação obrigatória de dados sintéticos;
5. teste de estados vazio, erro, bloqueado e não configurado;
6. teste de acessibilidade automatizado e inspeção por teclado;
7. screenshots nas cinco larguras de referência;
8. teste de overflow do Dashboard, tabelas e drawers;
9. comparação visual com a prancha do Admin;
10. suíte completa da plataforma e 56 verificações do protótipo;
11. builds de Site, App, Admin e API;
12. CI integralmente verde antes de merge.

## Ordem recomendada de implementação

1. tokens, tipografia e família de ícones;
2. shell do Admin: login, barra lateral, barra superior e área de conteúdo;
3. Dashboard e comportamento responsivo;
4. reorganização do menu e agrupamento dos módulos futuros;
5. tabelas, filtros, formulários, modais e estados compartilhados;
6. Usuários, Anúncios, Doações, Pedidos e Denúncias;
7. Financeiro, Logística, Relatórios e Configurações;
8. RBAC, mascaramento, auditoria e sinalização de ambiente;
9. testes visuais, acessibilidade e regressão;
10. PR em rascunho e merge apenas com CI verde.

## Resultado esperado

Após implementação e validação:

- fidelidade estimada do Admin: de aproximadamente 80% para 93–96%;
- navegação equivalente à prancha no núcleo operacional;
- preservação das capacidades posteriores sem poluição visual;
- leitura inequívoca do que é real, sintético, bloqueado ou futuro;
- acesso administrativo seguro e coerente com o estágio do FraldaCycle.

Esta estimativa só deve atualizar a fidelidade geral depois que código, screenshots, acessibilidade, testes e CI comprovarem a implementação.
