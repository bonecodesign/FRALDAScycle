# FraldaCycle — Auditoria Visual Final e Comando Codex v1

## 1. Marco de continuidade

- Repositório: `bonecodesign/FRALDAScycle`
- Base de referência: `main` no commit `5421eb595ce5814fd60ebc3aaa8d8a8e727958a5`
- Superfícies: Site, App e Admin
- Validação registrada na base: 147 testes da plataforma e 56 verificações do protótipo
- Progresso técnico comprovado antes deste pacote: 91%
- Fidelidade visual implementada estimada antes deste pacote: 83%
- Fidelidade visual esperada após implementação e comprovação: 93–96%

Este documento consolida requisitos para uma alteração futura. Ele não altera a `main`, não autoriza publicação, não ativa integrações e não transforma dados sintéticos em evidências reais.

## 2. Fontes normativas

1. Regras de negócio vigentes, segurança, privacidade e documentos jurídicos.
2. `FRALDACYcle_Design_System_Consolidado_v1.md`.
3. Especificações de fidelidade visual do Site, App e Admin v1.
4. Pranchas oficiais, quando não conflitarem com decisões posteriores.
5. Implementação existente, quando compatível com os itens anteriores.

Em caso de conflito, prevalece a fonte de menor número.

## 3. Restrições invioláveis

Não reintroduzir:

- Reserva;
- boleto;
- cartão de débito;
- fraldas reutilizáveis;
- métricas fictícias apresentadas como reais;
- credenciais demonstrativas em produção;
- chat operacional para combinar entrega antes do pagamento ou da proteção equivalente;
- pagamento ou negociação financeira fora da plataforma;
- integração externa, dado real, transação real ou publicação.

Doações podem aceitar pacotes abertos, desde que o estado do pacote seja informado. Venda e troca seguem as regras vigentes do produto. As opções de entrega parceira devem contemplar motoboy, carro e bicicleta, sem aparentar integração ativa quando ela não existir.

## 4. Matriz consolidada de conformidade

