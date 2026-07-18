# FraldaCycle

Marketplace demonstrativo para compra, venda e doação de pacotes fechados de fraldas.

## Experiência disponível

- Marketplace responsivo com busca, filtros e publicação guiada
- Mapa de ofertas fictícias
- Notificações demonstrativas
- Painel administrativo
- Instalação no celular ou computador como aplicativo web (PWA)
- Funcionamento básico offline
- Modo local com dados simulados quando nenhuma API é configurada

> O FraldaCycle não realiza lavagem, higienização, reciclagem ou recondicionamento de fraldas. Somente pacotes novos e fechados fazem parte do escopo.

## Executar a demonstração web

Requisitos: Node.js 20 ou superior e Corepack.

```sh
corepack enable
pnpm install --no-frozen-lockfile
pnpm --filter @fraldacycle/web start
```

Abra `http://localhost:3001`. Sem configuração adicional, a interface usa dados fictícios salvos apenas no navegador.

Para testar conta e publicação, use qualquer e-mail terminado em `@tester.fraldacycle.local` e uma senha com pelo menos oito caracteres.

## Instalar como aplicativo

Abra a demonstração em um navegador compatível e escolha **Instalar aplicativo** ou **Adicionar à tela inicial**. A versão instalada usa a mesma interface responsiva da web e mantém o modo demonstrativo local.

A instalação por navegador exige HTTPS, exceto em `localhost`.

## API opcional

A API existente pode substituir o modo local. Antes de iniciá-la, defina `AUTH_SECRET` com pelo menos 32 caracteres.

```sh
pnpm --filter @fraldacycle/api start
```

Depois, disponibilize o endereço da API à página por `window.FRALDACYCLE_API_URL`. Sem esse valor, a web continua no modo demonstrativo e não tenta acessar um backend inexistente.

## Verificações

```sh
pnpm test
```

O CI valida a sintaxe dos scripts web e executa os testes automatizados da API e do domínio.

## Limites da demonstração

Os usuários, ofertas, notificações, métricas e estimativas ambientais exibidos são fictícios. Pagamentos, logística, negociação real, identidade e moderação persistente ainda não são serviços de produção.
