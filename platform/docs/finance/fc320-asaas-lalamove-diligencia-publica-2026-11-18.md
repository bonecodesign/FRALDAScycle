# FC-320 — Diligência preparatória Asaas e Lalamove | 18/11/2026

**Origem:** autorização expressa do fundador, em conversa de 18/11/2026, **somente para diligência comercial e técnica preparatória** de Asaas (PSP) e Lalamove (logística) para o piloto FraldaCycle BH. Este registro não autoriza contrato, criação de conta, uso de sandbox, processamento de pagamento, contratação de frete, abertura de fornecedor, ativação, desembolso, credencial, envio de dados pessoais ou publicação. A pesquisa pública foi realizada; **nenhuma comunicação foi enviada** aos fornecedores. Eventuais mensagens abaixo são **minutas não enviadas**.

**Fontes internas preservadas:** `docs/provider-selection.md`, `config/provider-due-diligence.v1.json`, `docs/provider-due-diligence.md`, `docs/approval-packets/02-financeiro-gateway-logistica.md`, `docs/asaas-lalamove-pilot-integration.md`, `docs/finance/fc305-preactivation-financial-preview.md`, issue #230 e matriz `docs/requirements-matrix.json`. Não substituir o inventário existente de 5 perguntas PAY e 5 LOG; este dossiê registra **apenas diferenças novas, fontes e pontos de decisão**.

## 1. Resumo da verificação pública

| Achado documental | Consequência concreta para o FraldaCycle | Portão restante |
| --- | --- | --- |
| Asaas tem Sandbox independente, com cobrança, split e webhooks simulados; a cobertura de certos testes não é equivalente à produção. [1][2] | Existe caminho de testes no futuro, mas o projeto **não** possui conta/chave de sandbox aprovada. | Autorizar sandbox em ato separado, preparar cofre, verificar recursos específicos do arranjo. |
| Split Asaas distribui sobre **`netValue`**, depois das tarifas; conta nova tem a criação de split desabilitada por padrão até habilitação do titular. [3] | A comissão de produto de 8% e a taxa do vendedor **não podem ser implementadas ou contabilizadas como percentual bruto automático** sem reconciliar os centavos e o contrato do pagador da tarifa. | Contrato/tarifas, responsável pelo desconto, desenho da subconta e reconciliação `gross → fee → netValue → split → saldo`. |
| Conta Escrow Asaas tem **mensalidade por subconta habilitada**, com responsável definido por `isFeePayer`. [4] | Custo recorrente potencial por vendedor; **não ativar** o recurso antes de calcular custo total e orçamento aprovado. Valor comercial atual **não confirmado**; taxa desconhecida não é zero. | Oferta real de preço, quem paga a mensalidade, capacidade da plataforma de absorver custos, escala de subcontas. |
| Escrow pode expirar e liberar valores automaticamente; desabilitar a funcionalidade pode encerrar garantias. [5][6] | A retenção até aprovação do recebedor **não é garantida** só por integrar a API: exige prazo compatível, decisão sobre exceção/disputa e fail-closed. | Confirmação contratual da retenção e do direito de retenção manual; proibir desativação em lote sem análise e proteção de valores. |
| Split liquidado não é o mesmo que saldo liberado quando existe Escrow; não há webhook específico documentado para alterações do estado de garantia. [7] | Não liberar repasse com base apenas em `PAYMENT_SPLIT_DONE`; exigir **consulta autenticada da garantia** com a subconta no ponto de decisão, evidência de entrega, aprovação e nenhuma disputa. | Teste ponta a ponta **posterior** com fornecedor; consultar estado/garantia e tratamento de expiração, conciliação, estornos. |
| Webhooks Asaas têm entrega *at least once*, podendo repetir eventos; mecanismo de autenticação de webhook usa `asaas-access-token` configurado, **não** a API Key. [8] | Manter deduplicação de eventos, segredo do webhook isolado e processador preparado. Não mudar o adaptador nativo existente para a rota genérica sem análise. | Sandbox com requisições autorizadas, atraso/falha/duplicidade e logs de reconciliação. |
| Documentação oficial da Lalamove lista cotação, pedido, cancelamento, webhooks, multi-paradas, ambiente sandbox e entrada em produção com crédito. [9] | Parte do fluxo de uma entrega está documentada; **não** se deve gerar pedidos reais ou adicionar créditos. Trocas precisam de **duas entregas com aceites/provas independentes** no modelo FraldaCycle. | Confirmar preços, pagamentos, cobrança do cliente, custos de cancelamento e execução das duas pernas. |
| Lalamove documenta autenticação HMAC-SHA256 e comprovante por assinatura/foto quando `isPODEnabled=true`. [10] | Fluxo possível de prova; conteúdo, acesso e retenção do comprovante **não estão contratualmente homologados**. | Confirmar modalidade, evento/campo de POD disponível por pedido API, preservação LGPD e acesso de suporte. |
| Lalamove declara operação em Belo Horizonte. [11] | **Não significa cobertura por qualquer CEP ou veículo do piloto**, nem disponibilidades garantidas em horários definidos. | Confirmar por CEP/origem/destino, tamanho/peso, distância, modalidade, horários e SLA. |
| Contato público para questões de API Lalamove: `sales.br@lalamove.com` na página brasileira. [9] | Destino para futura mensagem autorizada, **sem envio efetuado**. | Encaminhamento pelo representante do projeto; não inventar endereços ou oferta. |

