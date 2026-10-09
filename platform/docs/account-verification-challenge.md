# Verificação da conta vinculada à solicitação

Cadastro e reenvio retornam um desafio aleatório de 43 caracteres. O hash do código combina a finalidade `account-verification`, o desafio e os seis dígitos. A confirmação exige ambos. Códigos antigos sem desafio exigem novo pedido. O app guarda o desafio na sessão da aba, substitui-o após reenvio aceito e o remove após confirmar; reenvio bloqueado preserva o desafio anterior.

Consumo do token e atualização da confirmação da conta ocorrem na mesma transação, com bloqueio da conta antes do token. Falha da atualização desfaz o consumo. Conta suspensa, código de outra finalidade, expirado ou já usado não são aceitos. Cinco falhas por desafio em trinta minutos bloqueiam a solicitação. A confirmação não cria sessão.

Cadastro e reenvio compartilham a cota do contato normalizado: intervalo mínimo de sessenta segundos e até cinco emissões aceitas em trinta minutos. A primeira reserva é gravada na transação do cadastro; falha desfaz conta e reserva. Cota já atingida também desfaz o cadastro. Reenvios consultam o limite antes de procurar a conta e retornam os mesmos campos para contas existentes, ausentes, suspensas ou já verificadas. Recuperação e verificação têm chaves distintas no contador.

Validação local: 15 testes de serviço/trabalhador, dez testes de identidade sem HTTP e nove testes PostgreSQL passaram (34 no total), sem skips. Vinte confirmações tiveram um sucesso; vinte tentativas inválidas registraram cinco falhas e bloquearam quinze. Rollback, códigos expirados/de outra finalidade, suspensão, emissão concorrente, cota, reabertura da janela e reserva inicial do cadastro foram comprovados. Cadastro com reserva negada não deixou conta. As 44 migrações passaram e o banco temporário foi removido.

Os arquivos de teste PostgreSQL são executados em sequência por compartilharem a fila global. Cada cenário de concorrência continua disparando solicitações simultâneas dentro do teste.

Limites: nenhuma entrega real nem teste HTTP foi executado. Jornadas no navegador, integração do fornecedor, limites globais/administrativos de emissão e retenção de códigos continuam pendentes. A semântica legada de confirmação para contas por telefone foi preservada nesta etapa.
