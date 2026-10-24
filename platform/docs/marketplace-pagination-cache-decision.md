# Paginação estável e cache do Marketplace

Estado: contrato técnico implementado; integração PostgreSQL/HTTP pendente.

## Decisão

- cursor opaco assinado com HMAC-SHA-256;
- validade de 5 minutos;
- cache privado do navegador por até 5 minutos;
- cursor vinculado aos filtros que alteram o resultado;
- mudança de filtro exige reiniciar pela primeira página;
- `limit` não faz parte da identidade dos filtros e pode ser reduzido entre páginas;
- ordem total: distância crescente, publicação decrescente, criação decrescente e UUID crescente;
- distância ausente aparece depois das distâncias conhecidas;
- sem offset dentro do cursor.

Cursores adulterados, vencidos ou usados com outros filtros devem ser recusados antes de consultar o banco. O cursor não contém dados infantis, endereço completo, número, complemento ou identidade do usuário.

## Próxima integração

A consulta PostgreSQL deve usar paginação por chave com os quatro componentes da posição, buscar `limit + 1`, gerar `nextCursor` somente quando existir outra página e manter a resposta compatível com os clientes atuais. A rota pública deve enviar `Cache-Control: private, max-age=300` e nunca compartilhar resultados personalizados em cache público.
