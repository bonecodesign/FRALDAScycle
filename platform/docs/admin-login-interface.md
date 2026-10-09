# Fluxo local de acesso administrativo

A tela de login segue o contrato de MFA da API. Ela valida a identificação e a validade do desafio recebido, limpa a senha do formulário assim que envia as credenciais e exige resposta autorizada da confirmação antes de navegar para o painel. Resposta administrativa sem MFA na etapa de credenciais é rejeitada e solicita logout.

O fluxo bloqueia envios simultâneos e reinício enquanto a confirmação está pendente, evitando que uma resposta atrasada navegue após reiniciar. Código expirado ou limite de tentativas exige reinício; senha e código ficam vazios. O prazo local usa a validade informada pela API, limitado a cinco minutos; o servidor continua sendo a autoridade sobre expiração.

Manipuladores antigos de protótipo nos módulos `core.js` e `shared-admin.js` foram removidos. Eles exibiam sucesso para qualquer sequência de seis dígitos e reenvio sem chamada à API. As páginas atuais usam o fluxo em `auth.js`.

Validação: seis testes da lógica real da tela, com DOM e API simulados, dois testes do serviço de MFA e um contrato de proteção dos módulos administrativos passaram (nove no total). Cobertura inclui código recusado, sucesso autorizado, duplicação, reinício durante confirmação, expiração, limite de tentativas, desafio inválido e papel sem autorização. Sintaxe dos três módulos alterados e diff foram verificados. Nenhum teste HTTP, chamada externa ou navegador real foi executado.

Limites: esta etapa não mede fidelidade visual nem conclui acessibilidade em navegador. Entrega do código pelo fornecedor, homologação da jornada e auditoria das demais telas continuam pendentes.
