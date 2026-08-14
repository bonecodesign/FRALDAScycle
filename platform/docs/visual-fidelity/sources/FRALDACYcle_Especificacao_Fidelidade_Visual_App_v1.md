# FraldaCycle — Especificação de Fidelidade Visual do App v1

## Base e objetivo

- Repositório: `bonecodesign/FRALDAScycle`
- Base de continuidade: `main` no commit `5421eb595ce5814fd60ebc3aaa8d8a8e727958a5`
- Superfície: aplicativo do usuário, com prioridade para Splash, Onboarding, Home, Busca, Detalhe, Publicação, Checkout, Entrega, Chat e Perfil
- Objetivo: elevar a fidelidade às pranchas oficiais, preservando as decisões posteriores de produto, segurança e operação.
- Este documento especifica alterações futuras; não altera a `main`, não autoriza integrações reais e não autoriza publicação.

## Hierarquia de decisão

1. Regras de negócio vigentes e documentos jurídicos.
2. Segurança transacional e proteção dos usuários.
3. Identidade visual e pranchas oficiais.
4. Implementação atual, quando não conflitar com os itens anteriores.

Não restaurar: Reserva; boleto; cartão de débito; fraldas reutilizáveis; números fictícios como resultados reais; chat pré-pagamento para combinar entrega; transações financeiras fora da plataforma.

## Sistema visual obrigatório

| Elemento | Especificação |
|---|---|
| Tipografia | Poppins em títulos e Inter em textos, formulários e controles |
| Paleta | Verde da marca, branco e neutros claros; cores semânticas apenas para sucesso, atenção, erro e informação |
| Espaçamento | Escala base de 4 px, com margens laterais consistentes em todas as telas |
| Raios | 4, 8, 12, 16 e 24 px; cards e painéis principais com 16 px |
| Sombras | Suaves e funcionais, sem contornos pesados |
| Ícones | Vetoriais, lineares, da mesma família, caixa óptica e espessura |
| Imagens | Produtos reais, bem iluminados, sem texto incorporado à fotografia e com proporção consistente |
| Movimento | 150–300 ms; fade, push, elevação e confirmação suave; respeitar `prefers-reduced-motion` |
| Acessibilidade | WCAG 2.1 AA, foco visível, leitores de tela, alvos de toque mínimos de 44×44 px |

## Estrutura global do App

### Cabeçalho

- preservar saudação personalizada na Home, sem depender de nome fixo em produção;
- busca deve ser o elemento funcional predominante abaixo da saudação;
- notificações e favoritos usam ícones vetoriais com rótulo acessível;
- títulos de telas internas devem manter posição, peso e espaçamento consistentes;
- voltar, fechar e ajuda não podem mudar de posição arbitrariamente entre jornadas semelhantes.

### Navegação inferior

Manter cinco destinos:

1. `Início`;
2. `Buscar`;
3. `Publicar` — ação central visualmente destacada, sem competir com alertas críticos;
4. `Chat`;
5. `Perfil`.

Requisitos:

- ícone e texto em todos os itens;
- estado ativo inequívoco por cor, forma e/ou peso, não apenas por cor;
- área de toque mínima de 44×44 px;
- respeitar a área segura do aparelho;
- sem caracteres Unicode como `⌂`, `⌕`, `♡` ou `▣`.

## Telas e estados finais esperados

### 1. Splash

- logo oficial centralizado e em proporção aprovada;
- nome `FraldaCycle` sem quebra inadequada;
- fundo limpo, preferencialmente verde da marca ou branco conforme a prancha vigente;
- carregamento discreto e acessível;
- nenhuma métrica, oferta ou ação concorrente;
- transição suave para onboarding ou autenticação.

### 2. Onboarding

- preservar a mensagem `Pequenas escolhas, grandes mudanças`;
- apresentar em até três passos: encontrar fraldas, negociar com proteção e receber/retirar;
- ilustrações ou fotografias devem compartilhar a mesma linguagem;
- indicadores de página claros;
- ações `Pular` e `Continuar` consistentes;
- último passo usa CTA `Começar`;
- não prometer resultados ou cobertura geográfica ainda não comprovados.

### 3. Login, cadastro e recuperação

