# Plano de fornecedores e homologação

Versão do contrato: provider-readiness.v1.json (schemaVersion 1).

Este plano prepara a seleção e a homologação sem contratar, provisionar, publicar ou armazenar credenciais. O manifesto em platform/config é a fonte legível por máquina; qualquer mudança de requisitos exige revisão versionada.

## Como validar sem credenciais

No diretório platform:

    npm run providers:validate
    npm test

O validador verifica estrutura, política de pré-contratação, nomes de variáveis e padrões comuns de credenciais. Ele não acessa a rede e não exige conta de fornecedor. Os testes dos adaptadores usam respostas e segredos exclusivamente fictícios.

## Critérios de seleção

Para cada capacidade, registre em documento interno de decisão: fornecedor candidato, região e residência de dados, preço estimado, limites, SLA, suporte, reversibilidade, LGPD/DPA, suboperadores, exportação e exclusão de dados. Não inclua tokens, chaves, URLs privadas ou dados pessoais.

Aprovação comercial, jurídica, segurança e privacidade são condições de entrada para contratação; este repositório apenas preserva requisitos técnicos neutros.

## Checklist de homologação

### Antes de receber credenciais

- [ ] requisitos do manifesto confirmados pelo fornecedor;
- [ ] sandbox gratuito ou ambiente de homologação aprovado;
- [ ] DPA/LGPD e suboperadores revisados;
- [ ] SLA, limites, retries e custos documentados;
- [ ] plano de saída e exportação confirmado;
- [ ] responsáveis técnico, segurança, jurídico e operação definidos;
- [ ] callbacks e domínios de homologação definidos sem publicação externa nesta etapa.

### Credenciais e acesso

- [ ] credenciais criadas somente no cofre do ambiente;
- [ ] menor privilégio e separação entre homologação e produção;
- [ ] rotação e revogação testadas;
- [ ] nenhuma credencial em Git, logs, tickets ou artefatos;
- [ ] allowlist de chaves e trilha de auditoria habilitadas.

### Contrato técnico

- [ ] HTTPS e validação de certificado;
- [ ] timeouts, limites e tratamento de indisponibilidade;
- [ ] idempotência de comandos;
- [ ] assinatura, antirreplay e deduplicação de webhooks;
- [ ] respostas inválidas e estados desconhecidos rejeitados;
- [ ] rate limits e backoff validados;
- [ ] payloads e retenção minimizados;
- [ ] dados sensíveis ausentes de logs e telemetria.

### Pagamentos

- [ ] tokenização PCI pelo fornecedor, sem cartão bruto na FraldaCycle;
- [ ] split, taxas, estorno, disputa e conciliação validados;
- [ ] SDK HTTPS e hash SRI oficial confirmados;
- [ ] webhooks financeiros fora de ordem e duplicados testados.

### Logística

- [ ] modalidades, cobertura e estimativas confirmadas;
- [ ] rastreamento fora de ordem e duplicado testado;
- [ ] prova de entrega, coordenadas e retenção revisadas;
- [ ] cancelamento, falha e reatribuição homologados.

### Aprovação final

- [ ] npm run providers:validate aprovado;
- [ ] npm run check:production aprovado;
- [ ] suíte completa da plataforma aprovada;
- [ ] 56 verificações do protótipo aprovadas sem qualquer alteração no protótipo;
- [ ] npm run production:doctor com ready true no ambiente de homologação;
- [ ] migração, backup, restauração, observabilidade e rollback testados;
- [ ] evidências anexadas à decisão de promoção;
- [ ] promoção autorizada pelos responsáveis.

## Regra de bloqueio

Falha em qualquer item obrigatório impede produção. Ausência de fornecedor ou credencial mantém o adaptador em modo não configurado; não se adicionam atalhos ao protótipo nem valores secretos ao repositório.
