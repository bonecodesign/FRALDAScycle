# Recuperação de senha transacional

Consumo do código, atualização da senha, revogação das sessões e invalidação dos desafios administrativos anteriores ocorrem na mesma transação PostgreSQL. A conta é bloqueada antes do token, seguindo a ordem usada na emissão e na confirmação administrativa. Conta suspensa, código expirado, usado ou de outra finalidade não permite a recuperação.

Erro no banco desfaz todas as alterações e preserva o código para nova tentativa dentro da validade. Solicitações simultâneas com o mesmo código só podem alterar a senha uma vez.

Validação: `tests/password-recovery-postgres.test.mjs`, executado pelo comando `npm run test:listing-postgres`, cobre rollback, vinte solicitações concorrentes, revogação de sessão, invalidação de MFA e rejeições. A regressão de identidade é executada com seleção explícita dos testes de recuperação, sem testes HTTP.

Resultado local em 9 de outubro de 2026: dois testes de identidade e três testes PostgreSQL aprovados, sem skips. As vinte recuperações concorrentes alteraram a senha uma vez; rollback, códigos expirados/de outra finalidade e conta suspensa foram verificados. O banco temporário foi removido após a execução.

Proteção adicional: cada pedido recebe um desafio aleatório de 43 caracteres. O hash persistido combina finalidade, desafio e código numérico; o código isolado não permite recuperar a conta. O pedido retorna os mesmos campos para contatos existentes e inexistentes. O app conserva o desafio na sessão da aba, substitui-o no reenvio e o remove após concluir. Solicitações antigas sem desafio exigem novo pedido.

O banco serializa a contagem de falhas por desafio, limitando a cinco tentativas incorretas durante trinta minutos, duração máxima do código. O limite exige novo pedido. Um novo pedido invalida os códigos anteriores da conta. Nenhuma migração adicional é necessária; tokens legados não são aceitos pelo novo contrato.

Validação adicional local: três testes do serviço cobrem vinculação, substituição, uso único, ausência de indicação pública da existência da conta e erro 429. A regressão de identidade tem dois testes aprovados; os três testes PostgreSQL passaram. Vinte tentativas inválidas simultâneas registraram cinco falhas e bloquearam quinze. Nenhum teste HTTP foi executado nesta etapa.

Controle de emissão: reserva transacional por contato normalizado antes de consultar a conta. Há intervalo mínimo de sessenta segundos e máximo de cinco pedidos aceitos em trinta minutos. Vinte pedidos simultâneos permitem apenas uma reserva. Contatos existentes, ausentes ou suspensos passam pelo mesmo limite; formatos equivalentes de e-mail/telefone compartilham a contagem. Se e-mail e telefone forem fornecidos juntos, o e-mail determina tanto a chave quanto a consulta.

A chave persistida é um SHA-256 com finalidade específica, sem gravar o contato em texto aberto no contador. As reservas usam `login_attempts` com chave separada das tentativas de login/MFA e `succeeded=true`; representam reservas de recuperação, não acessos à conta. Falha posterior de emissão continua consumindo a reserva, evitando repetição ilimitada em erro. Pedido bloqueado retorna `recovery_request_limited` (429), não envia notificação nem invalida o código anterior. O app mostra a mensagem e conserva o desafio anterior.

Validação da emissão: cinco testes de serviço, dois de identidade e quatro PostgreSQL passaram, sem skips e sem testes HTTP. O banco temporário foi removido. Intervalo, cota, isolamento entre contatos e reabertura após trinta minutos foram comprovados com relógio dos registros controlado no banco de teste.

Notificações agora possuem vínculo ao código e revalidação na fila, conforme `notification-token-binding.md`; essa proteção usa a migração 044. A recuperação também cria o código e sua mensagem vinculada na mesma transação, preservando o código anterior se a fila falhar.

Limites: entrega pelo fornecedor, proteção global contra solicitações distribuídas por muitos contatos, verificação de e-mail legada e jornada completa no navegador continuam pendentes. O limite é por contato, não uma cota global nem uma cota compartilhada entre e-mail e telefone da mesma pessoa. Esta etapa não conclui a homologação da autenticação.
