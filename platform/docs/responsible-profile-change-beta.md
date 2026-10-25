# Alteração do responsável — fundação beta

Estado: implementado tecnicamente, desligado na prática enquanto o cadastro completo do responsável permanecer inativo.

## Fluxo

1. A conta autenticada envia a senha atual, o nome completo e a data de nascimento pretendidos.
2. O servidor confirma cadastro completo, e-mail verificado, senha e maioridade de 18 anos.
3. Um código de seis dígitos, válido por 15 minutos, é enviado ao e-mail verificado.
4. A confirmação reapresenta exatamente os mesmos dados, o desafio e o código.
5. O banco aplica nome e nascimento na mesma transação que consome o código e grava a auditoria.

## Privacidade e segurança

- O banco temporário guarda apenas SHA-256 da alteração proposta, nunca o novo nome ou nascimento.
- Código e desafio são vinculados à conta e à alteração exata.
- Um novo pedido invalida o anterior.
- Cinco tentativas inválidas encerram o pedido.
- Código é de uso único.
- Resposta HTTP e auditoria não carregam nome, data ou código.
- A auditoria registra somente os campos alterados e o método `password_and_email_code`.
- O CPF e o e-mail não são alterados por este fluxo.

## Rotas

- `POST /v1/account/responsible-profile/change/request`
- `POST /v1/account/responsible-profile/change/confirm`

Ambas exigem sessão, recusam cache e dependem da fila operacional de notificações. A integração com provedor real de e-mail continua sendo um gate externo de ativação.
