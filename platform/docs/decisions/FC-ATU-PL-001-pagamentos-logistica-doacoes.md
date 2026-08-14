# FraldaCycle — Atualização oficial de pagamentos, logística e doações

**Documento:** FC-ATU-PL-001  
**Versão:** 1.1  
**Data:** 13 de agosto de 2026  
**Status:** Aprovado para incorporação ao projeto  
**Abrangência:** aplicativo, site, painel administrativo, backend, integrações, testes e documentação

## 1. Objetivo

Este documento consolida as decisões aprovadas para o modelo transacional, pagamentos, logística e doações do FraldaCycle. Suas regras devem orientar a atualização do produto e prevalecem sobre definições anteriores incompatíveis.

## 2. Modelo operacional

O FraldaCycle será um **marketplace C2C transacional de economia circular, com pagamento protegido, split de pagamentos e logística integrada**.

A plataforma conecta compradores, vendedores e participantes de trocas sem manter estoque próprio. Os produtos permanecem com os usuários até a coleta ou retirada.

Toda compra ou troca deverá ser registrada e financeiramente processada dentro da plataforma. O FraldaCycle deverá preservar histórico, evidências, suporte, reputação, proteção financeira e rastreabilidade logística.

## 3. Condições fixas e ausência de contraproposta

Não existirão oferta, contraproposta, leilão ou negociação de preço e condições nas compras ou trocas.

### 3.1 Venda

O vendedor publica previamente produto, quantidade, preço, condição, validade e opções logísticas. O comprador pode:

- aceitar integralmente as condições e comprar;
- desistir da operação.

### 3.2 Troca

O anunciante define previamente o produto oferecido, os produtos aceitos, eventual diferença fixa e as condições logísticas. O outro usuário pode:

- aceitar integralmente a troca;
- desistir da operação.

### 3.3 Restrições de produto

O aplicativo e o site não deverão oferecer:

- botão para fazer oferta;
- campo de contraproposta;
- negociação de preço ou diferença;
- alteração das condições pelo chat;
- conclusão por valor diferente do registrado.

O chat terá finalidade exclusivamente operacional e será liberado após a confirmação do pagamento ou da cobrança da troca.

## 4. Diretriz de pagamentos — FC-DIR-PL-001

Os pagamentos deverão ser processados por provedor especializado em marketplaces. O FraldaCycle não deverá armazenar dados de cartão nem usar repasses manuais como fluxo normal.

### 4.1 Capacidades obrigatórias

- Pix e cartão de crédito;
- cadastro e validação de recebedores pessoa física;
- split de pagamentos;
- webhooks de atualização;
- estorno total ou parcial;
- conciliação e relatórios;
- tratamento de contestação e chargeback;
- configuração de transferência ou saque;
- ambiente de testes;
- compatibilidade formal com marketplace C2C.

### 4.2 Regra financeira vigente

- venda: comissão de **8% sobre o valor do produto**;
- troca: taxa total de **5%**, sendo **2,5% por participante**;
- logística: comissão de **5% sobre o custo logístico**, apresentada no checkout;
- diferença fixa de uma troca: cobrada dentro da plataforma;
- tarifa do processador: registrada separadamente para conciliação e rentabilidade.

### 4.3 Pagamento protegido

O desenho operacional deverá impedir a disponibilidade irrestrita do valor ao vendedor antes da conclusão da operação. O mecanismo final depende da solução contratada e deverá ser homologado juridicamente, comercialmente e tecnicamente.

O repasse poderá permanecer bloqueado enquanto houver entrega pendente, prazo de reclamação, disputa, suspeita de fraude, contestação ou ocorrência logística.

### 4.4 Provedor candidato

O **Pagar.me/Stone** permanece como candidato prioritário para homologação por oferecer estrutura de marketplace, split e recebedor pessoa física. Isso não equivale a contratação ou aprovação definitiva.

Antes da produção deverão ser confirmados: aceite do modelo C2C, política de liberação condicionada, tarifas, responsabilidades por chargeback, KYC e prazos de transferência.

## 5. Diretriz logística — FC-DIR-LOG-002

O FraldaCycle adotará **orquestração logística multicarrier com cotação dinâmica e escolha assistida pelo comprador**.

O sistema deverá consultar os fornecedores integrados disponíveis para a rota e apresentar as alternativas elegíveis. A opção mais barata será identificada, mas o comprador escolherá a entrega desejada.

### 5.1 Dados apresentados

Cada opção deverá informar:

