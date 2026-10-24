# Pontuação objetiva de qualidade do anúncio

Estado: fundação técnica implementada; integração ao fluxo de busca depende da consulta ao catálogo oficial ativo.

## Política `objective_v1`

- completude dos campos: 40%;
- cobertura de fotos: 30%;
- consistência com catálogo oficial ativo: 20%;
- atualização do anúncio: 10%.

A pontuação varia de 0 a 1 e serve somente como desempate depois da relevância orgânica. Ela não oculta produtos, não substitui ordenação manual e não altera os pesos de compatibilidade etária e distância.

Não entram no cálculo: Premium, valor pago, reputação ou tempo de conta do vendedor, volume de vendas, dados infantis e qualquer inferência médica.

## Critérios reproduzíveis

Completude usa os campos do anúncio aplicáveis à operação. Venda também exige preço válido.

Fotos recebem 50% do componente com uma foto, 75% com duas e 100% com três ou mais. Fotos repetidas não contam duas vezes e quantidades superiores a três não aumentam a nota.

Consistência recebe pontuação apenas quando há correspondência confirmada com um lote oficial ativo. Ausência de fonte oficial não bloqueia nem reduz a visibilidade por outro mecanismo; apenas não soma esse componente.

Atualização recebe 100% até 7 dias, 75% até 30 dias, 50% até 90 dias, 25% até 180 dias e zero depois. Datas futuras ou inválidas recebem zero.

## Ativação pendente

Antes de usar a nota em produção, a busca deve obter de forma transacional a correspondência com o catálogo ativo, expor a versão da política em telemetria e validar paginação estável. Nenhum dado real de fabricante é necessário para testar o contrato.