- campos com rótulos permanentes, ajuda contextual e erro junto ao campo;
- mostrar/ocultar senha com ícone vetorial e nome acessível;
- CTA primário único por estado;
- estados de carregamento, sucesso, erro, bloqueio e conexão ausente;
- consentimentos jurídicos visíveis no cadastro;
- nenhuma credencial demonstrativa deve parecer válida em produção.

### 4. Home

Ordem visual:

1. saudação e ações de conta;
2. busca por fraldas, marcas e tamanhos;
3. atalhos `Trocar`, `Doar`, `Comprar` e `Favoritos`;
4. faixa de categorias/tamanhos;
5. anúncios próximos ou recomendados;
6. bloco de confiança/impacto, se houver dados corretamente identificados.

#### Categorias obrigatórias

- `Infantis`;
- `Para piscina`;
- tamanhos `RN`, `P`, `M`, `G`, `XG` e demais tamanhos válidos já aprovados no catálogo.

A faixa deve ser horizontalmente rolável em telas estreitas, com estado selecionado visível e sem cortar rótulos. Ela não deve incluir fraldas reutilizáveis.

#### Cards de anúncio

Cada card deve apresentar, conforme aplicável:

- foto;
- modalidade: Venda, Troca ou Doação;
- marca e modelo;
- tamanho;
- quantidade;
- preço ou indicação `Doação`;
- distância aproximada;
- avaliação/reputação;
- estado: Disponível, Indisponível ou Finalizado;
- favorito com estado selecionado acessível.

Venda e troca: somente pacote fechado. Doação: pacote fechado ou aberto, sempre com unidades sem uso e condição higiênica informada.

### 5. Busca e filtros

- busca persistente no topo;
- chips de filtros ativos removíveis;
- filtros: modalidade, categoria, tamanho, marca/modelo, distância, preço, condição do pacote e entrega/retirada;
- `Aplicar filtros` como ação principal e `Limpar` como secundária;
- quantidade de resultados atualizada;
- estados de carregamento, vazio, erro e conexão ausente;
- mapa, caso permaneça, não pode ser necessário para concluir a busca.

### 6. Detalhe do anúncio

Hierarquia:

1. galeria do produto;
2. modalidade e disponibilidade;
3. marca/modelo, tamanho e quantidade;
4. preço e composição transparente dos valores;
5. regras do pacote;
6. localização aproximada e opções de recebimento;
7. vendedor/doador e reputação;
8. descrição;
9. segurança da plataforma;
10. CTA contextual fixo ou facilmente alcançável.

Antes da confirmação, o usuário deve visualizar claramente:

- valor do item;
- percentual/valor destinado à plataforma;
- eventual valor de entrega;
- total;
- proteção oferecida pela transação interna.

O endereço exato e o chat para combinar a entrega não devem ser liberados antes do pagamento protegido quando houver transação financeira.

### 7. Publicação em oito etapas

Manter a jornada já existente, com indicador de progresso textual e visual. Agrupar os campos na seguinte lógica:

1. modalidade: vender, trocar ou doar;
2. categoria: infantil ou piscina;
3. marca/modelo e tamanho;
4. quantidade e condição do pacote;
5. fotos;
6. preço ou preferência de troca;
7. recebimento: retirada ou entrega parceira;
8. revisão e publicação.

Regras visuais e funcionais:

- doação permite pacote aberto; venda e troca exigem pacote fechado;
- erros aparecem na etapa correspondente, sem apagar dados já preenchidos;
- salvar rascunho, se vigente, deve ser distinguido de publicar;
- revisão final resume todas as informações e regras;
- não usar o termo `Reserva` em nenhum estado;
- item iniciado em jornada válida torna-se indisponível conforme o contrato atual.

### 8. Compra e checkout protegido

Sequência visual:

1. resumo do anúncio;
2. escolha entre retirada e entrega;
3. seleção de parceiro disponível: motoboy, carro ou bicicleta;
4. endereço ou ponto de retirada;
5. pagamento;
6. revisão de valores;
7. confirmação.

Meios comunicados: Pix, cartão de crédito ou saldo FraldaCycle. Nunca boleto ou cartão de débito.

O resumo financeiro deve separar item, comissão/taxa da plataforma, entrega e total. Após pagamento aprovado, apresentar confirmação e liberar o chat necessário à coordenação da entrega ou retirada.

### 9. Troca

