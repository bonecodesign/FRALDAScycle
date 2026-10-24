# Ranking padrão do Marketplace

Decisão aprovada em 24 de outubro de 2026: o ranking personalizado padrão atribui exatamente **50% à compatibilidade etária** e **50% à faixa de distância**.

## Contrato matemático

- cada perfil ativo participa com o mesmo peso na compatibilidade média;
- compatibilidade com vários perfis pode elevar a pontuação, sem escolher um perfil favorito;
- as faixas geográficas recebem pontuação discreta: até 5 km, 5–15 km, 15–30 km e acima de 30 km;
- nenhuma distância oculta ou bloqueia um produto;
- ausência de orientação etária oficial não bloqueia o item, mas não concede prioridade etária;
- qualidade do anúncio e data de publicação são somente desempates, nessa ordem;
- o identificador estável encerra empates e evita ordem aleatória.

Ordenações manuais substituem integralmente a personalização e não consultam perfis. Quando a personalização está desligada, o modo selecionado é relevância geral e também não consulta perfis; a fórmula dessa relevância será implementada em etapa própria.

Este pacote define e testa o contrato. Ele não liga o ranking à consulta PostgreSQL, não ativa coleta infantil e não altera o bloqueio jurídico dos requisitos infantis.
