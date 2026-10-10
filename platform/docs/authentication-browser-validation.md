# Autenticação pela interface real — continuação da validação

Chromium local, API real e PostgreSQL 16 descartável com contas fictícias. Os códigos são lidos da fila local pelo processo de teste via IPC; nenhum endpoint de teste foi adicionado à aplicação e nenhuma mensagem externa foi enviada.

- Cadastro pela tela, declaração de maioridade, código incorreto recusado e código emitido confirmado; e-mail verificado no PostgreSQL.
- Login da conta cadastrada, recuperação pela tela, código incorreto recusado na redefinição e nova senha gravada.
- Sessão anterior revogada após redefinir a senha; senha antiga recusada e nova senha aceita.
- Login administrativo exige MFA sem criar sessão antes da segunda etapa; código incorreto recusado e código válido abre o painel com sessão HttpOnly.
- Cadastro, verificação, recuperação, redefinição e login administrativo verificados em 320, 375, 768 e 1280 px, sem overflow horizontal ou campos visíveis sem nome acessível. São 24 medições, incluindo a segunda visita à verificação.

Correção de interface: rótulos associados aos campos de cadastro, recuperação e redefinição. Submissões via Enter no Chromium. Isso não comprova toda a navegação apenas por teclado, leitor de tela, fidelidade visual ou dispositivos físicos.

Execução reproduzível: `node --test tests/postgres-beta.test.mjs`. Evidência resumida em `authentication-browser-validation.json`; sem senhas, códigos ou tokens. O teste integra `npm test` e o job remoto foundation.

Entrega externa de e-mail/SMS, homologação humana, termos definitivos, infraestrutura e ativação real permanecem pendentes. Esta validação não altera os percentuais de requisitos formalmente concluídos.
