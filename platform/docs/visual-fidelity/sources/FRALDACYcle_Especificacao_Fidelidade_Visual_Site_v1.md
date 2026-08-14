# FraldaCycle — Especificação de Fidelidade Visual do Site v1

## Base e objetivo

- Repositório: `bonecodesign/FRALDAScycle`
- Base auditada: `main` no commit `5421eb595ce5814fd60ebc3aaa8d8a8e727958a5`
- Superfície: Site público, com prioridade para a Home
- Objetivo: elevar a fidelidade às pranchas oficiais sem desfazer decisões posteriores de produto, segurança ou operação.
- Este documento especifica alterações futuras; não altera a `main` nem autoriza publicação.

## Hierarquia de decisão

1. Regras de negócio vigentes e documentos jurídicos.
2. Identidade visual e pranchas oficiais.
3. Implementação atual, quando não conflitar com os itens anteriores.

Não restaurar: Reserva; boleto; cartão de débito; números fictícios tratados como resultados reais; fluxos de transação fora da plataforma.

## Sistema visual obrigatório

| Elemento | Especificação |
|---|---|
| Tipografia | Poppins em títulos e Inter em textos/interfaces |
| Paleta principal | Verde, branco e neutros claros; cores de apoio apenas para significado e ênfase |
| Espaçamento | Escala base de 4 px |
| Raios | 4, 8, 12, 16 e 24 px; cards principais com 16 px |
| Sombras | Suaves, sem contorno pesado |
| Ícones | Lineares, vetoriais, mesma família, espessura e caixa óptica |
| Fotografia | Real, clara e acolhedora; cuidado, família e confiança; sem aparência de banco genérico |
| Movimento | 150–300 ms; fade, push e elevação suave; respeitar `prefers-reduced-motion` |
| Acessibilidade | WCAG 2.1 AA, foco visível, navegação por teclado e alvos de toque mínimos de 44 px |

## Home — estado final esperado

### 1. Cabeçalho

Desktop:

- logo FraldaCycle à esquerda;
- links centrais: `Como funciona`, `Categorias`, `Anunciar`, `Doações`, `Ajuda`;
- ações à direita: `Entrar` como secundária e `Publicar anúncio` como primária;
- `Favoritos` deve permanecer acessível, preferencialmente por ícone vetorial com rótulo acessível;
- remover o rótulo redundante `Site` da navegação pública;
- tema claro é o padrão; alternância de tema pode permanecer como recurso secundário.

Mobile:

- logo, botão de menu e ação principal visíveis;
- menu em painel acessível, com foco contido, fechamento por Escape e retorno do foco;
- nenhuma navegação horizontal ou texto truncado em 320 px.

### 2. Hero

- título oficial: `Conectamos famílias. Reduzimos desperdícios. Transformamos vidas.`
- texto de apoio: explicar, em linguagem curta, compra, troca e doação segura de fraldas descartáveis.
- CTA primário: `Começar agora` → busca/marketplace.
- CTA secundário: `Saiba mais` → seção Como funciona.
- manter sinais de confiança: perfis verificados, pagamento protegido e impacto mensurável.
- substituir ilustração abstrata improvisada por composição aprovada ou fotografia real coerente com a direção de marca.
- qualquer métrica no hero deve trazer `Simulado` de forma inequívoca; preferir remover métricas até existirem dados operacionais.

### 3. Como funciona

Quatro etapas preservadas:

1. `Encontre` — marca, categoria, tamanho, preço e distância.
2. `Negocie` — compra, troca ou doação dentro do ambiente protegido.
3. `Pague` — Pix, cartão de crédito ou saldo FraldaCycle; nunca boleto ou débito.
4. `Receba` — retirada combinada ou entrega por parceiro de motoboy, carro ou bicicleta.

O chat para combinar entrega só é liberado após o pagamento protegido quando houver transação financeira.

### 4. Categorias

Criar seção visível entre Como funciona e Anúncios:

- `Fraldas infantis`;
- `Fraldas para piscina`;
- filtros de tamanho: `RN`, `P`, `M`, `G`, `XG` e demais tamanhos válidos do catálogo atual.

Não incluir fraldas reutilizáveis ou outras categorias não aprovadas.

### 5. Anúncios em destaque

