# Validação nativa da base — PostgreSQL e Chrome

Data: 5 de outubro de 2026. Evidência executada no runner existente de GitHub Actions, com PostgreSQL nativo já instalado, cluster temporário em localhost, Chrome headless e dados fictícios. Nenhum pacote de serviço foi contratado/provisionado. O ambiente desta conversa continua bloqueando sockets, Docker e Chromium; não confundir o runner com esta máquina.

## Problemas encontrados e corrigidos

1. Auditoria das preferências promocionais/operacionais usava `$1` como UUID e texto. PostgreSQL real retornou `42P08: inconsistent types deduced for parameter $1`, abortando o salvamento. O mesmo padrão existia na revogação de outras sessões. Casts explícitos nas duas utilizações corrigem a gravação, sem alterar migrações antigas.
2. A superfície local restringia `connect-src` a self/HTTPS, mas o cliente usava outra porta HTTP de loopback. Chrome carregava a tela sem conseguir consultar a API. `SURFACE_API_ORIGIN` agora configura origem local e atributo HTML de forma consistente; só aceita HTTP em loopback, sem credenciais, caminhos ou parâmetros. O modo de produção não recebe essa concessão local.
3. Em 768 px, a camada de fidelidade sobrepunha o layout de uma coluna e causava overflow horizontal. A correção está em `platform/packages/ui/surface-layout.css`, importada após as fontes do protótipo, que permanecem intactas.
4. Limpeza do perfil efêmero do Chrome sofria corrida com processos filhos. O teste encerra o browser e o grupo de processos antes de remover o diretório, com retries limitados. Não mascarar falha de jornada como teste aprovado.

## Evidência reproduzível

Commit de código validado: `c94b0cc29c9f9cec492bc5172d96b67ff2692dfd`.

- [Foundation — CI](https://github.com/bonecodesign/FRALDAScycle/actions/runs/37301058771/job/111733616335): 256 testes aprovados, zero falhas; 83/83 verificações do protótipo preservado. Os outros jobs foundation/containers do mesmo head também concluíram com sucesso.
- `npm run check:production`: 69 arquivos. Localmente, testes puros de preferências, Premium e origem local passaram; a integração nativa é explicitamente skipped neste ambiente sem PostgreSQL, não contabilizada como aprovação local.
- `tests/postgres-beta.test.mjs` exige os executáveis no CI; ausência não vira skip silencioso. Não instala PostgreSQL ou Chrome e não chama fornecedores. Remove o cluster e os perfis temporários ao terminar.

| Camada | Efetivamente executado | Limite |
| --- | --- | --- |
| Migrações | Banco vazio; atualização desde 013 com anúncio/transação reservados fictícios; checksums e repetição | Não substitui restauração/backup ou migração de um banco real de usuários |
| Preferências | Duas gravações diferentes concorrentes na primeira versão: uma salva, outra retorna 409; retry idêntico não duplica histórico; isolamento por conta; publicidade salvar/revogar | Regra de despacho/adiamento continua sem ativação |
| Sessões | Login com hash de senha real sobre fixture, sessão persistida, revogar outras sessões preservando a atual | Não comprova dois fatores administrativos ou incidente operacional |
| Endereço de venda/retirada | Aviso obrigatório, snapshot único sob repetição concorrente, destinatário restrito, admin/entregador sem acesso à retirada, marcador e cancelamento protegido | Troca/doação/alteração pelo suporte e retenção ainda pendentes |
| Recebimento | Comprovante fictício, courier atribuído, confirmação do comprador, validação independente, permissões e repetição concorrente | Foto/mídia é uma chave fictícia; nenhum fornecedor de mídia ou comprovante real foi homologado |
| Suporte e consulta | Protocolo, ocorrência bloqueia consulta, resposta exige escopo, resolução não executa dinheiro, `payoutAllowed: false` | Pagamento é fixture inserida no banco; não houve cobrança, repasse ou reembolso |
| Chrome | Carregar/salvar/consultar/recarregar preferências usando API e PostgreSQL; termos rascunho mantêm aceite oculto | Uma jornada automatizada, não todas as rotas ou teste humano |
| Teclado | Espaço alterna checkbox; Tab percorre canais/janela/início; Enter salva e recarrega na superfície real | Não é teste humano nem validação de leitor de tela |
| Telas | 320, 375, 768, 1280 px, sem overflow, controles dentro do viewport e inputs rotulados | Emulação de viewport; nenhum dispositivo físico |

Chrome observado: `Chrome/154.0.8037.57`. Os registros `BETA_POSTGRES_CLEAN`, `BETA_SALE`, `BETA_POSTGRES` e `BETA_BROWSER` no job acima contêm resultados agregados, sem tokens ou dados reais.

## Execução local permitida

Com dependências travadas instaladas e PostgreSQL/Chrome já disponíveis: `node --test tests/postgres-beta.test.mjs`, dentro de platform. No runner de CI, o `npm test` existente executa a integração automaticamente. Isso prepara uma base reproduzível para testes internos, sem website público ou fornecedor pago.

Para superfícies locais, o padrão é API `http://127.0.0.1:4200`. Se a porta mudar, iniciar a superfície com `SURFACE_API_ORIGIN` apontando para a origem de loopback correspondente; permitir a mesma origem da superfície no CORS da API. Não usar configurações demonstrativas em produção.

Matriz permanece 6/70 = 8,57% concluídos, 35 parciais, 17 pendentes e 12 bloqueados. Testes adicionais não alteram esse numerador automaticamente. NO-GO do piloto humano e bloqueios de produção permanecem: fornecedores, privacidade infantil, termos/retenção revisados, duas entregas da troca, instituição/recusa de doação, Premium persistido, moderação/recurso e testes humanos/dispositivos/leitor de tela. Item 12 em standby.