- fornecedor;
- modal ou veículo;
- valor do frete;
- comissão logística;
- preço total;
- prazo estimado;
- disponibilidade;
- capacidade e restrições;
- identificação sustentável, quando confirmada.

### 5.2 Selos de comparação

- **Mais barata:** menor preço total disponível;
- **Mais rápida:** menor prazo estimado;
- **Sustentável:** bicicleta ou veículo elétrico confirmado para aquela entrega;
- **Sustentável mais econômica:** menor preço entre os modais sustentáveis.

Um fornecedor não poderá receber selo sustentável apenas por possuir veículos de baixa emissão em sua frota. O modal da entrega específica deverá estar confirmado.

### 5.3 Regras da cotação

- opções incompatíveis com rota, peso ou dimensões não serão exibidas;
- o preço será atualizado se a cotação expirar antes do pagamento;
- o pedido logístico somente será criado após pagamento confirmado;
- não haverá contraproposta de frete;
- o comprador poderá comparar preço, prazo e modal;
- falha antes da coleta poderá gerar nova cotação;
- após a coleta, mudanças seguirão o fluxo de ocorrência;
- o sistema registrará a opção escolhida e os eventos da entrega.

### 5.4 Validação física

Pacotes de fraldas podem ser leves e volumosos. A elegibilidade do modal deverá considerar:

- peso;
- altura;
- largura;
- comprimento;
- quantidade de volumes;
- limites do fornecedor e do veículo.

## 6. Fornecedores do piloto em Belo Horizonte

A ordem institucional e de integração aprovada é:

| Ordem | Fornecedor | Papel no piloto | Estado |
|---:|---|---|---|
| 1 | Lalamove | Logística urbana principal por API | Candidato prioritário à homologação |
| 2 | Uber Direct | Segunda integração urbana | Candidato prioritário à homologação |
| 3 | Loggi | Terceira integração urbana e redundância | Candidato à homologação |
| 4 | Dizzy Express | Entrega sustentável por bicicleta | Parceira local potencial |
| 5 | Clube Motoboy | Contingência local e atendimento humanizado | Parceiro potencial de contingência |

A ordem acima não obriga a escolha pelo comprador nem impede que um fornecedor posterior ofereça melhor preço ou prazo. Ela define prioridade institucional, técnica e operacional.

### 6.1 Lalamove

Deverá ser avaliada para cotação, criação de pedido, agendamento, rastreamento, dados do motorista, foto de coleta, comprovante de entrega, códigos, cancelamentos, carteira ou faturamento e coleta em origens residenciais variáveis.

### 6.2 Uber Direct

Deverá ser avaliado como solução empresarial integrada, distinta do pedido manual pelo aplicativo Uber Envios. A homologação deve cobrir cotação, criação, rastreamento, prova de entrega, limites físicos, proteção do item e retorno ao remetente.

### 6.3 Loggi

Deverá ser avaliada como alternativa urbana e possível ponte para operações mais amplas. A homologação deve confirmar coleta residencial variável, cotação, rastreamento, comprovantes, tratamento de ocorrências e cobertura por CEP.

### 6.4 Dizzy Express

Deverá ser avaliada para entregas de bicicleta em BH. Enquanto não houver integração automática, poderá operar por processo semiautomático ou acionamento administrativo, desde que haja controle de preço, disponibilidade, coleta, entrega e evidências.

### 6.5 Clube Motoboy

Será considerado fornecedor de contingência para indisponibilidade, falha ou inadequação dos fornecedores principais. Poderá operar inicialmente por painel, canal empresarial ou acionamento manual controlado.

## 7. Estrutura sustentável

Bicicletas e veículos elétricos permanecem modais válidos da orquestração logística.

O sistema deverá reconhecer, quando confirmados pelo fornecedor:

- bicicleta convencional;
- bicicleta elétrica;
- motocicleta elétrica;
- carro elétrico;
- outros modais de baixa emissão homologados.

A Dizzy Express é a candidata operacional inicial para bicicleta. A modalidade sustentável deverá aparecer com destaque próprio sempre que estiver disponível, sem ocultar alternativas mais baratas ou rápidas.

## 8. Estrutura de expansão

O **Melhor Envio** fica reservado para o processo de expansão regional e nacional, não sendo dependência do piloto local em BH.

Sua ativação deverá ocorrer quando houver:

- vendas entre municípios ou estados;
- operação fora da cobertura urbana;
- necessidade de transportadoras nacionais e Correios;
- processo oficial de expansão;
- capacidade operacional para embalagem, etiqueta, postagem, coleta e declaração de conteúdo.

