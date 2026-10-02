# FC-DEC-2026-10-02 — Decisões validadas pelo fundador

Data: 2 de outubro de 2026 (America/Sao_Paulo). Fonte: validação sequencial dos itens 1 a 70 nesta conversa, pelo fundador Rafael Boneco.

## Alcance do registro

São 69 itens validados como decisões de produto/operação e um item em standby (12). Validação comercial não equivale a parecer jurídico, aprovação de privacidade, contrato de fornecedor, funcionalidade implementada ou autorização de lançamento. Itens 26, 27 e 33 possuem pendência expressa de revisão de privacidade. Prazos de repasse dependem de confirmação com o fornecedor.

Este documento registra as respostas finais do fundador, inclusive alterações às propostas iniciais. Orienta futuras revisões e implementação em PRs; não modifica automaticamente as políticas pré-operacionais existentes. Divergências entre política, código e decisão devem ser resolvidas antes da operação real. Os erros do piloto permanecem para retomada, conforme instrução do usuário.

## Registro por item

| Item | Tema | Decisão validada |
| --- | --- | --- |
| 1 | Comissão de venda | 8% descontados do vendedor. Produto R$ 100: comprador paga R$ 100 pelo produto; vendedor recebe R$ 92 antes da tarifa do processador. Mostrar líquido antes de publicar. |
| 2 | Comissão logística | 5% descontados do entregador. Frete R$ 20: contratante paga R$ 20, entregador recebe R$ 19 e FraldaCycle R$ 1. Empresas parceiras dependem de contrato. |
| 3 | Processamento do produto | Tarifa descontada do vendedor, conforme oferta/condições do fornecedor de pagamentos; líquido informado antes da confirmação. |
| 4 | Taxa de troca | Cada participante paga 2,5% sobre o valor declarado do pacote que oferece. Entrega separada. Pacotes R$ 100 e R$ 80: taxas R$ 2,50 e R$ 2,00. |
| 5 | Entrega da doação | Doador paga entrega; instituição não paga produto nem entrega. Retirada no local sem cobrança logística pela plataforma. Comissão do item 2 mantida. |
| 6 | Renovação Premium | R$ 12,90/mês, renovação automática informada previamente; cancelamento a qualquer momento sem multa, impedindo próxima renovação; benefícios até fim do período pago. Reembolso/arrependimento separados. |
| 7 | Retorno ao gratuito | Até 3 anúncios ativos; usuário escolhe quais manter antes do término. Sem escolha, manter os 3 publicados mais recentemente. Excedentes pausados com dados preservados; transações em andamento continuam. |
| 8 | Falha de renovação | Aviso e 3 dias corridos para regularizar, com benefícios mantidos nesse prazo. Retentativas conforme fornecedor. Sem pagamento, retornar ao gratuito; não acumular mensalidades futuras sem benefícios ativos. |
| 9 | Frete na troca | Cada participante paga entrega do pacote que receberá. Taxa de troca separada; 5% logísticos descontados do entregador. |
| 10 | Diferença na troca | Diferença fixa paga dentro da plataforma por quem oferece pacote de menor valor. Taxas de 2,5% continuam sobre pacote oferecido. Processamento da diferença descontado de quem recebe, conforme fornecedor. |
| 11 | Frete na venda | Comprador paga frete separado do produto, informado antes de confirmar. Processamento do frete não definido por este item. |
| 12 | Processamento do frete | **STANDBY, sem aprovação definitiva.** Proposta de absorção pela FraldaCycle aguarda condições do fornecedor. Não atribuir esse custo a qualquer parte nem implementar a proposta como aprovada. |
| 13 | Repasse ao vendedor | Sempre exige aprovação do recebedor e comprovante de entrega validado, sem disputa aberta e conforme controles do fornecedor. |
| 14 | Prazo e silêncio | Até 3 dias corridos após aprovação do recebedor e validação do comprovante, sem disputa aberta; prazo a confirmar com fornecedor. Silêncio nunca autoriza liberação automática. |
| 15 | Repasse ao entregador | Aprovação do recebedor e comprovante validado; até 3 dias corridos após ambos, descontados 5%; prazo sujeito ao fornecedor. |
| 16 | Conclusão da troca | Concluir troca e liberar eventual diferença somente após as duas entregas aprovadas pelos respectivos recebedores e comprovantes validados. Entrega unilateral segue pendente para suporte. |
| 17 | Entregadores na troca | Cada entregador recebe pela própria entrega aprovada e comprovada, sem esperar a outra entrega; 5% descontados e até 3 dias corridos conforme fornecedor. |
| 18 | Recebimento institucional | Representante autorizado da instituição aprova recebimento; aprovação e comprovante validado habilitam repasse ao entregador. |
| 19 | Comprovante mínimo | Vinculado à transação, data/hora, identificação do entregador e foto do pacote entregue, evitando rostos/documentos. Aprovação do recebedor separada e obrigatória. |
| 20 | Divergência | Produto incorreto, quantidade divergente, embalagem danificada ou não recebimento seguem para análise; bloquear repasses relacionados até resolução. |
| 21 | Cancelamento antes da coleta | Devolver produto e comissões FraldaCycle. Custos de cancelamento logístico/processador sujeitos a fornecedor e revisão jurídica, com informação prévia. Aplicar também marco de exibição do endereço (23). |
| 22 | Após coleta | Sem cancelamento direto pelo usuário: recorrer ao suporte para análise de ocorrência, eventual devolução/reembolso e direitos aplicáveis. |
| 23 | Endereço | Publicamente, localização aproximada. Completo somente a quem precisar executar entrega/retirada, após confirmação. Após exibição, bloquear cancelamento direto e encaminhar pedidos ao suporte, preservando direitos aplicáveis. |
| 24 | Aviso de endereço | Confirmação explícita: “Ao confirmar, o endereço será compartilhado com os envolvidos na entrega ou retirada. Depois disso, solicitações de cancelamento deverão ser feitas pelo suporte.” |
| 25 | Acesso ao comprovante | Somente partes da operação, entregador responsável e suporte autorizado; sem uso público/promocional. Retenção será definida separadamente. |
| 26 | Dados do bebê | Coletar apenas data de nascimento para futuras ofertas integradas à idade, sem nome, foto ou saúde. Implementação pendente de revisão de privacidade. |
| 27 | Obrigatoriedade | Data de nascimento do bebê obrigatória no cadastro familiar, conforme delimitação do item 31. Requisito desejado, implementação pendente de revisão de privacidade. |
| 28 | Parceiros e idade | Data restrita à FraldaCycle; parceiros fornecem ofertas por faixa etária sem receber data de nascimento ou identificação da criança. |
| 29 | Publicidade | E-mail/SMS/notificação promocional dependem de escolha separada do responsável, inicialmente desmarcada e revogável. Recusa não impede uso da plataforma. |
| 30 | Maioridade | Conta e operações somente para adultos com 18 anos ou mais; informação do bebê vinculada ao responsável. |
| 31 | Perfis distintos | Data do bebê exigida apenas no cadastro familiar; entregadores e instituições têm cadastro próprio sem esse requisito. |
| 32 | Mais de um bebê | Permitir múltiplas datas de nascimento, sem nomes ou fotos. |
| 33 | Correção/remoção | Responsável pode corrigir/remover datas. Se remover todas, conta acessível, novas operações bloqueadas até preenchimento e transações existentes preservadas. Regra pendente de revisão de privacidade. |
| 34 | Cookies publicitários | Não usar no piloto inicial; adoção futura exige revisão de privacidade e atualização das preferências antes de ativar. |
| 35 | Contatos entre partes | Telefone/e-mail não públicos, compartilháveis entre partes somente depois de transação concluída e finalizada. Até lá, comunicação no chat sem contatos. |
| 36 | Exceção logística | Durante entrega, contato necessário acessível apenas ao entregador/fornecedor responsável, sem liberá-lo à outra parte. |
| 37 | Autorização para contatos | Mesmo após conclusão, liberar à outra parte somente com autorização expressa do titular, nunca automaticamente. |
| 38 | Avaliações | Somente após transação finalizada. Comentário pode ser público, sem contatos, endereço, dados da criança, conteúdo privado do chat ou comprovantes. |
| 39 | Contatos em avaliações | Proibir e-mail/telefone, inclusive por extenso, símbolos, espaços ou disfarces; bloquear conteúdo identificado. Denúncias de conteúdo ofensivo/fraudulento/exposição seguem ao suporte, com ocultação quando houver risco e remoção após análise. |
| 40 | Contatos no chat | Diretriz existente confirmada: sem contatos, inclusive disfarçados. Compartilhamento após conclusão apenas por recurso específico autorizado. |
| 41 | Contatos nos anúncios | Proibir contatos e convites para negociação externa no título, descrição e fotos, inclusive por extenso/disfarçados; bloquear ou encaminhar à moderação. |
| 42 | Burlas e sanções | Avisar e explicar regra; tentativas de burlar podem gerar suspensão temporária ou impedimento de ingresso/permanência, conforme moderação, com motivo e possibilidade de contestação. |
| 43 | Contestação | Pelo suporte, revisão registrada e, quando possível, por pessoa diferente da decisão inicial. |
| 44 | Suspensão e pendências | Bloquear novas operações; acesso restrito a acompanhamento e suporte para transações existentes. Suporte pode intermediar em risco de fraude/segurança. |
| 45 | Exclusão da conta | Solicitação nas configurações; tratar transações/disputas/obrigações antes do encerramento definitivo. Dados cuja conservação seja necessária com acesso restrito e retenção justificada; prazos em revisão jurídica/privacidade. |
| 46 | Mudanças nos termos | Comunicação prévia de mudanças relevantes e novo aceite quando necessário; taxas/condições novas não retroagem sobre transações confirmadas. |
| 47 | Histórico de aceite | Registrar conta, versão dos termos e data/hora, preservando histórico para auditoria/suporte. |
| 48 | Separação de escolhas | Aceitar termos não autoriza publicidade; opção promocional separada, inicialmente desmarcada, conforme 29. |
| 49 | Avisos operacionais | Enviar avisos necessários de pagamento, entrega, aprovação, disputa e segurança mesmo sem publicidade autorizada; sem ofertas promocionais nesses avisos. |
| 50 | Suporte interno | Protocolo, histórico e acompanhamento na plataforma; horários/prazos conforme capacidade real, ainda a definir. |
| 51 | Suporte externo | Por e-mail para falha de acesso/login/bloqueio/recuperação; verificar identidade antes de revelar dados/alterar conta. Endereço oficial a definir. |
| 52 | Privacidade | Solicitações de acesso, correção e exclusão via suporte da plataforma/e-mail oficial, identificadas e acompanhadas por protocolo. |
| 53 | Acesso administrativo | Apenas dados necessários à função, consultas/alterações relevantes auditadas; proibir uso pessoal/divulgação. |
| 54 | Autenticação administrativa | Contas individuais, sem compartilhar senha; dois fatores obrigatórios antes da operação real. |
| 55 | Revogação administrativa | Revogar acesso e sessões imediatamente ao encerrar função ou identificar comprometimento, com auditoria. |
| 56 | Incidentes | Conter acesso afetado, preservar evidências, acionar responsáveis; comunicações a afetados/autoridades conforme avaliação/requisitos, sem exposição sensível. |
| 57 | Backup | Protegido, acesso restrito, testes periódicos de restauração; preservar e verificar integridade das transações. |
| 58 | Testes/homologação | Dados fictícios; exceção real exige autorização específica, finalidade e controles de privacidade documentados. |
| 59 | Credenciais | Somente cofre cloud, acesso restrito, homologação/produção separadas; nunca GitHub, código, logs ou documentos. |
| 60 | Saída de fornecedor | Antes de contratar, condições de exportação/encerramento; migração preserva transações e revoga acessos antigos. |
| 61 | Seguro/garantias | Anunciar somente se efetivamente contratados/disponíveis, com limites, exclusões e responsável. |
| 62 | Instituições | Doação somente a aprovadas após conferir cadastro/documentos/representante/capacidade; declarar aceite de pacote aberto. |
| 63 | Doação aberta | Declaração: sem uso, limpas, secas, íntegras e dentro da validade; fotos da embalagem/condições. Instituição pode recusar desacordo. |
| 64 | Recusa de doação | Motivo/evidências registrados; suporte define destino e eventual retorno, analisando custos/responsabilidades. |
| 65 | Capacidade institucional | Instituição pode pausar novas doações; disponibilidade antes da confirmação e acompanhamento das existentes preservado. |
| 66 | Marca institucional | Divulgação de nome, logotipo/relatos somente com autorização registrada, finalidade, canais e prazo. |
| 67 | Piloto BH | Acesso por convite e operação restrita a Belo Horizonte; expansão somente após avaliação. Não autoriza iniciar o piloto real. |
| 68 | Pausa operacional | Pausar novas operações por incidente crítico de segurança, cobrança incorreta ou falha que comprometa entregas; suporte acompanha transações existentes até resolução. |
| 69 | Retomada | Correção da causa, testes e autorização registrada do fundador, com acompanhamento reforçado. |
| 70 | Consolidação | Registrar decisões por branch/PR, manter 12 em standby e ressalvas profissionais/fornecedores; sem autorização de lançamento ou sincronização do desktop. |

