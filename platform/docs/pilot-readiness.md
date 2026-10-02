# Prontidão para piloto interno

Versão do contrato: `pilot-readiness.v1.json` (schemaVersion 1).

## Escopo atual

O piloto é exclusivamente interno e demonstrativo. Ele valida produto, navegação, segurança, acessibilidade, suporte e decisão operacional sem ativar integrações externas.

São proibidos nesta etapa:

- dados pessoais reais;
- pagamentos, estornos ou disputas reais;
- coletas e entregas reais;
- acesso público;
- credenciais ou endpoints privados;
- contratação ou provisionamento de fornecedores.

## Como validar

No diretório `platform`:

```powershell
npm run pilot:validate
npm test
```

## Pré-validação automatizada — concluída em 27 de setembro de 2026

- [x] manifesto de entrada válido e restrito a dados sintéticos;
- [x] roteiro com 21 cenários cobrindo 21 evidências sem duplicidade;
- [x] suíte automatizada com 167/167 testes aprovados;
- [x] regressão navegável com 57/57 verificações aprovadas;
- [x] integrações externas, transações reais e acesso público permanecem bloqueados.

Esta pré-validação habilita a sessão humana, mas não substitui sua execução nem a decisão de saída.

## Checklist de entrada

- [ ] regras de produto conferidas no Site, App, Admin, API e protótipo;
- [ ] contas e dados totalmente sintéticos;
- [ ] roteiro de publicação, busca, negociação e aceite sem reserva;
- [ ] venda e troca limitadas a pacote fechado;
- [ ] doação aberta condicionada à declaração sanitária;
- [ ] Pix, crédito e saldo apenas em simulação;
- [ ] boleto e débito ausentes;
- [ ] login administrativo e papéis verificados;
- [ ] roteiro de suporte e classificação de incidentes definido;
- [ ] responsáveis por interrupção e rollback identificados.

## Execução

1. Registrar versão, participantes internos e objetivo da sessão.
2. Executar cada evidência prevista no manifesto.
3. Anotar resultado como aprovado, falhou ou não executado.
4. Registrar defeitos sem dados pessoais.
5. Interromper imediatamente se houver acesso público, cobrança ou comunicação externa.
6. Consolidar achados e decisão de saída.

## Critérios de saída

- [ ] nenhuma falha crítica de segurança ou privacidade;
- [ ] nenhum retorno da funcionalidade reserva;
- [ ] regras de catálogo, pacote e pagamento preservadas;
- [ ] fluxos essenciais compreendidos pelos participantes;
- [ ] problemas priorizados com responsável;
- [ ] decisão formal: repetir piloto, avançar ou manter bloqueado.

## Regra de bloqueio

Este pacote não autoriza homologação externa nem produção. Integrações e dados reais continuam bloqueados até decisão expressa do fundador.

## Roteiro executável da sessão interna

O roteiro versionado está em `config/pilot-session.v1.json`. Ele organiza 21 cenários em ordem de execução e vincula cada cenário a uma das 21 evidências sintéticas de `config/pilot-evidence.v1.json`.

Execute a validação e imprima o roteiro operacional com:

```bash
npm run pilot:session:validate
```

O comando falha se houver cenário ausente, cobertura parcial, vínculo com portão incorreto, evidência desconhecida ou cobertura duplicada. A política impede dados reais, transações, integrações e acesso público; uma decisão interna não autoriza homologação ou publicação externa.