Na homologação nacional deverão ser tratadas as diferenças de documentação, DC-e, nota fiscal, seguro, coleta, postagem e restrições por transportadora e rota.

## 9. Parceria futura

A **Be Bike** fica registrada como potencial parceira futura de infraestrutura sustentável, e não como transportadora do piloto.

Possíveis frentes:

- fornecimento ou assinatura de bicicletas;
- bicicletas elétricas para entregadores parceiros;
- manutenção e suporte;
- ampliação da capacidade da rede sustentável;
- condições especiais para parceiros do FraldaCycle;
- ações conjuntas de impacto ambiental.

## 10. Itens fora do escopo atual

A **99Entrega** fica fora do escopo inicial. Não deverá aparecer nas integrações, checkout, testes, cálculos ou fornecedores ativos do piloto. Poderá ser reavaliada futuramente.

O Melhor Envio e a Be Bike deverão aparecer somente como itens planejados, sem simular disponibilidade no piloto.

## 11. Fluxo de compra

1. O comprador aceita o preço fixo do anúncio.
2. O sistema valida endereços, peso, dimensões e disponibilidade.
3. Os fornecedores elegíveis são consultados.
4. O checkout apresenta alternativas, preço total, prazo e selos.
5. O comprador escolhe a entrega e paga dentro da plataforma.
6. O provedor confirma o pagamento por webhook.
7. O anúncio é bloqueado e o pedido é registrado.
8. Chat e dados estritamente necessários são liberados.
9. O pedido logístico é criado ou encaminhado ao processo controlado.
10. Coleta e entrega são comprovadas.
11. Abre-se o prazo aplicável para reclamação.
12. Sem ocorrência, a operação é concluída e o repasse segue a regra homologada.

## 12. Fluxo de troca

A troca terá duas rotas vinculadas:

- participante A para participante B;
- participante B para participante A.

Cada participante escolherá e pagará sua entrega e sua taxa de 2,5%. Eventual diferença fixa será cobrada dentro da plataforma. A operação somente será concluída após a confirmação dos dois recebimentos.

Se somente um pacote for entregue, a conclusão e os valores relacionados deverão permanecer bloqueados para análise.

## 13. Diretriz de doações — FC-DIR-DOA-004

As doações serão exclusivamente institucionais. Usuários somente poderão doar fraldas para instituições parceiras previamente cadastradas, verificadas e aprovadas pelo FraldaCycle.

Não serão permitidas doações de usuário para usuário. Qualquer definição anterior que permita doação direta entre pessoas usuárias fica substituída por esta diretriz.

### 13.1 Participantes e destino

- doador: usuário cadastrado no FraldaCycle;
- destinatário: instituição parceira verificada;
- operação permitida: usuário para instituição;
- operação proibida: usuário para usuário;
- a instituição deverá estar ativa e apta a receber doações;
- instituições suspensas, vencidas ou não homologadas não poderão receber novas doações.

### 13.2 Produtos aceitos

As doações continuam limitadas a fraldas descartáveis das categorias:

- infantis;
- para piscina.

Poderão ser doados pacotes fechados ou abertos. Para pacotes abertos, o anúncio deverá informar claramente:

- quantidade exata de unidades;
- tamanho, marca e modelo, quando identificáveis;
- validade, quando aplicável;
- estado de conservação;
- forma de armazenamento;
- fotos reais do pacote e das unidades;
- ausência de umidade, sujeira, odor, contaminação ou avaria.

Não poderão ser doadas fraldas usadas, vencidas, contaminadas, úmidas, avariadas ou armazenadas de forma inadequada.

### 13.3 Fluxo institucional

1. A instituição solicita cadastro e apresenta os dados e documentos exigidos.
2. O FraldaCycle analisa, aprova e identifica a instituição como parceira verificada.
3. A instituição informa suas necessidades por categoria, tamanho, quantidade e região.
4. O usuário seleciona uma instituição disponível; não poderá selecionar outro usuário como destinatário.
5. O usuário registra as características, quantidade, condição, fotos, peso e dimensões das fraldas.
6. A instituição aceita a doação quando o fluxo ou a campanha exigir confirmação prévia.
7. O sistema apresenta retirada programada ou alternativas logísticas elegíveis.
8. A parte responsável escolhe a entrega e confirma o pagamento do frete, quando houver.
9. O pedido logístico é criado somente após as confirmações necessárias.
10. Coleta, rastreamento, ocorrências e entrega ficam registrados.
11. A instituição confirma o recebimento.
12. O sistema conclui a doação e poderá emitir comprovante digital operacional.

