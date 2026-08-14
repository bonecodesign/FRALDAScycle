# FraldaCycle — Design System Consolidado v1

## Base, escopo e finalidade

- Repositório: `bonecodesign/FRALDAScycle`
- Base de continuidade: `main` no commit `5421eb595ce5814fd60ebc3aaa8d8a8e727958a5`
- Superfícies: Site, App e Admin
- Documentos vinculados: especificações visuais do Site, App e Admin v1
- Finalidade: estabelecer um contrato visual único, acessível e testável, pronto para implementação posterior no Codex local.
- Este documento não altera a `main`, não ativa integrações, não usa dados reais e não autoriza publicação.

## Hierarquia de decisão

1. Segurança, privacidade, documentos jurídicos e regras de negócio vigentes.
2. Acessibilidade e clareza operacional.
3. Identidade visual e pranchas oficiais.
4. Consistência entre Site, App e Admin.
5. Implementação atual, quando não conflitar com os itens anteriores.

Não restaurar: `Reserva`; boleto; cartão de débito; fraldas reutilizáveis; métricas fictícias apresentadas como reais; credenciais demonstrativas em produção; chat operacional pré-pagamento em transações financeiras; pagamento fora da plataforma.

## Princípios de marca e interface

- **Acolhimento:** linguagem humana, clara e respeitosa com famílias.
- **Confiança:** custos, estados, permissões e limitações sempre explícitos.
- **Circularidade:** compra, troca e doação recebem igual dignidade visual.
- **Simplicidade:** uma ação principal por contexto e baixa carga cognitiva.
- **Inclusão:** WCAG 2.1 AA como requisito mínimo, não como melhoria opcional.
- **Verdade operacional:** dados sintéticos, integrações não configuradas e módulos futuros nunca aparentam produção real.

## Arquitetura dos tokens

Usar três camadas, evitando valores avulsos nos componentes:

1. **Primitivos:** valores brutos de cor, tamanho, espaço, raio e duração.
2. **Semânticos:** intenção de uso, como `surface-primary`, `text-muted` ou `status-success`.
3. **Componente:** decisões específicas, como `button-primary-bg`, sempre referenciando tokens semânticos.

Tokens devem permanecer centralizados em `platform/packages/ui/tokens.css` ou na fonte equivalente confirmada pelo Codex. Site, App e Admin não devem manter cópias divergentes.

## Cores

### Papéis obrigatórios

| Grupo | Tokens mínimos | Uso |
|---|---|---|
| Marca | `brand-primary`, `brand-primary-hover`, `brand-primary-active`, `brand-soft` | CTAs, seleção e identidade |
| Superfícies | `surface-canvas`, `surface-primary`, `surface-secondary`, `surface-elevated` | Fundos, cards, menus e modais |
| Texto | `text-primary`, `text-secondary`, `text-muted`, `text-inverse`, `text-link` | Hierarquia textual |
| Bordas | `border-subtle`, `border-default`, `border-strong`, `border-focus` | Separação e foco |
| Estados | `success`, `warning`, `danger`, `info` e respectivas superfícies suaves | Feedback real e status |
| Modalidades | `sale`, `exchange`, `donation` e respectivas superfícies suaves | Diferenciar Venda, Troca e Doação |

Regras:

- valores finais devem ser extraídos das pranchas e dos tokens atuais, não inventados durante a implementação;
- texto normal deve atingir contraste mínimo de 4,5:1 e texto grande 3:1;
- foco e componentes gráficos essenciais devem atingir 3:1 contra áreas adjacentes;
- significado nunca depende apenas da cor: usar texto, ícone e/ou forma;
- cores de modalidade não substituem cores de erro, atenção ou sucesso;
- tema escuro, se mantido, precisa de tokens semânticos próprios e paridade funcional.

## Tipografia

| Papel | Família | Diretriz |
|---|---|---|
| Display e títulos | Poppins | Pesos controlados; evitar títulos excessivamente largos |
| Corpo e interface | Inter | Textos, formulários, tabelas, valores e controles |
| Números tabulares | Inter com números tabulares, quando disponível | Financeiro, métricas e tabelas |

Escala recomendada, ajustável somente por evidência das pranchas:

- `display`: 40–48 px desktop; 32–36 px mobile;
- `heading-1`: 32 px; `heading-2`: 24 px; `heading-3`: 20 px;
- `body-lg`: 18 px; `body`: 16 px; `body-sm`: 14 px;
- `label`: 14 px; `caption`: 12 px, sem uso para conteúdo essencial extenso;
- altura de linha entre 1,2 em títulos e 1,5–1,6 em textos.

Não usar tamanho inferior a 12 px. Zoom de 200% não pode ocultar conteúdo ou impedir operações.

## Espaçamento, grade e dimensões

- escala base: 4 px;
- tokens mínimos: `space-0`, `space-1` (4), `space-2` (8), `space-3` (12), `space-4` (16), `space-5` (20), `space-6` (24), `space-8` (32), `space-10` (40), `space-12` (48), `space-16` (64);
- raios: 4, 8, 12, 16 e 24 px; pílulas usam raio total apenas quando a função exigir;
- alvo interativo mínimo: 44×44 px;
- conteúdo do Site: contêiner central com largura máxima consistente;
- App: margens laterais uniformes e respeito às áreas seguras;
- Admin: grade responsiva, densidade moderada e nenhuma tabela forçada a caber ilegivelmente.

Breakpoints de validação: 320, 480, 768, 1024 e 1440 px. Breakpoints de CSS devem responder ao conteúdo, não ao nome de aparelhos específicos.

## Elevação, bordas e movimento

- hierarquia primária por espaço, superfície e tipografia; sombra é apoio;
- sombras suaves em no máximo três níveis: card, dropdown/drawer e modal;
- bordas não devem criar aparência pesada ou competir com conteúdo;
- durações: 150 ms para feedback imediato, 200–250 ms para componentes e até 300 ms para transições de contexto;
- curvas consistentes para entrada, saída e mudança de estado;
- respeitar `prefers-reduced-motion`, removendo deslocamentos não essenciais;
- animação nunca atrasa pagamento, confirmação, erro ou ação crítica.

## Sistema de ícones

Adotar uma única família vetorial linear de licença compatível com o projeto. Não misturar famílias nem desenhar ícones isolados sem necessidade.

Padrão:

- SVG com `viewBox="0 0 24 24"` e `currentColor`;
- traço, terminações e junções consistentes;
- tamanhos visuais: 16, 20 e 24 px; 32 px apenas em destaques;
- ícone decorativo: `aria-hidden="true"`;
- botão somente com ícone: nome acessível obrigatório;
- ícone com rótulo: não repetir a leitura no leitor de tela;
- estado ativo não pode depender apenas da alteração de cor.

Inventário mínimo: início, busca, publicar/adicionar, chat, perfil, favorito, notificações, menu, fechar, voltar, avançar, editar, excluir, filtro, ordenar, localização, entrega, bicicleta, motocicleta, carro, retirada, pagamento, Pix, cartão de crédito, carteira/saldo, troca, doação, venda, segurança, informação, ajuda, sucesso, atenção e erro.

Remover dos controles auditados caracteres como `⌂`, `⌕`, `♡`, `▣`, `⌖`, `↔` e `◐`, além de emojis dependentes do sistema.

## Componentes centrais

### Botões

Variantes: primário, secundário, terciário/texto, destrutivo e somente ícone.

Estados obrigatórios: padrão, hover, pressed, foco, loading e desabilitado. O loading preserva largura e informa progresso. Nunca desabilitar uma ação sem explicação quando o motivo não for óbvio.

### Links

Links devem parecer links, possuir foco visível e indicar destino externo quando necessário. Ações que alteram estado usam botão, não link estilizado.

### Campos e seleção

Componentes: input, textarea, select, autocomplete, checkbox, radio, switch, busca e upload.

Todos exigem rótulo persistente, ajuda opcional, erro junto ao campo, relação programática entre mensagens e controle, e preservação dos dados após falha. Placeholder não substitui rótulo.

### Chips, badges e status