- preservar cards com imagem, modalidade, marca/modelo, tamanho, quantidade, preço, avaliação e distância;
- modalidade visual explícita: Venda, Troca ou Doação;
- estado explícito: Disponível, Indisponível ou Finalizado;
- favorito com ícone vetorial e estado selecionado;
- selo para pacote aberto apenas em doações;
- venda e troca devem comunicar `pacote fechado`;
- iniciar uma jornada torna o anúncio indisponível; falha/cancelamento o devolve a disponível.

### 6. Doações

Adicionar bloco editorial próprio:

- informar que doações podem conter pacote aberto;
- exigir unidades sem uso e em condição higiênica;
- diferenciar claramente doação de venda e troca;
- CTA: `Ver doações`.

### 7. Impacto

- manter seção, mas toda informação não operacional deve receber rótulo `Simulado` junto ao valor;
- não usar números das pranchas como prova social real;
- informar período e data de atualização;
- evitar métricas flutuantes no hero se duplicarem o bloco de impacto.

### 8. Rodapé

Organizar em quatro grupos:

- Plataforma: Marketplace, Categorias, Anunciar, Doações;
- Institucional: Como funciona, Impacto, Contato;
- Suporte: Ajuda, Segurança, Termos, Privacidade;
- Conta: Entrar e Cadastro.

Preservar a declaração de dados simulados enquanto aplicável.

## Substituição dos ícones improvisados

Substituir `⌕`, `↔`, `▣`, `⌖`, `♡` e `◐` por SVGs da mesma família. Requisitos:

- `currentColor` para herdar cor;
- `aria-hidden=true` quando houver texto adjacente;
- nome acessível em botões somente com ícone;
- caixa padrão de 24×24 px e traço visual consistente;
- sem emoji ou glifo dependente do sistema operacional.

## Responsividade

| Largura | Requisito mínimo |
|---|---|
| 320–479 px | uma coluna, menu compacto, CTAs empilhados, cards sem overflow |
| 480–767 px | uma ou duas colunas conforme conteúdo, espaçamento preservado |
| 768–1023 px | navegação adaptada, grids de duas colunas |
| 1024–1439 px | layout completo, grids de quatro cards quando houver espaço |
| ≥1440 px | conteúdo central limitado; linhas de texto não excessivamente longas |

## Arquivos prováveis para o Codex local

- `platform/apps/site/index.html`
- `platform/apps/site/home.js`
- `platform/packages/ui/tokens.css`
- folhas importadas por `platform/packages/ui/source-adapter.css`
- testes visuais, de fundação, acessibilidade e rotas relacionados ao Site

O Codex deve localizar a fonte correta de cada estilo antes de editar. Não modificar o adaptador temporário como substituto de uma correção na fonte oficial.

## Critérios de aceite

- cabeçalho reproduz os cinco destinos da prancha em desktop e menu acessível em mobile;
- hero usa título e CTAs oficiais, sem contradizer regras posteriores;
- categorias infantis/piscina e tamanhos são encontráveis na Home;
- nenhum ícone Unicode permanece nos controles auditados;
- nenhuma ocorrência funcional ou promocional de `Reserva`;
- nenhuma oferta de boleto ou cartão de débito;
- Pix, cartão de crédito e saldo FraldaCycle são os únicos meios comunicados;
- doações abertas são explicadas com regra sanitária; venda/troca permanecem fechadas;
- números simulados estão rotulados junto aos valores;
- não há overflow em 320, 768, 1024 e 1440 px;
- contraste AA, foco, teclado, redução de movimento e alvos de toque validados;
- links e CTAs apontam para rotas existentes;
- suíte da plataforma, verificações do protótipo e builds permanecem verdes.

## Ordem recomendada de implementação

1. Cabeçalho e navegação responsiva.
2. Hero e conteúdo oficial.
3. Categorias e bloco de doações.
4. Ícones vetoriais.
5. Cards, estados e impacto.
6. Rodapé.
7. Auditoria responsiva, acessibilidade, regressão e comparação visual.

## Resultado esperado

Após implementação e validação, a fidelidade estimada do Site deve avançar de aproximadamente 75% para 92–95%, sem reduzir a conformidade de negócio ou a segurança da plataforma. A porcentagem só deve ser atualizada após comparação visual e testes no Codex local.