- mostrar claramente o item oferecido e o item solicitado;
- apresentar os 5% totais da transação, divididos em 2,5% para cada participante, conforme regra aprovada;
- evitar linguagem de simples conversa informal: a proposta deve ter estado, prazo e confirmação;
- chat operacional somente no momento permitido pelo fluxo protegido;
- estados: proposta enviada, recebida, contraproposta, aceita, recusada, expirada e concluída;
- não usar `Reserva` como sinônimo de proposta ou indisponibilidade.

### 10. Doação

- diferenciar visualmente doação de venda e troca;
- indicar se o pacote é aberto ou fechado;
- confirmar que as unidades não foram usadas e estão em condição higiênica;
- informar retirada ou entrega parceira;
- em doações sem cobrança do item, deixar explícito se há custo de entrega e/ou taxa permitida pelas regras vigentes;
- não apresentar preço fictício ou tachado.

### 11. Entrega e rastreamento

- escolha visual entre retirada combinada e parceiro de entrega;
- parceiros: motoboy, carro ou bicicleta, conforme disponibilidade;
- card da opção mostra prazo estimado, valor, capacidade/restrição e status;
- rastreamento usa linha do tempo: pagamento aprovado, preparação, coletado, em rota, entregue;
- mostrar somente informações necessárias e autorizadas do parceiro;
- confirmação de recebimento clara;
- suporte e disputa acessíveis sem competir com o status principal.

### 12. Chat protegido

- antes da liberação, exibir estado bloqueado com explicação simples: o chat operacional é liberado após a etapa protegida aplicável;
- após liberação, cabeçalho mostra anúncio, participante e estado da transação;
- mensagens do sistema diferem visualmente das mensagens dos usuários;
- atalhos permitidos para entrega, retirada, ajuda e disputa;
- alertas contra pagamento externo e compartilhamento indevido de dados;
- anexos, se mantidos, com tamanho, tipo e estado de envio claros;
- estados de mensagem enviados, entregues e falha, sem depender somente de cor.

### 13. Pagamento, carteira, reembolso e disputa

- manter linguagem de confiança sem afirmar garantias não previstas juridicamente;
- status sempre acompanhado de texto: pendente, aprovado, recusado, estornado ou em análise;
- cartões mascarados e sem dados sensíveis em demonstrações;
- reembolso apresenta motivo, valor, destino e prazo estimado;
- disputa usa etapas e documentos sintéticos em testes;
- nenhum estado demonstrativo pode aparentar operação financeira real.

### 14. Perfil e reputação

- foto/avatar, nome, verificação, nota e tempo de plataforma;
- atalhos para meus anúncios, compras, trocas, doações, favoritos, carteira, endereços, impacto, ajuda e configurações;
- reputação baseada em critérios explicáveis;
- informações pessoais mínimas;
- estados de perfil próprio e perfil público visualmente distintos.

### 15. Estados transversais

Todas as telas críticas devem possuir:

- carregamento com skeleton ou indicador proporcional;
- vazio com orientação e CTA útil;
- erro recuperável com `Tentar novamente`;
- conexão ausente;
- sucesso com confirmação e próximo passo;
- indisponível/finalizado sem CTA conflitante;
- bloqueio de segurança com razão objetiva;
- redução de movimento;
- zoom e texto ampliado sem perda de função.

## Padronização de ícones

Substituir todos os caracteres improvisados por SVGs da mesma família. Requisitos:

- `viewBox` consistente e `currentColor`;
- 20 ou 24 px conforme contexto;
- traço consistente e cantos compatíveis com a marca;
- `aria-hidden=true` quando houver texto adjacente;
- nome acessível para botões somente com ícone;
- nenhum emoji ou glifo dependente do sistema operacional;
- ícones não podem ser a única forma de indicar estado crítico.

## Componentes a consolidar

| Componente | Variantes mínimas |
|---|---|
| Botão | primário, secundário, terciário, destrutivo, loading, disabled |
| Campo | padrão, foco, preenchido, erro, sucesso, disabled |
| Chip | padrão, selecionado, removível, disabled |
| Card de anúncio | venda, troca, doação; disponível, indisponível, finalizado |
| Badge | modalidade, condição do pacote, verificação, simulado |
| Banner | informação, atenção, erro, sucesso, segurança |
| Bottom sheet | filtros, seleção, confirmação e ações contextuais |
| Modal | confirmação, alerta e bloqueio crítico |
| Toast | sucesso, erro e informação, sem conter instrução indispensável |
| Etapas | publicação, checkout, entrega, disputa e reembolso |

