# Histórico operacional do entregador

`GET /v1/courier/history` consulta as 50 entregas mais recentemente atualizadas nos estados delivered, failed e cancelled, vinculadas ao courier_id da sessão. Entregador e administrador consultam somente sua própria atribuição. Outros papéis recebem 403; ausência de sessão recebe 401. A resposta usa no-store e contém somente identificador, estado, modalidade e data de atualização, sem endereço, contato, partes, fornecedor ou valores.

A interface é somente de leitura: não seleciona operação, não oferece registro de coleta/prova e não altera entrega ativa ou foto salva. Lista vazia, erro e resposta inválida removem cartões antigos. A consulta pode ser repetida pelo botão Atualizar histórico.

“Entrega registrada como entregue” corresponde ao estado operacional, não comprova aprovação do recebedor, validação da prova ou repasse. A tela informa que valores de repasse ainda não estão disponíveis.

Validação local: nove testes aprovados de repositório/serviço/HTTP, interface e beta integrada. HTTP cobre 401/403, identidade da sessão e no-store também no histórico. No Chromium com API/PostgreSQL locais, o comprovante enviado aparece no histórico, sai da lista ativa e não oferece botões de coleta/prova. Quatro larguras (320, 375, 768 e 1280) passaram sem overflow. Sintaxe de produção aprovada. Evidência resumida em `courier-history.json`.

Comando: `node --test tests/courier-dashboard.test.mjs tests/courier-dashboard-ui.test.mjs tests/postgres-beta.test.mjs`.

Foto e coordenadas da beta são fixtures. Não comprova entrega física, câmera/GPS, fornecedor, pagamento, repasse ou homologação humana. Paginação além das 50 mais recentes e extrato financeiro permanecem pendentes. Percentuais formais e bloqueios de produção não mudam.
