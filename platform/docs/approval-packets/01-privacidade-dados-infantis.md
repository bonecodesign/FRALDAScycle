# FC-GATE-PRIV — Pacote decisório: dados infantis e perfis familiares

**Situação em 08/11/2026:** pacote para análise e assinatura por profissional jurídico/privacidade e responsáveis de produto/segurança. **NÃO APROVADO; NÃO ATIVAR COLETA**. Esta minuta não é parecer jurídico, RIPD concluído, autorização de tratamento nem declaração de conformidade LGPD.

## O que está decidido no projeto e não deve ser reinventado

- A decisão de produto `docs/decisions/FC-DEC-2026-11-03-governanca-juridica-produto.md` restringe o perfil infantil a **data de nascimento e emoji**; nome, apelido, foto, gênero, peso, saúde, documento e localização infantil são excluídos da coleta planejada.
- A finalidade definida é **faixa etária e adequação da vitrine**, não o compartilhamento de data completa com anunciantes, entregadores, instituições ou marketing. Sinais destinados a parceiros são limitados a faixas amplas sob condições adicionais.
- O responsável declara maioridade e vínculo; o consentimento específico é versionado, não presumido. Criação, correção, remoção e contestação são operações separadas com auditoria minimizada. Remover o último perfil desativa personalização, preservando a conta quando cabível.
- A funcionalidade `CHILD_PROFILES_ENABLED` permanece **false por padrão**; também há uma barreira independente de ativação. **Não alterar flags para simular homologação.**
- Evidência técnica existente: `docs/family-profile-foundation-beta.md`, `tests/family-profile-foundation.test.mjs`, `tests/child-profile-http-postgres.test.mjs`, `tests/child-data-emergency-access-postgres.test.mjs`, `tests/registration-draft-postgres.test.mjs`.
- **IDs impactados na matriz:** 26, 27, 28, 31, 32, 33, com interfaces de revisão adicionais aos IDs 45 e 46. Todos permanecem nos estados registrados em `docs/requirements-matrix.json`.

## Questões únicas a submeter à revisão humana

| Portão | Decisão exigida do revisor responsável | Prova que precisa existir |
| --- | --- | --- |
| PRIV-01 | Avaliar necessidade, proporcionalidade, risco e **melhor interesse da criança** para o uso da data completa; comparar alternativas com menor precisão. | Justificativa documentada por finalidade/campo, avaliação de risco e necessidade, revisor, versão e data |
| PRIV-02 | Identificar e justificar hipóteses legais aplicáveis a cada tratamento de responsável e criança, inclusive marketing, sem presumir que uma só hipótese sirva para todos. | Quadro de finalidade × dado × base legal × direito do titular, parecer profissional |
| PRIV-03 | Aprovar forma de comprovar autoridade do responsável, contestação de vínculo e uso excepcional por suporte, sem copiar documento infantil rotineiramente. | Protocolo de verificação/contestação, RBAC, dupla autorização, evidência de teste de abuso |
| PRIV-04 | Aprovar períodos por classe de dado: cadastro, data ativa, correções, trilha consentimento e backup (projeto propõe expiração de backup em até 30 dias). | Mapa de retenção e descarte, prova de restauração sem ressuscitar dado removido, exceções legais |
| PRIV-05 | Revisar consentimento, política, telas, direitos de correção/remoção e mudanças relevantes de termos, em linguagem clara para responsáveis. | Versões finais assinadas, trilha de aceite e retirada e amostras de comunicação, sem ativar envio |
| PRIV-06 | Aprovar ou vetar sinais por faixa para parceiros e ações de marketing; confirmar que nenhum identificador infantil ou data completa sai no payload. | Contrato de minimização, testes de saída e política de parceiro aprovada |
| PRIV-07 | Aprovar resposta a incidentes com dados infantis e registro de acesso excepcional, incluindo comunicação às pessoas e ANPD quando critérios legais se aplicarem. | Plano de resposta, registro mínimo, responsáveis e procedimento para análise de notificação |

**Base normativa de referência, sem substituir aconselhamento jurídico:** a ANPD publicou o [Enunciado CD/ANPD nº 1/2023](https://www.gov.br/anpd/pt-br/assuntos/noticias/anpd-divulga-enunciado-sobre-o-tratamento-de-dados-pessoais-de-criancas-e-adolescentes). Ele admite análise das hipóteses legais dos arts. 7º ou 11 da LGPD, mas condiciona o tratamento à prevalência do **melhor interesse da criança e do adolescente** no caso concreto. O [regulamento da ANPD sobre comunicação de incidentes](https://www.gov.br/anpd/pt-br/assuntos/noticias/anpd-aprova-o-regulamento-de-comunicacao-de-incidente-de-seguranca) é referência para preparar análise de incidentes; não pressupõe que todo incidente exija comunicação automática.

## O que o Codex pode entregar sem autorização adicional

1. **Inventário negativo e positivo de fluxo:** partir das rotas de cadastro e perfil, mapear entradas, persistência, logs, analytics, notificações, exclusão e backup para confirmar que dados infantis não escapam para provedores; sem ligar a feature.
2. **Testes sintéticos:** perfis múltiplos isolados, menor privilégio, acesso de entregador/admin negado, remoção de último perfil, concorrência, versão de aceite, ausência de data em eventos, relatórios e marketing; validar desligamento por padrão.
3. **Pacote de prova:** tabela `caminho → finalidade → risco → teste → resultado → pendência`, sem dados de crianças reais ou screenshots com dados pessoais.
4. **Diferenças de minutas:** comparar políticas legadas e a PR jurídica #227 sem afirmar revisão ou criar versão final por conta própria.

## Critério de saída: NÃO automarcável

Cada portão PRIV-01…07 requer responsável humano **a designar**, parecer/decisão com data e versão; não preenchê-los automaticamente. A aprovação documental, quando ocorrer, não liga a feature: ativação em ambiente real é decisão independente, condicionada a segurança, produto e governança.

**Sem conclusão nesta rodada:** nenhum dos IDs associados é promovido; continuam necessárias revisões profissionais e testes de homologação que ultrapassam o Codex.
