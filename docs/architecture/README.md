# Arquitetura inicial

O FraldaCycle será estruturado como um monorepo para separar a experiência do usuário, as regras de negócio e as integrações de infraestrutura.

## Organização

- `apps/`: aplicações executáveis, como a interface web e a API.
- `packages/`: módulos compartilhados, incluindo tipos, regras de domínio e componentes.
- `database/`: esquema e migrações do banco de dados.
- `infra/`: configurações de entrega e serviços externos.

## Domínio

A primeira unidade de negócio será o anúncio de um pacote fechado de fraldas. Cada anúncio terá modalidade de compra, venda ou doação, além de marca, tamanho, quantidade de unidades, condição e localização aproximada.

O sistema só aceitará pacotes fechados e não incluirá lavagem, higienização, reciclagem ou recondicionamento de fraldas.

## Evolução

1. Criar o módulo de domínio para anúncios e suas validações.
2. Implementar persistência e API para criação e busca de anúncios.
3. Construir a experiência web para publicar e localizar ofertas próximas.
4. Adicionar autenticação, moderação e notificações.