- chip: filtro, seleção ou atributo removível;
- badge: informação compacta não interativa;
- status: estado operacional com texto e semântica acessível;
- modalidades: `Venda`, `Troca` e `Doação`;
- anúncio: `Disponível`, `Indisponível`, `Finalizado`;
- nunca criar `Reservado` ou `Reserva`;
- `Simulado`, `Não configurado`, `Bloqueado` e `Planejado` devem ser inequívocos.

### Cards

Famílias: anúncio, métrica, opção de entrega, usuário/operação e conteúdo editorial.

Card clicável deve possuir um destino principal claro; ações internas independentes precisam de foco separado. Imagem com proporção estável, skeleton equivalente e texto alternativo conforme função.

### Navegação

- Site: cabeçalho desktop e menu móvel acessível;
- App: barra inferior com cinco destinos e área segura;
- Admin: barra lateral hierarquizada, recolhível e dependente de permissão;
- item ativo marcado por pelo menos dois sinais visuais;
- foco deve retornar corretamente após fechar menu, drawer ou modal.

### Modal, drawer, toast e alerta

- modal somente para decisões focadas; confirmação destrutiva exige alvo e consequência;
- foco contido, Escape quando seguro e retorno do foco;
- drawer para detalhes ou filtros sem perder contexto;
- toast não pode ser o único registro de erro importante;
- alertas críticos persistem até leitura ou resolução adequada.

### Tabelas, listas e paginação

- Site/App priorizam listas e cards responsivos;
- Admin usa tabelas apenas quando a comparação por colunas é relevante;
- cabeçalhos associados, ordenação anunciada, seleção acessível e ações previsíveis;
- em telas estreitas, usar scroll identificado ou transformação controlada em cards;
- paginação preserva filtros e posição quando apropriado.

### Feedback e estados universais

Todo componente de dados deve contemplar: inicial, loading, sucesso, vazio, erro, conexão ausente, acesso negado e conteúdo indisponível. Skeleton não deve comunicar dados falsos nem permanecer indefinidamente.

## Componentes específicos do FraldaCycle

### Card de anúncio

Foto, modalidade, marca/modelo, categoria, tamanho, quantidade, condição do pacote, preço/doação, distância, reputação, disponibilidade e favorito. Venda e troca comunicam pacote fechado; doação pode comunicar pacote aberto.

### Resumo financeiro protegido

Linhas separadas para item, percentual/valor da plataforma, entrega e total. Meios permitidos: Pix, cartão de crédito e saldo FraldaCycle. Nenhum boleto ou débito.

### Opção de entrega

Retirada, motoboy, carro ou bicicleta. Exibir prazo, custo, capacidade/restrição e disponibilidade. Estado simulado ou não configurado precisa aparecer junto à opção.

### Bloqueio/liberação do chat

Antes da etapa protegida, apresentar explicação e ação segura; após pagamento aprovado, liberar o chat operacional e mostrar o contexto da transação. Não revelar endereço exato prematuramente.

### Indicador de pacote

`Fechado` para venda e troca; `Aberto` ou `Fechado` para doação. Pacote aberto sempre acompanhado de confirmação de unidades sem uso e condição higiênica.

### Progresso da publicação

Oito etapas, com número, título, progresso textual e visual, validação local e preservação de dados. Revisão final resume modalidade, produto, pacote, fotos, preço/troca, recebimento e regras.

## Conteúdo e nomenclatura

- usar português brasileiro simples e direto;
- preferir verbos concretos: `Comprar`, `Trocar`, `Doar`, `Publicar anúncio`;
- distinguir indisponibilidade de conclusão;
- explicar comissão e proteção antes da confirmação;
- evitar termos técnicos de provedores para usuários finais;
- nunca prometer cobertura, disponibilidade ou resultado não comprovado;
- métricas não operacionais recebem `Simulado`, período e atualização junto ao valor;
- mensagens de erro informam o que ocorreu e o próximo passo possível.

## Acessibilidade obrigatória

- HTML semântico e ordem lógica de leitura;
- landmarks, títulos hierárquicos e nomes acessíveis;
- operação completa por teclado;
- foco visível e não encoberto;
- contraste AA e zoom/reflow em 200%;
- alvos de 44×44 px;
- erros identificados por texto e associados aos campos;
- anúncios de carregamento e confirmação sem excesso;
- imagens significativas com alternativa; decorativas ignoradas;
- não depender de hover, gesto, cor, som ou movimento;
- respeitar redução de movimento e preferências de contraste quando disponíveis.