## Dependências preservadas

- Item 12: aguardar oferta do processador antes de definir processamento do frete. Os exemplos logísticos mostram comissão bruta; não comprovam margem líquida.
- Itens 13–18: não prometer prazo de repasse antes de homologar contrato, controles e capacidade do processador. Sem liberação por silêncio; disputas relevantes bloqueiam repasses relacionados.
- Itens 21–24: ausência de cancelamento direto na interface não elimina análise pelo suporte, devolução/reembolso ou direitos aplicáveis. Reconciliar marco de exibição do endereço com o fluxo antes da coleta.
- Itens 26–33: obrigatoriedade de data de criança para ofertas e bloqueio de operações após remoção exigem avaliação específica de privacidade antes de implementar; este registro não certifica adequação legal.
- Itens 39–41: regra proíbe contatos disfarçados; futura detecção precisa de testes, revisão de falsos positivos e moderação. Não afirmar que todo disfarce já é detectado.
- Dados societários, endereço oficial de e-mail, prazos de retenção, horários/SLA, responsáveis, contratos, tributação e pareceres continuam pendentes; não foram inventados neste registro.

## Rastreabilidade e próximo trabalho

Este registro será proposto em PR próprio, a partir de `main` observado na execução, e identificado pelo commit do PR. PR #60 mantém evidências/erros do piloto; PR #61 mantém preparação jurídica/financeira/privacidade. Não declarar esses PRs integrados sem verificar seus estados.

Após revisão, atualizar políticas e contratos em PR específico, distinguir requisitos implementados dos pendentes e retomar erros do piloto em branches próprias. Nenhuma aprovação acima autoriza contratar, provisionar serviços pagos, inserir credenciais ou publicar externamente.

Trabalho exclusivamente cloud e no repositório `bonecodesign/FRALDAScycle`, com mudanças documentais apenas em `platform/`. Desktop não acessado, modificado ou sincronizado. Linha de base segura: `357f58c09c5c9b41278cc4faaf98f0ee1d383e1c`.
