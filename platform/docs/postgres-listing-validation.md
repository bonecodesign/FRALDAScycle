# Validação da publicação em PostgreSQL

Em 09/10/2026, a proteção de criação foi validada em PostgreSQL 16 Alpine, em container temporário local sem dados reais. A base dedicada `fc_listing_creation_test` foi removida ao encerrar a validação.

O teste `tests/listing-creation-postgres.test.mjs` exige `FC_LISTING_TEST_DATABASE_URL` apontando para essa base em localhost. Não usa `DATABASE_URL` de operação. Verifica:

- Aplicação concorrente das migrações desde banco vazio e confirmação de cada arquivo.
- Atualização até a migração 043 preservando um anúncio sem chave de criação.
- Vinte solicitações simultâneas com a mesma chave: um anúncio, uma foto e o mesmo identificador em todas as respostas.
- Conflito com conteúdo diferente, separação das chaves por conta e recuperação do estado atualizado do anúncio.
- Falha sintética ao inserir mídia: nenhuma criação parcial; repetição posterior com a mesma chave bem-sucedida.
- Restrição SQL impedindo chave sem impressão de conteúdo.

A execução revelou que uma única transação envolvendo todas as migrações impedia usar valores de enum adicionados em arquivos anteriores. `database/migrate.js` foi corrigido para usar uma transação por arquivo, com bloqueio consultivo e validação dos checksums dentro de cada transação. Uma falha mantém os arquivos anteriores aplicados e permite retomar o arquivo que falhou.

Esta evidência cobre banco e serviço de publicação com verificação de mídia simulada. Provedores externos, fluxos de navegador, testes HTTP e aplicação na base real de operação permanecem pendentes.

## Execução reproduzível

No diretório `platform`, execute `npm run test:listing-postgres`. O comando exige Docker com daemon Linux local disponível em `/var/run/docker.sock`; não usa o banco de operação nem precisa de `DATABASE_URL`.

O executor usa imagem PostgreSQL 16 fixada por digest, porta local livre, senha temporária, base dedicada e dados em memória. Aguarda o banco, executa o teste e remove o container em sucesso ou falha. Falta de Docker ou indisponibilidade do banco causam falha explícita; não há substituição por banco simulado.

O workflow `platform.yml` inclui essa execução em um job próprio. O workflow `release-images.yml` também a exige antes da etapa que autoriza publicar imagens. As alterações nos workflows estão preparadas localmente; a execução no GitHub depende da atualização do repositório.