## Governança e implementação

### Fonte única

- tokens e componentes compartilhados pertencem a `platform/packages/ui` ou estrutura equivalente confirmada no repositório;
- aplicações consomem a biblioteca; não copiam componentes para alterações locais;
- exceções por superfície devem ser documentadas e cobertas por teste;
- `source-adapter.css` não deve virar a fonte definitiva de correções.

### Nomenclatura e versionamento

- tokens usam nomes semânticos e estáveis;
- mudanças incompatíveis exigem migração explícita;
- componente novo inclui documentação, estados e acessibilidade;
- componente obsoleto recebe plano de substituição antes de ser removido;
- alterações visuais relevantes precisam de comparação antes/depois.

### Arquivos prováveis para o Codex local

- `platform/packages/ui/tokens.css`
- `platform/packages/ui/source-adapter.css` apenas para localizar compatibilidade existente
- componentes e estilos compartilhados em `platform/packages/ui/`
- arquivos de Site, App e Admin listados nas respectivas especificações
- testes de fundação, acessibilidade, rotas, regressão e comparação visual

O Codex deve confirmar a estrutura real antes de editar e preservar mudanças do usuário.

## Matriz de aceite

| Área | Aceite mínimo |
|---|---|
| Tokens | Nenhum valor visual central duplicado de forma divergente nas três superfícies |
| Tipografia | Poppins/Inter carregadas corretamente, hierarquia consistente e sem quebra crítica |
| Cores | Contraste AA; estados e modalidades não dependem apenas de cor |
| Ícones | Uma família SVG; nenhum glifo Unicode nos controles auditados |
| Componentes | Estados padrão, foco, loading, erro e desabilitado documentados e testados |
| Responsividade | Sem overflow ou ação inacessível em 320, 480, 768, 1024 e 1440 px |
| Conteúdo | Sem Reserva, boleto, débito, fraldas reutilizáveis ou alegações fictícias |
| Transação | Taxas transparentes; chat e endereço respeitam a etapa protegida |
| Dados | Sintético, real, estimado, bloqueado e não configurado claramente diferenciados |
| Qualidade | Suítes, verificações do protótipo e builds de Site, App, Admin e API verdes |

## Testes de regressão a acrescentar

- busca textual e estrutural por termos proibidos, com exceções históricas explicitamente permitidas;
- detecção de caracteres Unicode usados como ícones em controles;
- contraste automatizado nas rotas representativas;
- navegação por teclado, foco de modal/drawer e menu mobile;
- tamanhos mínimos de alvos e ausência de overflow;
- snapshots ou comparação visual estável das telas prioritárias;
- verificação de tokens órfãos, duplicados e valores avulsos críticos;
- validação dos estados de anúncio e ausência de `Reservado`;
- composição financeira e meios de pagamento permitidos;
- rótulo de dados sintéticos junto a métricas e integrações;
- preservação das regras de pacote aberto/fechado por modalidade.

## Ordem recomendada no Codex

1. Inventariar tokens, componentes, ícones e exceções atuais.
2. Consolidar tokens semânticos sem alterar ainda a aparência.
3. Implantar a família única de ícones SVG.
4. Padronizar componentes centrais e seus estados.
5. Aplicar a especificação do Site.
6. Aplicar a especificação do App.
7. Aplicar a especificação do Admin.
8. Executar auditoria responsiva, acessibilidade e comparação visual.
9. Rodar toda a suíte, builds e verificações do protótipo.
10. Abrir PR em rascunho, registrar evidências e fazer merge apenas com CI integralmente verde.

## Resultado esperado

Após implementação e comprovação, o Design System deve passar de uma base visual consistente porém parcialmente divergente para uma fonte única entre Site, App e Admin. A fidelidade visual geral poderá avançar de aproximadamente 83% para 93–96%. A porcentagem só deve ser atualizada depois de comparação visual, testes e revisão das pranchas; este documento, sozinho, não altera o progresso técnico nem a fidelidade medida.