| ID | Superfície | Requisito final | Situação na base | Prioridade | Evidência de aceite |
|---|---|---|---|---|---|
| DS-01 | Todas | Tokens únicos e semânticos para cor, tipografia, espaço, raio, sombra e movimento | Parcial | P0 | Site, App e Admin importam a mesma fonte; teste impede cópias divergentes |
| DS-02 | Todas | Ícones SVG lineares de uma única família; sem Unicode funcional | Pendente | P0 | Varredura não encontra ícones improvisados; rótulos acessíveis presentes |
| DS-03 | Todas | Estados hover, focus, active, disabled, loading, error, success e empty | Parcial | P0 | Testes e capturas das variantes essenciais |
| DS-04 | Todas | WCAG 2.1 AA, foco visível, teclado e alvos mínimos de 44 px | Parcial | P0 | Auditoria automatizada e checklist manual sem bloqueadores |
| DS-05 | Todas | Movimento de 150–300 ms e respeito a `prefers-reduced-motion` | Parcial | P1 | Teste CSS e verificação visual com movimento reduzido |
| ST-01 | Site | Cabeçalho: Como funciona, Categorias, Anunciar, Doações e Ajuda | Divergente | P0 | Desktop e mobile com destinos válidos |
| ST-02 | Site | Hero: “Conectamos famílias. Reduzimos desperdícios. Transformamos vidas.” | Divergente | P0 | Capturas responsivas e sem quebra problemática |
| ST-03 | Site | CTAs “Começar agora” e “Saiba mais” com hierarquia clara | Divergente | P0 | Ações navegáveis e foco correto |
| ST-04 | Site | Categorias/tamanhos e bloco de doações | Parcial | P1 | Seções visíveis, acessíveis e ligadas a destinos válidos |
| ST-05 | Site | Métricas somente reais ou explicitamente “Simulado” | Conforme/parcial | P0 | Nenhum número sintético sem rótulo |
| AP-01 | App | Home com categorias RN, P, M, G e XG na hierarquia prevista | Pendente | P0 | Categorias visíveis, selecionáveis e com estado acessível |
| AP-02 | App | Navegação inferior: Início, Buscar, Publicar, Chat e Perfil | Conforme/parcial | P0 | Ícones SVG, estado ativo e rótulos acessíveis |
| AP-03 | App | Cards de anúncio consistentes em imagem, marca, tamanho, quantidade, preço e distância | Parcial | P1 | Capturas em larguras representativas, sem overflow |
| AP-04 | App | Publicação em oito etapas com progresso e validação | Existente/parcial | P0 | Caminho completo com estados de erro e retomada |
| AP-05 | App | Transparência de comissão antes da confirmação | Parcial | P0 | Percentual e valor exibidos no resumo |
| AP-06 | App | Chat protegido, liberado somente após a etapa financeira aplicável | Parcial | P0 | Testes de bloqueio e liberação; ausência de bypass visual |
| AP-07 | App | Entrega: retirada, motoboy, carro e bicicleta; estados não integrados explícitos | Parcial | P0 | Opções e indisponibilidades corretamente sinalizadas |
| AP-08 | App | Compra, troca e doação visualmente distintas e coerentes | Parcial | P1 | Fluxos e estados comparados em capturas |
| AD-01 | Admin | Login e senha obrigatórios; sem acesso direto ao painel | Existente/parcial | P0 | Teste de rota protegida e erro de autenticação sintético |
| AD-02 | Admin | Menu prioriza Dashboard, Usuários, Anúncios, Doações, Pedidos, Mensagens, Denúncias, Relatórios e Configurações | Divergente | P0 | Ordem e agrupamento aprovados em desktop e viewport reduzido |
| AD-03 | Admin | Módulos futuros agrupados e marcados como planejados/desativados/demonstrativos | Pendente | P0 | Nenhum módulo estático aparenta operação real |
| AD-04 | Admin | Dashboard preserva proporções, hierarquia e dados sintéticos identificados | Parcial | P0 | Sem overflow; rótulo “Simulado” presente |
| AD-05 | Admin | Permissões por perfil, mascaramento e trilha de auditoria | Parcial | P0 | Estados visuais e testes com identidades sintéticas |
| AD-06 | Admin | Tabelas, filtros, paginação, vazio, erro e loading consistentes | Parcial | P1 | Matriz de estados e capturas representativas |
| RG-01 | Documentação | Ausência de referências vigentes a Reserva | Pendente | P0 | Busca controlada só permite menções históricas/proibitivas |
| RG-02 | Todas | Sem imagens quebradas, overflow horizontal ou rotas principais inválidas | Parcial | P0 | Smoke visual em Site, App e Admin |

## 5. Portões de aceite

### Portão A — contrato visual

- tokens centralizados;
- ícones SVG padronizados;
- componentes essenciais com todos os estados;
- nenhuma regressão nas restrições invioláveis.

### Portão B — superfícies

- Site atende ST-01 a ST-05;
- App atende AP-01 a AP-08;
- Admin atende AD-01 a AD-06;
- layout validado em larguras representativas de mobile, tablet e desktop.

### Portão C — segurança e verdade operacional

- dados sintéticos sempre identificados;
- nenhuma credencial ou integração real;
- chat protegido sem bypass;
- módulos futuros não aparentam disponibilidade;
- nenhuma ocorrência funcional de Reserva, boleto ou débito.

### Portão D — verificação técnica

- suíte completa da plataforma aprovada, com o total atualizado após novos testes;
- 56/56 verificações do protótipo aprovadas;
- builds de Site, App, Admin e API aprovados;
- CI integralmente verde;
- comparação visual antes/depois anexada ao PR;
- revisão manual de teclado, foco, contraste e movimento reduzido;
- nenhuma publicação externa.

## 6. Ordem segura de implementação

1. Criar testes de proteção das regras removidas e da fonte única de tokens.
2. Consolidar tokens, ícones e componentes compartilhados.
3. Aplicar o Site e validar sua responsividade.
4. Aplicar o App por jornadas, começando pela Home e navegação.
5. Aplicar o Admin, priorizando menu, dashboard e sinalização operacional.
6. Remover resíduos documentais incompatíveis.
7. Gerar capturas comparativas e executar todos os portões.
8. Manter o PR em rascunho até todas as evidências estarem presentes.

Commits devem ser pequenos e separados por contrato visual, Site, App, Admin, documentação e testes.

