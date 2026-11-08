# Inventário jurídico documental — FraldaCycle (08/11/2026)

**Estado: levantamento preliminar, pré-operacional; não é parecer jurídico.** Piloto BH NO-GO. Fonte: arquivos consultados na `main` em 08/11/2026. Este inventário não afirma que as 50 minutas FC-JUR estejam presentes individualmente.

## Documentos efetivamente localizados

| Artefato | Arquivo | Estado documental |
| --- | --- | --- |
| Termos de Uso | `docs/legal/rascunho-termos-de-uso-v2.md` | Rascunho v2, não vigente; contém placeholders de operadora, contato e vigência |
| Política de Privacidade | `docs/legal/rascunho-politica-de-privacidade-v2.md` | Rascunho v2, não vigente; faltam controladora, encarregado, canal e bases por finalidade |
| Políticas operacionais | `docs/legal/rascunho-politicas-operacionais-v2.md` | Rascunho v2; reúne marketplace, doações, entrega, reembolso, Premium, entregadores e piloto |
| Políticas de instituições | `docs/legal/politicas-operacionais-instituicoes-pre-operacionais.md` | Fonte complementar identificada por busca; revisar integralmente e reconciliar |
| Políticas de cookies e termos | `docs/legal/politicas-privacidade-cookies-termos-pre-operacionais.md` | Fonte complementar identificada por busca; reconciliar versões |
| Mapa de impactos | `docs/legal/mapa-impactos-decisoes-juridicas-2026-11-03.md` | Rastreabilidade de decisões para código, textos e gates |
| Pacote de revisão | `docs/legal-privacy-review-packet.md` | Questões abertas para jurídico e privacidade |
| Decisões do fundador | `docs/decisions/FC-DEC-2026-11-03-governanca-juridica-produto.md` | 74 decisões aprovadas internamente; validação profissional pendente |
| Consolidação FC-JUR-01 a 50 | PR [#222](https://github.com/bonecodesign/FRALDAScycle/pull/222) | Documento de governança em branch draft, não confundir com 50 textos integrais |

**Limitação do inventário:** busca textual por `FC-JUR-` não encontrou arquivos na `main`; isso não prova inexistência de arquivos não indexados, conteúdo em outras branches ou minutas fora do GitHub. Não inventar correspondência 1:1 entre 50 números e documentos.

## Lacunas documentais a fechar

1. **Identidade e vigência:** preencher razão social, CNPJ, endereço, suporte, privacidade, encarregado, data de vigência e foro juridicamente validado; nunca inventar.
2. **Bases legais:** inventário por dado/finalidade, hipótese jurídica, necessidade, compartilhamento, retenção, direitos, operador e transferência internacional; priorizar dados infantis.
3. **Conciliação de versões:** comparar termos, privacidade, cookies, política institucional e políticas operacionais com as 74 decisões; identificar textos superados e uma versão canônica por tema.
4. **Instrumentos separados:** preparar anexos de entregadores/autonomia e riscos, instituições/doações/retirada, cancelamentos/chargeback/reembolso, Premium/recorrência, política de moderação e sanções, incidentes e solicitações de titulares.
5. **Matriz FC-JUR:** para cada FC-JUR-01 a FC-JUR-50, localizar fonte integral e registrar arquivo, versão, responsável, decisão vinculada, estado e lacuna; marcar `não localizado` quando necessário, nunca `concluído` por inferência.
6. **Evidências de aceite:** relacionar documentos ao ponto de coleta/aceite, versionamento e logs; não considerar interface ativa sem teste.
7. **Pacote de homologação:** deixar preparados para assinatura os pareceres de jurídico/consumerista, LGPD/encarregado, trabalhista, financeiro/contabilidade e segurança, sem preencher aprovações fictícias.

## Roteiro executável para Codex

- **Lote D1:** listar arquivos em `platform/docs/legal/` e `platform/docs/decisions/`, inclusive fontes complementares, e gerar inventário rastreável com links de arquivo e hashes de versão. Nenhum arquivo deve ser declarado ausente sem conferir a árvore.
- **Lote D2:** gerar tabela `FC-JUR-01…50` com estado individual `localizado integralmente`, `referência indireta` ou `não localizado`; não inferir conteúdo a partir do número.
- **Lote D3:** comparar cláusulas das três minutas v2 e documentos complementares com `FC-DEC-2026-11-03`; registrar divergência, severidade e proposta de correção, sem alterar decisão do fundador.
- **Lote D4:** criar revisões v3 em arquivos novos, com `pré-operacional`, histórico de versões, placeholders explícitos, rastreabilidade e questões para revisão; não substituir documentos vigentes automaticamente.
- **Lote D5:** criar checklist de publicação, aceite e retirada, incluindo validação de linguagem clara e acessibilidade. Somente após aprovação profissional e gates permitir ativação.

## Regras inegociáveis

- Alterações somente em `platform/`; protótipo imutável.
- Não publicar textos como vigentes, habilitar pagamentos, abrir cadastro infantil ao público, contratar fornecedor, armazenar credenciais ou lançar piloto.
- PR #215 de P-01/P-02 foi integrado à `main` no commit `f51e99be`; testes verdes não equivalem a homologação da exclusão real de documentos nem a parecer jurídico.
- 42/70 requisitos concluídos, 17 parciais e 11 bloqueados conforme matriz anterior; não atualizar status sem evidência.
- Revisão humana poderá ser agrupada ao final da preparação documental, mas deve preceder qualquer operação real.