## Responsividade e dispositivos

| Faixa | Requisito mínimo |
|---|---|
| 320–359 px | conteúdo em uma coluna, sem overflow, texto essencial íntegro |
| 360–479 px | referência principal de telefone, margens e bottom navigation estáveis |
| 480–767 px | aproveitamento de largura sem esticar excessivamente cards e formulários |
| 768–1023 px | layout adaptado para tablet, painéis ou duas colunas quando útil |
| ≥1024 px | largura máxima controlada; app não deve parecer uma página ampliada sem estrutura |

Validar áreas seguras, teclado virtual, orientação, zoom de 200% e textos longos em português.

## Arquivos prováveis para o Codex local

- `platform/apps/app/home.html`
- demais rotas e scripts em `platform/apps/app/`
- `platform/packages/ui/tokens.css`
- fonte oficial das folhas importadas pelo adaptador visual
- contratos compartilhados relativos a anúncios, pagamentos, chat e entrega, apenas se a interface expuser inconsistência já coberta pelas regras vigentes
- testes de fundação, rotas, acessibilidade, navegação e regressão visual do App

O Codex deve localizar a fonte oficial de cada estilo antes de editar e preservar alterações legítimas já presentes na `main`.

## Critérios de aceite

- Home reproduz a hierarquia aprovada e exibe categorias/tamanhos;
- navegação inferior usa cinco destinos e ícones vetoriais consistentes;
- nenhum ícone Unicode permanece nos controles auditados;
- nenhuma ocorrência funcional ou promocional de `Reserva`;
- nenhuma oferta de boleto ou cartão de débito;
- Pix, cartão de crédito e saldo FraldaCycle são os únicos meios comunicados;
- comissão/taxa e entrega aparecem separadas antes da confirmação;
- chat operacional permanece bloqueado até a etapa protegida aplicável;
- retirada e entrega por motoboy, carro ou bicicleta estão representadas;
- venda/troca exigem pacote fechado; doação permite aberto com regra sanitária;
- estados Disponível, Indisponível e Finalizado são consistentes;
- carregamento, vazio, erro, sucesso e conexão ausente existem nas jornadas críticas;
- não há overflow nas faixas definidas;
- contraste AA, foco, leitor de tela, redução de movimento e alvos de toque são validados;
- rotas, CTAs e navegação inferior não levam a páginas inexistentes;
- dados e pagamentos demonstrativos permanecem identificados como sintéticos;
- suíte da plataforma, 56 verificações do protótipo e builds permanecem verdes.

## Testes adicionais recomendados

- teste de ausência de `Reserva`, boleto, débito e ícones Unicode nas superfícies vigentes;
- teste da faixa RN/P/M/G/XG e categorias Infantil/Piscina na Home;
- teste de bloqueio/liberação do chat conforme estado do pagamento;
- teste de composição transparente do total;
- teste de pacote aberto somente em doação;
- teste das três modalidades de parceiro de entrega;
- snapshots ou screenshots controlados em 360×800, 390×844 e 768×1024;
- comparação visual das telas críticas com tolerância documentada;
- auditoria automatizada de acessibilidade e navegação por teclado.

## Ordem recomendada de implementação

1. Tokens, ícones e componentes compartilhados.
2. Splash, onboarding e autenticação.
3. Home, categorias e navegação inferior.
4. Busca, filtros e detalhe do anúncio.
5. Publicação em oito etapas.
6. Compra, troca e doação.
7. Checkout, entrega e chat protegido.
8. Perfil, carteira, reembolso e disputa.
9. Estados transversais, responsividade e acessibilidade.
10. Comparação visual, testes de regressão e documentação.

## Resultado esperado

Após implementação e validação, a fidelidade estimada do App deve avançar de aproximadamente 88% para 94–97%. A fidelidade geral do produto poderá superar 90% quando Site, App, Admin e Design System forem implementados e auditados em conjunto. Nenhuma porcentagem deve ser atualizada antes da comparação visual e dos testes no Codex local.