O comprovante digital registra a entrega, mas não deverá ser apresentado automaticamente como recibo fiscal, dedução tributária ou certificação jurídica sem validação específica.

### 13.4 Regras financeiras

- valor das fraldas: **R$ 0,00**;
- comissão sobre o produto: não se aplica;
- taxa de troca: não se aplica;
- repasse ao doador: não existe;
- frete: poderá ser pago pelo doador, pela instituição ou subsidiado pelo FraldaCycle ou por parceiro, conforme a campanha;
- comissão logística: **5% sobre o custo logístico**, quando a entrega for contratada pela plataforma;
- campanhas com isenção ou subsídio exigirão regra previamente cadastrada e aprovada;
- retirada programada sem fornecedor logístico não gera comissão logística.

### 13.5 Logística das doações

As doações seguirão as regras de cotação multicarrier, validação de peso e dimensões, rastreamento, evidências, ocorrências e comprovação de entrega definidas neste documento.

A ordem institucional do piloto permanece: Lalamove, Uber Direct, Loggi, Dizzy Express e Clube Motoboy. Sempre que operacionalmente possível, o sistema poderá consolidar várias doações destinadas à mesma instituição em uma única coleta, preservando a identificação e a rastreabilidade de cada doação.

O endereço completo da instituição ou do ponto de recebimento deverá permanecer protegido até as confirmações necessárias. Somente os dados estritamente necessários à execução da coleta e da entrega serão compartilhados.

### 13.6 Requisitos da instituição parceira

O cadastro e a homologação deverão contemplar, conforme a natureza da instituição:

- identificação e dados de contato;
- CNPJ ou justificativa formal para estrutura jurídica diversa;
- representante responsável;
- documentos de constituição e funcionamento exigíveis;
- endereço ou ponto de recebimento;
- horários e capacidade de recebimento;
- categorias e tamanhos aceitos;
- política para pacotes abertos;
- validade dos documentos e revisão periódica;
- aceite dos termos, responsabilidades e tratamento de dados;
- registro de suspensão, bloqueio ou encerramento da parceria.

### 13.7 Impactos nos sistemas

**Aplicativo e site:**

- remover ou impedir qualquer opção de doação para outro usuário;
- exibir somente instituições verificadas e ativas;
- oferecer busca e seleção por instituição, necessidade e região;
- identificar claramente cada destinatária como **Parceira verificada**;
- mostrar quem pagará o frete e eventual subsídio antes da confirmação;
- permitir o acompanhamento até a confirmação institucional do recebimento.

**Painel administrativo:**

- cadastrar, verificar, aprovar, suspender e reativar instituições;
- administrar documentos, validade, necessidades e campanhas;
- acompanhar doações, logística, subsídios, ocorrências e recebimentos;
- impedir novas doações para instituições não homologadas ou suspensas;
- manter trilha de auditoria das decisões administrativas.

**Backend e dados:**

- restringir o destinatário da doação ao tipo `instituicao_verificada`;
- impedir por regra de domínio e autorização a criação de doação para usuário;
- separar estados, cobranças e comprovantes de doação dos fluxos de venda e troca;
- registrar pagador do frete, subsídio, campanha e instituição destinatária;
- proteger endereços e dados institucionais conforme a finalidade operacional.

**Testes:**

- rejeitar doação de usuário para usuário em interface e API;
- rejeitar instituição inexistente, suspensa ou não verificada;
- validar pacotes abertos e suas informações obrigatórias;
- verificar frete pago por cada modalidade admitida e casos subsidiados;
- validar comissão logística e casos de isenção aprovados;
- testar coleta, rastreamento, recebimento, comprovante e ocorrência;
- assegurar que venda e troca entre usuários permaneçam independentes.

## 14. Retirada combinada

A retirada combinada poderá coexistir com os fornecedores logísticos quando aplicável. Ela seguirá as mesmas regras de proteção:

- pagamento antes da liberação do chat;
- endereço residencial oculto quando não necessário;
- possibilidade de ponto público ou parceiro;
- código de uso único para confirmação;
- registro de data, horário e participantes;
- liberação do repasse somente conforme a regra homologada.

Nas doações, a retirada deverá ocorrer em instituição parceira ou ponto de recebimento aprovado. Não haverá retirada combinada entre o doador e outro usuário como destinatário da doação.

## 15. Estados mínimos da transação

O sistema deverá suportar, no mínimo:

- aguardando pagamento;
- pagamento em análise;
- pago;
- aguardando preparação;
- cotando entrega;
- aguardando coleta;
- coletado;
- em rota;
- entregue;
- prazo de reclamação;
- concluído;
- falha logística;
- cancelado;
- disputa aberta;
- reembolso pendente;
- reembolsado.

