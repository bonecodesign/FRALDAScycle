# Paginação e repetição segura das respostas de suporte

A API lista 50 atendimentos por página, com consulta de 51 registros para indicar `hasMore`. O parâmetro `page` aceita inteiros de 1 a 100000. A ordenação é `created_at DESC, id DESC`; a conta comum consulta somente seus protocolos, enquanto a equipe com `admin:support:write` consulta a fila. As respostas continuam sem cache. `/app/help`, `/admin/operations` e `/admin/launch` possuem Anterior/Próxima; atualizar retorna à primeira página. Rascunhos são preservados. Metadados de página incompatíveis são recusados.

A migração 046 mantém mensagens anteriores legíveis e acrescenta chave e estado solicitado às novas respostas. A chave é obrigatória no POST e única por autor. Protocolo, texto e estado precisam corresponder à intenção original: reutilização com conteúdo diferente retorna 409. Uma repetição válida recupera a mensagem existente sem nova auditoria e sem reaplicar um estado antigo. A autorização administrativa é exigida antes da validação do corpo.

As duas interfaces administrativas usam sessionStorage para guardar somente uma chave aleatória e um resumo SHA-256 da intenção. O texto permanece no formulário; não é salvo nessa memória. Após falha, é necessário consultar novamente o protocolo. O mesmo conteúdo/estado reaproveita a chave pendente; um novo conteúdo gera outra chave. A confirmação remove apenas a chave da tentativa correspondente. Isso cobre a mesma sessão da aba, incluindo recarga; outra aba independente ou perda dessa memória pode gerar uma nova intenção.

## Evidências locais

- 37 testes de interface, contrato, HTTP e chave passaram, sem falhas ou skips.
- Um teste em PostgreSQL com todas as migrações e 120 protocolos comprovou páginas 50 + 10 por conta, 50 + 50 + 20 para administração, isolamento e ordenação estável de datas iguais. Cinco respostas concorrentes com a mesma chave produziram uma mensagem e uma auditoria. Conflitos de texto/estado/protocolo foram recusados; uma repetição antiga não reverteu o estado posterior.
- A beta PostgreSQL/Chromium passou e cria atendimento pela tela do cliente, percorre segunda e primeira páginas por teclado e preserva a categoria do rascunho. Na tela operacional, um wrapper de fetch simula perda da resposta **depois** do POST real concluir. A releitura e o reenvio com a mesma intenção persistem uma única mensagem. Essa simulação não representa uma interrupção física de rede.
- As jornadas anteriores permanecem na beta; a espera do botão de contato do entregador agora exige que esteja habilitado antes do acionamento.
- Sintaxe: 127 arquivos; protótipo: 83 verificações.

## Limites

A paginação usa offset e dados atuais, sem snapshot: novas inserções entre consultas podem deslocar registros. Ainda não inclui filtro de fila, atendimento humano, operação consolidada, fornecedores, reembolso ou ativação real. Responder ao suporte não executa pagamento nem cancelamento. A matriz permanece com 8/70 requisitos concluídos (11,43%) e 58/70 parcialmente implementados ou concluídos (82,86% de cobertura, não de prontidão para produção).
