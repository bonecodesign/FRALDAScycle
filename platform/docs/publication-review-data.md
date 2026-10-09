# Revisão do anúncio com dados preenchidos

Site e app usam o mesmo componente de revisão. Produto, tamanho, quantidade, condição, preço, validade informada, preferência de entrega, região e destinatária das doações vêm do rascunho atual. Campos ausentes são identificados. Textos do usuário são inseridos com `textContent`.

Título e descrição exibidos usam a mesma função aplicada no envio. Validade e preferência de entrega ficam registradas como texto na descrição; ainda não existem campos próprios para esses dois dados no anúncio. Entrega e frete precisam de confirmação posterior.

O app mantém validade, preferência de entrega, CEP e bairro no rascunho da aba ao navegar entre etapas. O CEP não é incluído na descrição pública. Cidade/UF podem ser consultadas pelo CEP ou preenchidas manualmente. Coordenadas consultadas são arredondadas para duas casas decimais e descartadas quando CEP, bairro, cidade ou UF mudam. O site preserva o tamanho selecionado ao voltar e não preenche título, quantidade, preço, validade ou região com exemplos.

O site mostra a foto escolhida durante a sessão. O app consulta a foto enviada por um link temporário autenticado, restrito à conta proprietária. A imagem permanece oculta até carregar, e pode ser consultada novamente quando o link expira ou o processamento ainda não terminou. Nenhuma foto de catálogo é usada como substituta no resumo.

Validação local: testes do componente com DOM simulado e do corpo enviado pelo app. Homologação visual em navegador e testes HTTP continuam pendentes.