Para doações, deverão existir ainda estados compatíveis com o fluxo institucional, incluindo: aguardando aceitação institucional, aceita, recusada, aguardando definição do frete, aguardando recebimento institucional e doação concluída.

## 16. Painel administrativo

O painel deverá permitir:

- acompanhar pagamentos, splits, taxas e repasses;
- visualizar cotações e fornecedor escolhido;
- acompanhar coleta e entrega;
- acionar contingência;
- registrar decisões e evidências;
- tratar cancelamentos, disputas e reembolsos;
- comparar custo, prazo e taxa de sucesso por fornecedor;
- acompanhar uso de modais sustentáveis;
- distinguir integração real, simulada, planejada e não configurada;
- impedir ações reais enquanto credenciais e homologação não existirem;
- verificar instituições e controlar validade documental;
- administrar necessidades, campanhas e subsídios de doação;
- acompanhar aceite e recebimento institucional;
- bloquear doações destinadas a usuários ou instituições inativas.

## 17. Indicadores

- custo médio do frete;
- economia gerada pela comparação;
- tempo médio de coleta e entrega;
- taxa de aceite e conclusão por fornecedor;
- cancelamentos e falhas;
- entregas por modal;
- percentual de entregas sustentáveis;
- disputas por fornecedor;
- receita logística do FraldaCycle;
- tarifa financeira por meio de pagamento;
- margem líquida por transação.
- quantidade de doações por instituição, categoria e tamanho;
- unidades doadas e taxa de recebimento institucional;
- custo logístico e subsídio por doação;
- percentual de pacotes abertos e fechados recebidos;
- recusas, cancelamentos e ocorrências nas doações.

Estimativas ambientais deverão identificar metodologia e fonte. Não poderão ser apresentadas como medição exata sem dados suficientes.

## 18. Requisitos de homologação

Nenhum fornecedor será considerado ativo em produção antes de validar:

- contrato e aceite do modelo de negócio;
- cobertura geográfica;
- API, painel ou procedimento operacional;
- ambiente de testes quando aplicável;
- tarifas e faturamento;
- coleta em endereços residenciais variáveis;
- limites de peso, dimensões e valor;
- rastreamento e webhooks;
- provas de coleta e entrega;
- cancelamento, retorno e nova tentativa;
- seguro, extravio, avaria e violação;
- suporte e SLA;
- proteção de dados;
- conciliação e auditoria;
- responsabilidades das partes.

## 19. Impacto de implementação

Esta atualização exige revisão coordenada de:

- modelos de dados de pedido, pagamento, cotação e entrega;
- máquina de estados de vendas e trocas;
- checkout e cards de frete;
- bloqueio do chat antes do pagamento;
- adaptadores independentes por fornecedor;
- webhooks e idempotência;
- painel administrativo;
- relatórios financeiros e logísticos;
- políticas, termos e privacidade;
- testes unitários, integração, contrato e ponta a ponta;
- documentação do aplicativo, site e administração.
- cadastro, verificação e gestão das instituições parceiras;
- fluxo de doação exclusivamente institucional;
- validação de pacotes abertos e regras de conservação;
- campanhas, responsabilidade pelo frete e subsídios;
- comprovante operacional e confirmação de recebimento institucional.

Os conectores deverão ser substituíveis. Nenhum fluxo central poderá depender diretamente da estrutura interna de um único fornecedor.

## 20. Resumo executivo da decisão

**Piloto em Belo Horizonte:** Lalamove, Uber Direct, Loggi, Dizzy Express e Clube Motoboy, nessa ordem institucional.  
**Pagamento candidato prioritário:** Pagar.me/Stone, sujeito à homologação.  
**Expansão regional e nacional:** Melhor Envio.  
**Parceria sustentável futura:** Be Bike.  
**Fora do escopo inicial:** 99Entrega.  
**Regra comercial:** preço e condições fixos, sem contraproposta.  
**Experiência logística:** cotação multicarrier, identificação da mais barata e escolha final do comprador.
**Doações:** exclusivamente de usuários para instituições parceiras verificadas; doações entre usuários são proibidas.  
**Produtos doáveis:** fraldas descartáveis infantis e para piscina, em pacotes fechados ou abertos que atendam aos critérios de conservação.  
**Cobrança em doações:** produto gratuito, sem comissão comercial; frete e comissão logística somente quando houver entrega contratada pela plataforma, observados subsídios ou isenções aprovados.
