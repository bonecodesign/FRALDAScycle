# Unidades idênticas por anúncio

## Regra aprovada

- O plano gratuito continua permitindo até três anúncios publicados.
- No plano gratuito, cada anúncio pode oferecer de uma a três unidades idênticas do mesmo produto.
- No Premium, cada anúncio pode oferecer de uma a cinco unidades idênticas do mesmo produto.
- As unidades idênticas de um anúncio contam como um único anúncio para o limite do plano.
- `quantity` representa quantas fraldas existem em cada pacote.
- `stock_units` representa quantos pacotes idênticos estão disponíveis no anúncio, respeitando o plano vigente na publicação.
- `price_cents` representa o preço de um pacote; a transação multiplica esse valor pela quantidade comprada.

Exemplo: um anúncio pode oferecer três pacotes idênticos, cada um com 50 fraldas. Isso ocupa uma das três vagas gratuitas de anúncio.

Se uma assinatura Premium terminar, anúncios e operações existentes não perdem estoque. O limite gratuito volta a valer para novas publicações; não existe reposição de estoque nesta fase.

## Proteção de estoque

A criação da transação bloqueia a linha do anúncio no PostgreSQL, soma as unidades comprometidas e rejeita uma solicitação que exceda o saldo. O anúncio permanece publicado enquanto houver estoque e fica indisponível quando a última unidade for comprometida. Um cancelamento simples anterior ao pagamento libera as unidades e pode republicar o anúncio, sujeito à quota do plano.

Reembolsos não devolvem estoque automaticamente: a condição física do produto precisa ser confirmada antes de uma eventual republicação.
