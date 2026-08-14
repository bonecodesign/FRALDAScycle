# Matriz de conformidade visual — FraldaCycle

Esta matriz transforma os cinco documentos normativos e as pranchas oficiais do acervo em critérios verificáveis. As pranchas são referência visual; regras de negócio, segurança e privacidade têm precedência quando houver conflito.

## Fontes normativas

- [`sources/FRALDACYcle_Auditoria_Visual_Final_e_Comando_Codex_v1.md`](sources/FRALDACYcle_Auditoria_Visual_Final_e_Comando_Codex_v1.md)
- [`sources/FRALDACYcle_Design_System_Consolidado_v1.md`](sources/FRALDACYcle_Design_System_Consolidado_v1.md)
- [`sources/FRALDACYcle_Especificacao_Fidelidade_Visual_Site_v1.md`](sources/FRALDACYcle_Especificacao_Fidelidade_Visual_Site_v1.md)
- [`sources/FRALDACYcle_Especificacao_Fidelidade_Visual_App_v1.md`](sources/FRALDACYcle_Especificacao_Fidelidade_Visual_App_v1.md)
- [`sources/FRALDACYcle_Especificacao_Fidelidade_Visual_Admin_v1.md`](sources/FRALDACYcle_Especificacao_Fidelidade_Visual_Admin_v1.md)
- Acervo oficial: `FraldaCycle_Acervopng_Page6.png` a `FraldaCycle_Acervopng_Page68.png`

As cinco especificações textuais oficiais estão versionadas integralmente neste repositório. As pranchas PNG permanecem no acervo visual de origem devido ao seu volume; a faixa de páginas e os critérios derivados estão registrados nesta matriz, sem depender de caminhos absolutos de uma estação local.

## Cobertura por requisito

| ID | Critério | Pranchas de referência | Evidência no repositório | Estado |
|---|---|---|---|---|
| DS-01 | Paleta semântica consolidada | 7–8, 16, 21–24 | `platform/packages/ui/tokens.css` | Implementado |
| DS-02 | Poppins em títulos e Inter na interface | 7–9, 16, 21 | `tokens.css` e fontes das superfícies | Implementado |
| DS-03 | Escala 4px, raios e sombras | 7, 11–13, 16, 21–24 | `tokens.css` | Implementado |
| DS-04 | Estados, foco, alvo mínimo e contraste AA | 9–12, 15, 17, 22–25 | tokens e testes de contrato | Em validação |
| DS-05 | Movimento 150–300ms e redução de movimento | 7, 12, 18, 21–23 | `tokens.css` | Implementado |
| ST-01 | Cabeçalho institucional completo | 30–45 | `platform/apps/site/index.html` | Em validação |
| ST-02 | Hero e CTAs normativos | 30–45 | `platform/apps/site/index.html` | Em validação |
| ST-03 | Como funciona e categorias | 46–48 | Site e catálogo | Em validação |
| ST-04 | Bloco de doação com regra higiênica | 46–48 | Site | Em validação |
| ST-05 | Rodapé e responsividade | 21–24, 46–48 | Site e CSS compartilhado | Em validação |
| AP-01 | Splash e onboarding | 30–45 | protótipo App | Implementado |
| AP-02 | Login, cadastro, recuperação e OTP | 40–45 | protótipo App | Implementado |
| AP-03 | Home e navegação inferior com 5 itens | 14, 40–48 | protótipo App | Em validação |
| AP-04 | Busca, filtros e resultados | 46–48 | protótipo App | Implementado |
| AP-05 | Detalhes, perfil, favoritos e publicação | 46–48 | protótipo App | Implementado |
| AP-06 | Negociação e comunicação protegida | 49–51 | protótipo App | Implementado |
| AP-07 | Pagamentos permitidos e transparência | 52–60 | protótipo App | Implementado |
| AP-08 | Logística e rastreamento | 61–62 | protótipo App | Implementado |
| AD-01 | Acesso administrativo e RBAC | 63 | Admin e testes RBAC | Implementado |
| AD-02 | Navegação agrupada por módulos | 63–64 | Admin | Em validação |
| AD-03 | Dashboard e indicadores sintéticos rotulados | 63–64 | Admin | Implementado |
| AD-04 | Gestão, moderação, auditoria e alertas | 63–65 | Admin | Implementado |
| AD-05 | Relatórios, exportação e inteligência | 64 | Admin | Implementado |
| AD-06 | Estados vazios, erro, carregamento e responsividade | 15, 22–25, 63–65 | Admin e CSS | Em validação |
| RG-01 | Proibição de fluxos e integrações não aprovados | 52–60 + normas | testes de plataforma | Implementado |
| RG-02 | Dados exclusivamente sintéticos e rotulados | 19, 25, 63–68 | rótulos globais em Site, App e Admin + contrato automatizado | Em validação |

## Regra de aceite

Um item só passa a `Validado` após: implementação, teste automatizado, captura visual nas três superfícies e comparação com as pranchas correspondentes. Nenhuma integração real, credencial, homologação externa ou publicação é autorizada por esta matriz.