## 2. Lacunas críticas a confirmar com Asaas (complemento às PAY-01…05 já existentes)

| ID | Pergunta objetiva | Evidência exigida |
| --- | --- | --- |
| FIN-AS-01 | O modelo FraldaCycle (vendedor terceiro, taxa 8% produto, 2,5% cada participante da troca, 5% serviço logístico próprio/parceiro) é elegível no arranjo comercial e regulatório com subcontas? Como são necessários CNPJ próprio e KYC/KYB? | Proposta/aceite formal do fornecedor e parecer jurídico-financeiro externo. |
| FIN-AS-02 | Como converter a **comissão de 8% sobre o preço do produto**, com processamento suportado pelo vendedor, em split que incide sobre `netValue`? Quem cria a cobrança e qual carteira recebe o saldo? | Exemplo contratual de R$ 100 com preços/tarifas **reais**, reconciliação completa e arredondamentos; sem supor tarifa zero. |
| FIN-AS-03 | Quais preços por Pix, cartão, split, criação/manutenção de subcontas, Escrow **por subconta**, saque, antecipação, disputas e estornos? `isFeePayer` pode ser ajustado contratualmente sem onerar terceiros de forma inadequada? | Tabela comercial vigente, limites/quotas, vigência e orçamento. |
| FIN-AS-04 | Podemos **segurar fundos até prova de entrega + aprovação expressa**, inclusive diante de disputa? Qual expiração máxima e tratamento se a garantia expira ou é desativada? | Condições escritas de retenção e exceções, liberação manual, garantias e responsabilidades. |
| FIN-AS-05 | Como consultar o estado atualizado da garantia com a subconta? Como conciliar `PAYMENT_SPLIT_DONE`, estorno, recusa e cancelamento? Quais testes específicos de chargeback, garantia e estorno são suportados no Sandbox? | Jornada autorizada em sandbox e protocolos de falha/retrocesso antes de produção. |
| FIN-AS-06 | Há restrições comerciais/contratuais à integração de frete de terceiros, retenção de diferença em troca, repasse após confirmação e CNPJ ainda não disponibilizado? | Resposta formal do provedor e validação contábil/jurídica. |

## 3. Lacunas críticas a confirmar com Lalamove (complemento às LOG-01…05)

| ID | Pergunta objetiva | Evidência exigida |
| --- | --- | --- |
| LOG-LA-01 | Quais CEPs/origens e destinos de BH atendidos, modalidades de moto/bicicleta/carro, peso, dimensões e janelas disponíveis no piloto? | Matriz por CEP/modalidade/horário, sem extrapolar do nome da cidade. |
| LOG-LA-02 | É permitida a integração marketplace em que o pagador final confirma cotação e a Lalamove recebe integralmente seu preço, enquanto a FraldaCycle acrescenta 5% de serviço? | Condições de contrato/faturamento, impostos, política de margem e fluxo de pagamento. |
| LOG-LA-03 | Quais são a validade do preço, itens variáveis, taxas de espera, cancelamento, não entrega, reentrega e incidências? API suporta consulta de preço real sem criação de pedido? | Política comercial e orçamento/teto de custo com observação por operação. |
| LOG-LA-04 | A API disponibiliza POD (foto/assinatura), estados, localização, eventos e opção de tratamento de disputa? Retenção, download, validade de links e dados pessoais? | Documentação contratual técnica, acesso e privacidade; não pressupor foto em toda entrega. |
| LOG-LA-05 | Como funcionam assinatura dos webhooks, duplicidade, ordem fora de sequência, retentativa, logs e idempotência? Sandbox cobre todo esse fluxo? | Especificação/teste de sandbox **autorizado futuramente**, sem pedidos externos agora. |
| LOG-LA-06 | Em uma troca, pode executar duas entregas **independentes**, cada qual com cotação, pagador, prova e confirmação própria, sem encerramento de troca por uma única entrega? | Desenho do fluxo e cláusulas comerciais/operacionais; controle financeiro sob responsabilidade da FraldaCycle. |

## 4. Minutas de solicitação técnica/comercial — NÃO ENVIADAS

### Asaas — assunto: Consulta pré-contratual de integração de marketplace FraldaCycle

