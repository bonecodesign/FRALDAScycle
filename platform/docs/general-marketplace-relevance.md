# Relevância geral sem perfis

Estado: contrato de ordenação implementado; integração PostgreSQL e cursor pendente.

## Política

- qualidade objetiva do anúncio: 50%;
- faixa de distância: 50%;
- nenhuma leitura de perfil infantil ou familiar;
- ausência de distância não oculta nem bloqueia o anúncio;
- empates usam publicação mais recente, criação mais recente e UUID crescente;
- ordenação manual substitui integralmente esta política;
- Premium é aplicado somente depois da ordem orgânica e não altera o `generalScore`.

A qualidade segue a política `objective_v1`: completude, fotos, catálogo oficial e atualização. A distância usa as faixas já aprovadas: até 5 km, 5–15 km, 15–30 km e acima de 30 km.

## Integração pendente

O PostgreSQL deve calcular ou receber `quality_score`, derivar `general_score` e ordenar antes de paginar. O cursor precisa incluir o score e os desempates para impedir repetição ou salto de itens. A API deve identificar a política utilizada sem expor sinais internos antifraude.
