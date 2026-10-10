# Recuperação das consultas do entregador

Consultas de lista, histórico e revalidação da seleção usam AbortSignal com limite de 15 segundos. Tempo esgotado encerra a espera, explica a falha e libera Atualizar. A verificação também rejeita resposta recebida após o sinal de interrupção; a interface não aceita uma consulta já expirada.

Falha na revalidação remove cartões antigos e orienta atualizar a lista, preservando entrega ativa e foto. Uma atualização bem-sucedida permite nova seleção. Não repete solicitações automaticamente e não altera endpoints de coleta, prova ou pagamento.

Validação local: 13 testes selecionados aprovados, sem skips, incluindo repositório/serviço/HTTP, interface e beta real Chromium/API/PostgreSQL. Testes cobrem consulta interrompida e seleção recusada seguida de atualização. No navegador, a rede fica offline para consultar o histórico: os cartões são removidos, a seleção é preservada e Atualizar é liberado. Após restaurar a conexão, o histórico real é carregado novamente. Sintaxe dos 122 arquivos e diff aprovados.

Comando: `node --test tests/courier-dashboard-ui.test.mjs tests/courier-dashboard.test.mjs tests/postgres-beta.test.mjs`.

Limites: teste de conexão utiliza emulação do Chromium; foto, coordenadas e entrega são sintéticas. Não substitui dispositivo/rede físicos, fornecedor ou homologação humana. Produção e percentuais formais permanecem iguais.
