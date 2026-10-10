# Coleta: seleção confirmada para o comprovante

A tela de coleta por identificador não definia a entrega ativa usada no comprovante. Após a confirmação real da API, ela agora salva o identificador devolvido, limpa apenas a foto de outra entrega e oferece um link para registrar o comprovante. Operação já entregue não oferece novo comprovante.

Envios repetidos são bloqueados enquanto a API responde. Conta não autorizada, identificador inválido ou confirmação ausente não enviam o registro. Falha ou resposta incompleta mantém confirmação, entrega ativa e foto anteriores. Se a seleção mudar durante a solicitação, a resposta antiga não a sobrescreve. A autorização de atribuição continua no backend.

Validação local: seis testes da interface, dois dos controles de coleta e uma beta integrada passaram (9/9). O Chromium usa o link da coleta confirmada para abrir o comprovante, sem inserir artificialmente a entrega ativa na sessão. API e PostgreSQL são reais locais; foto, coordenadas e entrega física são sintéticas. Sintaxe de produção aprovada. O teste de navegação institucional passou a aguardar o elemento antes de ler sua mensagem.

Comando: `node --test tests/collection-ui.test.mjs tests/collection.test.mjs tests/postgres-beta.test.mjs`. Todos integram o job foundation do CI.

Não entrega consulta automática de todas as rotas, câmera/GPS físicos, fornecedor ou homologação humana. Não ativa produção e não altera percentuais formais.
