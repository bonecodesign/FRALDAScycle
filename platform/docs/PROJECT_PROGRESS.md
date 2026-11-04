# FraldaCycle — Indicadores oficiais de progresso (v1.0)

Data de estabelecimento: 2026-11-04. Escopo: exclusivamente `platform/`; protótipo imutável.

## Três indicadores distintos

1. **Conclusão ponderada**: soma de `peso_area × progresso_validado_area / 100` (0–100%). Não confundir implementação com homologação.
2. **Qualidade e homologação**: requisitos de validação/homologação aprovados com evidência válida divididos pelos requisitos de validação/homologação aplicáveis; reportar também denominador e itens bloqueados.
3. **Prontidão de lançamento**: gates críticos obrigatórios (CI verde no SHA candidato, revisão de segurança/privacidade/jurídica, integrações reais homologadas, infraestrutura de produção, recuperação, piloto e aprovação humana). **Só 'apto' quando TODOS os gates estiverem aprovados**. Não calcular média que oculte bloqueios.

## Pesos por domínio (soma 100)

| Domínio | Peso |
|---|---:|
| Planejamento e governança | 10 |
| Modelo econômico e comercial | 10 |
| Backend e banco de dados | 20 |
| Aplicativo, site e admin | 15 |
| Segurança e privacidade | 15 |
| Infraestrutura e fornecedores | 10 |
| Testes e homologação | 15 |
| Preparação operacional | 5 |

## Requisitos e evidências

Cada requisito possui: ID estável, domínio, descrição, peso interno, responsável, status, critério de aceite, link de evidência, SHA/ambiente, data da verificação e bloqueadores.

Estados: `nao_iniciado`, `em_desenvolvimento`, `implementado`, `validado`, `homologado`, `bloqueado`. Pontuação conservadora: 0, 25, 60, 85, 100 e pontuação do último estado comprovado (ou 0 quando nenhum) para bloqueado, respectivamente. Os pesos internos por domínio devem somar 100. Estados sem evidência verificável NÃO avançam além de `em_desenvolvimento`. Evidência de testes só é válida para o SHA/ambiente correspondente; resultado anterior não substitui CI atual.

## Cálculo

`progresso_dominio = SUM(peso_requisito * pontuacao_estado)/100`.

`conclusao_geral = SUM(peso_dominio * progresso_dominio)/100`.

O percentual oficial **permanece 'não aferido'** até existir inventário completo de requisitos, pesos internos normalizados e links de evidência revisados. Não converter estimativas anteriores (ex.: 83%) em medição oficial.

## Gates de lançamento

- CI do commit candidato verde: testes de plataforma, PostgreSQL, foundation, containers e regressão do protótipo quando aplicáveis.
- Segurança, privacidade, jurídico e aprovações independentes documentadas.
- Pagamento, entregas e demais provedores necessários contratados e homologados quando autorizados.
- Produção, backups/restauração, monitoramento e resposta a incidentes verificados.
- Piloto operacional controlado aprovado e aceite final explícito.

Qualquer gate não aprovado implica `NAO_APTO`; `DESCONHECIDO` não é `APROVADO`.

## Cadência e relatório

Atualizar após PR relevante e ao final de cada ciclo de homologação. Exibir data, SHA da main, conclusão aferida (ou não aferida), qualidade/homologação, gates, bloqueios, diferenças desde a última medição e links. Alterações de escopo devem versionar os pesos e preservar histórico; nunca melhorar o percentual removendo requisitos pendentes sem decisão documentada.

## Linha de base inicial — 2026-11-04

- Último commit identificado na consulta: `4171678daf6f02b88ac4352975ca4a5e9d9b993c` (PR #180).
- Evidências de implementação: PRs #174–#180; não equivalem a aceite operacional.
- CI desse commit: não confirmado pelo conector (consulta de runs de PR retornou vazia).
- Conclusão oficial: **NÃO AFERIDA** (inventário de requisitos e evidências ainda não consolidado).
- Homologação oficial: **NÃO AFERIDA**.
- Lançamento: **NÃO APTO**; fornecedores reais, homologação operacional e aprovações permanecem pendentes.

Nenhuma credencial, contratação, provisionamento pago ou publicação externa é autorizada por este documento.