## 7. Arquivos-alvo prováveis

O Codex deve confirmar a árvore antes de editar. Pontos já conhecidos:

- `platform/packages/ui/tokens.css`;
- componentes e assets compartilhados em `platform/packages/ui/`;
- `platform/apps/site/`;
- `platform/apps/app/`;
- `platform/apps/admin/`;
- testes em `platform/tests/`;
- documentação que ainda contenha referências antigas, incluindo `CHECKLIST_VISUALIZACAO.md` e `RELATORIO_AUDITORIA_FINAL.md`, se presentes.

Não editar o protótipo fora do fluxo aprovado. Se a política vigente exigir sincronização visual do protótipo, registrar primeiro o conflito e seguir a regra mais recente confirmada no repositório.

## 8. Critério para atualização do progresso

A preparação documental está concluída, mas não conta como fidelidade implementada. Atualizar os percentuais somente após código, capturas, testes e CI:

- Site esperado: 92–95%;
- App esperado: 94–97%;
- Admin esperado: 93–96%;
- Fidelidade geral esperada: 93–96%.

Não elevar o progresso técnico além de 91% apenas com esta especificação.

## 9. Comando definitivo para o Codex

```text
Continue o projeto FraldaCycle no repositório bonecodesign/FRALDAScycle.

Use como base a main no commit
5421eb595ce5814fd60ebc3aaa8d8a8e727958a5, ou pare e reporte se a main
remota tiver avançado. Antes de editar, confirme sincronização local/remota,
árvore limpa, instruções AGENTS.md e alterações do usuário.

Implemente o pacote de fidelidade visual definido nestes quatro documentos:
- FRALDACYcle_Especificacao_Fidelidade_Visual_Site_v1.md
- FRALDACYcle_Especificacao_Fidelidade_Visual_App_v1.md
- FRALDACYcle_Especificacao_Fidelidade_Visual_Admin_v1.md
- FRALDACYcle_Design_System_Consolidado_v1.md

Use também FRALDACYcle_Auditoria_Visual_Final_e_Comando_Codex_v1.md como matriz
de conformidade e portão de aceite. Se os documentos ainda não estiverem no
repositório, adicione-os primeiro em uma pasta de documentação coerente com a
estrutura existente.

Crie a branch agent/visual-fidelity-final. Não altere diretamente a main.
Faça commits pequenos e abra PR em rascunho.

Ordem obrigatória:
1. testes de proteção e contrato visual;
2. tokens, ícones SVG e componentes compartilhados;
3. Site;
4. App;
5. Admin;
6. resíduos documentais;
7. comparação visual e validação integral.

Preserve as regras vigentes. Não reintroduza Reserva, boleto, cartão de débito,
fraldas reutilizáveis, métricas fictícias como reais, chat operacional antes da
proteção financeira ou pagamento fora da plataforma. Doações podem aceitar
pacotes abertos quando identificados. Preserve as opções de retirada e entrega
por motoboy, carro e bicicleta, sem aparentar integração ativa.

Não use dados reais, credenciais ou transações reais. Não ative integrações,
homologação externa ou publicação. Não conceda decisão go automaticamente.

Antes de concluir:
- execute toda a suíte da plataforma e reporte o novo total;
- execute as 56 verificações do protótipo;
- execute validações de produção e builds de Site, App, Admin e API;
- faça smoke visual das rotas representativas;
- valide mobile, tablet e desktop;
- valide teclado, foco, contraste, leitores de tela e movimento reduzido;
- anexe ao PR capturas antes/depois e a matriz preenchida;
- mantenha como pendente qualquer requisito sem evidência.

Faça merge somente se o CI estiver integralmente verde, todas as verificações
P0 estiverem comprovadas e não houver alteração fora do escopo. Caso a main
tenha avançado ou haja conflito entre documentação e código, pare antes do
merge, registre o conflito e solicite decisão.
```

## 10. Resultado desta etapa

- Especificações de Site, App e Admin: concluídas.
- Design System consolidado: concluído.
- Matriz de conformidade: concluída.
- Comando de implementação: concluído.
- Código no GitHub: não alterado por esta etapa.
- Fidelidade implementada: permanece em 83% até comprovação.
