# FC-314 — Destinos externos e proteção de credenciais

**Estado:** endurecimento preventivo de configurações e adaptadores com testes sintéticos. **Não** há credenciais reais, fornecedores ativados, contratação, deploy de produção ou alteração no protótipo. Piloto BH: **NO-GO**.

## Falha de validação identificada

As configurações de diversos provedores aceitavam endereços verificando apenas se começavam com `https://`. Isso não era suficiente para recusar destinos como `https://127.0.0.1`, `https://169.254.169.254`, `https://localhost`, `https://usuario:senha@host` ou endpoints que incluíam credenciais ou fragmentos. Em uma configuração errada, tokens de serviço poderiam ser encaminhados a um destino inadequado.

O cofre de segredos já exigia HTTPS, mas não rejeitava host local, IP direto e nomes internos. Os adaptadores de mídia, quando instanciados sem `loadConfig`, também não aplicavam as verificações no próprio limite da requisição.

## Controles implementados

`apps/api/external-provider-endpoint.js` centraliza a checagem para endpoints externos que recebem segredos:

- Validação de URL absoluta, HTTPS e ausência de espaços/controles;
- Rejeição de credenciais na própria URL, fragmentos e, por padrão, parâmetros de consulta (segredos devem seguir no transporte autorizado);
- Rejeição de **IPs literais** (inclusive representação IPv4 abreviada, decimal e IPv6), `localhost`, sufixos `.localhost`, `.local`, `.internal` e hosts sem domínio público;
- Preservação do endereço de fornecedor já válido, sem reescrever rotas existentes.

O controle passou a ser aplicado em `loadConfig` para notificações, mídia, geocodificação, pagamento, SDK de pagamento, logística, telemetria, limitação distribuída e gateways de cotação Loggi/Uber Direct. O cofre de segredos também utiliza a checagem antes de enviar seu token. O adaptador de mídia verifica novamente o destino antes de qualquer chamada assinada, mesmo quando usado diretamente.

O SDK de pagamento permite query string de versão técnica, mas segue proibindo destinos locais e credenciais embutidas.

## Testes e evidências

- `tests/provider-endpoint-security.test.mjs`: URLs e hosts malformados, loopback, endereços de rede e metadados, URL com userinfo, query/fragment, cobertura de todos os pares de configuração e garantia de **nenhuma chamada externa** por URLs inválidas;
- `tests/marketplace-providers.test.mjs`: regressão de defesa em profundidade no adaptador, sem envio de Bearer para destino inadequado;
- `tests/observability.test.mjs` e `tests/production-foundation.test.mjs`: preservação dos contratos anteriores de cofre, CORS e configuração;
- CI obrigatório: `foundation`, `wallet-postgres`, `listing-postgres`, `containers`, `browser-postgres`.

## Limites de segurança não resolvidos

**Esta checagem não é proteção completa contra SSRF, DNS rebinding ou comprometimento de DNS.** Um nome de domínio público pode resolver para IP privado, e os endpoints autorizados podem ser redirecionados por políticas de rede inadequadas. Antes da homologação externa, ainda serão necessários revisão de DNS e egress, allowlist de fornecedores efetivos, firewall/rede, TLS, segredo gerenciado e testes de infraestrutura, sem exposição de credenciais no Git. Os métodos de fornecedor já usam `redirect: "error"` onde aplicável.

Nenhuma evidência de homologação humana, contratual ou operacional foi promovida. Progresso oficial **48/70**, preflight **16/21** e piloto BH **NO-GO**.