Prezados(as), estamos avaliando a elegibilidade e as condições de uma integração para um marketplace de artigos infantis, inicialmente com piloto em Belo Horizonte. Gostaríamos de confirmar a possibilidade de operação com vendedores terceiros, subcontas, split baseado em valor líquido e Conta Escrow associada à comprovação de entrega e à aprovação do recebedor, inclusive em casos de disputa. Precisamos esclarecer tarifas reais por meio de pagamento, por subconta e pela garantia, condições de repasses, limites de retenção, KYC/KYB, contratualização e disponibilidade de testes específicos no Sandbox. Nesta fase solicitamos apenas informações, sem abertura de conta, ativação de serviço ou contratação. Podemos receber tabela vigente e encaminhamento ao especialista responsável? Obrigado(a).

### Lalamove — assunto: Consulta pré-contratual de API e cobertura de entregas — FraldaCycle BH

Prezados(as), estamos avaliando a integração de entregas via API para um marketplace de artigos infantis em piloto controlado em Belo Horizonte. Precisamos confirmar cobertura real por CEP/modalidade, cotação e preço final, duração da oferta, cancelamento, comprovante de entrega acessível à integração, webhooks, suporte a duas entregas independentes nas trocas e políticas de privacidade/retenção das provas. Gostaríamos também de confirmar elegibilidade comercial do modelo que acrescenta comissão própria ao preço integral do parceiro e condições de sandbox, faturamento e crédito de produção. Trata-se apenas de diligência informativa; não autorizamos pedidos reais, abertura de conta, pagamento ou contratação nesta etapa. Obrigado(a).

## 5. Matriz de elegibilidade — estado de HOJE (não aprovado)

| Gate obrigatório da diligência | Asaas | Lalamove |
| --- | --- | --- |
| Marketplace compatível contratualmente | **PENDENTE FORNECEDOR/JURÍDICO** | **PENDENTE FORNECEDOR/JURÍDICO** |
| DPA/LGPD e suboperadores | PENDENTE | PENDENTE |
| HTTPS e segurança técnica | Evidência pública parcial [8] | Evidência pública parcial [10] |
| Sandbox/forma de homologação | Evidência pública [1][2], **não utilizado** | Evidência pública [9][10], **não utilizado** |
| Tarifas/limites e custo contratual | PENDENTE — Escrow tem custo recorrente [4] | PENDENTE — produção exige crédito [9] |
| Exportação/exclusão/portabilidade | PENDENTE | PENDENTE |
| Plano de saída e SLAs | PENDENTE | PENDENTE |
| Protótipo FraldaCycle imutável | Controle interno mantido | Controle interno mantido |

**Resultado:** `aguarda_resposta_formal` para ambos. **Não** aplicar nota ponderada 0–100 ainda: a base externa comercial, jurídica e operacional não existe; não promover à condição de elegível para sandbox. Nenhum fornecedor contatado e nenhuma mensagem efetivamente enviada por esta etapa.

## 6. Efeitos sobre a matriz e próximos gates

- Itens **2, 3, 10, 12, 60**: permanecem nos estados da matriz. O item 12 (**processamento do frete**) continua **STANDBY**, sem decisão de quem suporta a tarifa, até proposta comercial confirmada e nova deliberação do fundador.
- Itens logísticos já concluídos **9, 11, 17, 18** não são reabertos. Regras aprovadas no desenho de frete externo **não** implicam contrato com Lalamove.
- Matriz oficial **48/70 = 68,57%** e piloto BH **NO-GO**, sem ativação de flag, crédito, pagamentos, entrega ou dados reais.
- O próximo trabalho **que não exige fornecedor** é analisar a reconciliação `gross/netValue/split` frente aos modelos já existentes e à questão de expiração de Escrow, comparando documentação e código sem inventar tarifas. Criar teste novo somente se identificar um bug reproduzível e não coberto.
- Para fechar a diligência comercial real, o representante autorizado precisa obter respostas e propostas formais por canal aprovado, conservar contratos e dados privados fora do GitHub e submeter à análise de financeiro, jurídico, privacidade e segurança.
- **Novo gate separado:** qualquer criação de conta/sandbox, envio de dados e ativação de integração exigem autorização específica, sem usar esta decisão como licença implícita.

### Fontes públicas oficiais consultadas em 18/11/2026

[1] https://docs.asaas.com/docs/sandbox
[2] https://docs.asaas.com/docs/o-que-pode-ser-testado
[3] https://docs.asaas.com/docs/split-de-pagamentos
[4] https://docs.asaas.com/docs/cobran%C3%A7a-da-taxa-por-subconta-configurada
[5] https://docs.asaas.com/docs/introducao-conta-escrow
[6] https://docs.asaas.com/docs/desabilitando-a-conta-escrow
[7] https://docs.asaas.com/docs/split-para-contas-com-conta-escrow
[8] https://docs.asaas.com/docs/sobre-os-webhooks
[9] https://www.lalamove.com/pt-br/empresas/solucoes-de-api
[10] https://developers.lalamove.com/
[11] https://www.lalamove.com/pt-br/perguntas-frequentes
