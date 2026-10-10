# Estados das telas de autenticação do cliente

Login, cadastro, recuperação e troca de senha bloqueiam envios repetidos enquanto aguardam a API. Na verificação, confirmar e reenviar compartilham o mesmo bloqueio; um reenvio recusado conserva o desafio anterior. Cadastro e recuperação só salvam identificações com formato válido.

Uma resposta de login que exige MFA, ou que identifica conta administrativa/moderadora, encaminha ao login administrativo para seguir o fluxo próprio. O desafio recebido no app não é transferido; o usuário confirma novamente suas credenciais na área administrativa. Resposta sem usuário não abre a home. A confirmação da conta exige resposta com usuário confirmado, e a troca de senha exige `success: true` antes de mostrar sucesso ou navegar.

As senhas são limpas dos campos após envio. Cadastro e troca de senha seguem o limite da API: 12 a 1024 caracteres, com ao menos 12 após remover espaços das extremidades. Os campos HTML refletem esse intervalo. A validação de contato separa e-mail de telefone e limita o telefone a 8–15 dígitos.

Esgotamento das tentativas remove o desafio correspondente. Bloqueio geral de frequência preserva o desafio, pois não implica código inválido. Na troca de senha, um código recusado é removido, mas a solicitação é preservada para digitá-lo novamente pelo link da tela; expiração real exige novo pedido. O código de recuperação só é validado pelo servidor ao salvar a senha, conforme o fluxo existente.

Validação local: oito testes da lógica real das telas, com DOM/API simulados, seis testes dos serviços de verificação/recuperação e um contrato das telas passaram (15 no total), sem skips. Cobertura inclui envio duplicado, confirmação/reenvio simultâneos, erro e sucesso, desafio inválido, limite de frequência, tentativa esgotada, MFA e respostas incompletas. Sintaxe e diff foram verificados. Nenhum teste HTTP, envio real ou navegador real foi executado.

Limites: fidelidade visual, acessibilidade no navegador, jornadas completas e fornecedores continuam pendentes de homologação.

Continuação após o PR #86: o login do cliente foi validado no Chromium com API/PostgreSQL reais locais, senha inválida sem sessão, senha válida pelo teclado e confirmação de cookie HttpOnly. Rótulos dos inputs foram associados e quatro larguras passaram sem overflow. Os dados são fictícios. A continuação comprovou cadastro, confirmação de e-mail, recuperação com revogação da sessão anterior e MFA completo pela interface real; detalhes em `authentication-browser-validation.md`. Entrega externa por fornecedores e homologação humana continuam pendentes.
