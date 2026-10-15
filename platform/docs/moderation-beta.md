# Moderação e recurso no beta

Base: main ec295b33b64198f07341da2877ab2ab9e2aa5a26, PR #75 integrado e CI verde. Somente platform/.

## Fluxo implementado

Regra FC-CONTENT-1 compartilhada no navegador e API identifica padrões de contatos, números por extenso, Unicode, e-mails disfarçados e convites externos. Chat acrescenta restrições de alteração das condições; avaliações identificam sinais explícitos de conteúdo privado. Não se declara detecção de todos os disfarces ou dados privados: há falsos positivos e negativos, e revisão/denúncia continuam necessárias.

Bloqueio registra identificador, categorias, versão e fingerprint SHA-256; não armazena o texto rejeitado no registro nem copia mensagens/contatos para auditoria. Fingerprints não são públicos. Conta consulta somente seus registros; moderador autorizado consulta/revisa com auditoria. Contestação cria protocolo/histórico no suporte e vínculo único à decisão. Repetição conserva o pedido. Revisão exige confirmação, justificativa e pessoa diferente do titular/decisão inicial. Falso positivo textual exige verificar o conteúdo integral pelo fingerprint, sem persistir a cópia; exceção vale somente para o mesmo titular, contexto, conteúdo e versão. Sinais de informação privada em avaliação não recebem exceção de publicação.

Suspensão temporária exige moderador autorizado, motivo, término explícito futuro e chave de idempotência. Não há duração padrão, sanção automática por contagem ou banimento definitivo. Trava por conta bloqueia publicação, retomada e início de novas operações. Anúncios sem operação ficam pausados; transações, acompanhamento e suporte preservados. Expiração/reversão não republica anúncios automaticamente. Revogação de sessões por comprometimento continua um controle separado.

Chat agora persiste mensagens privadas na API, após revalidar partes e pagamento; não emite mensagem externa ou evento público. Repetição não duplica mensagem; mesma chave com outro texto conflita. Avaliações persistidas exigem operação finalizada e participante, com comentário público limitado e sem expor identificadores das partes/transação. Finalização usada na validação é fixture; não aciona conclusão financeira ou repasse. Compartilhamento autorizado de contatos depois da finalização permanece pendente.

Anúncios passam a validar título/descrição no servidor. A descrição digitada é preservada. Upload falho deixa erro, sem marcar foto fictícia como adicionada. Referências de foto colocam anúncio em review e impedem consulta pública; revisão/OCR de mídia e publicação após conferência ficam bloqueadas pela mídia não homologada. Não existe botão para declarar revisão de foto sem executá-la.

Telas de decisões/recurso, chat, avaliações e moderação administrativa usam API. Números/reputação/decisões demonstrativos dessas telas são substituídos por consultas ou links persistidos. Denúncia na tela Segurança gera protocolo no suporte, sem simular bloqueio de outra pessoa.

## Validação e pendências

Local: quatro testes do detector, quatro do serviço/privacidade/permissões, cinco verificações de regras existentes, sintaxe de 88 arquivos e diff aprovados. PostgreSQL e Chrome locais continuam indisponíveis. CI nativo acrescenta migração 025, concorrência/idempotência de mensagem/recurso/revisão/suspensão, isolamento, falso positivo, avaliação somente finalizada, mídia em revisão e preservação do acompanhamento. Chrome acrescenta chat, bloqueio e recurso via teclado em quatro larguras. CI executado no commit `2006653c6a53602964eca39f142b339469fa9731`: 267 testes, 83 verificações e sintaxe de 88 arquivos aprovados. [Log de evidência](https://github.com/bonecodesign/FRALDAScycle/actions/runs/37317402830/job/111787499383). PostgreSQL nativo executou os fluxos descritos; Chrome 154 executou chat, bloqueio, contestação e revisão administrativa com conta separada e teclado Space/Tab/Enter. Preferências, Premium, moderação e administração foram verificados em 320, 375, 768 e 1280 pixels, sem overflow e sem campos sem rótulo nos formulários inspecionados. Corrigidos a corrida de inicialização do formulário de chat e o overflow administrativo em 768 pixels encontrados na execução real. Teste humano, leitor de tela e dispositivos físicos não executados.

Denúncia específica e ocultação/revisão de avaliações, detecção de mídia, revisão humana, leitor de tela/dispositivos, capacidade de equipe, canal externo e retenção definida por revisão profissional permanecem pendentes. Não ativar envio externo, fornecedores, termos, dados de crianças ou produção. Sem contratação, cobrança, repasse, reembolso, credenciais/dados reais ou desktop. Item 12 standby.

Uma prova HTTP/PostgreSQL dedicada acrescentada em 14 de outubro confirma o limite da suspensão: anúncio livre é pausado, novas publicações e compras são recusadas, e mensagens de operação anterior e suporte continuam acessíveis. A prova não representa aplicação humana da sanção nem operação real.

Uma prova HTTP/PostgreSQL dedicada acrescentada em 15 de outubro confirma a jornada de avaliações: somente partes após conclusão avaliam, repetição é idempotente, contato é bloqueado, a exposição pública é mínima e a denúncia oculta até decisão independente. Não representa moderação humana nem transação real.

Outra prova HTTP/PostgreSQL de 15 de outubro confirma o chat: acesso somente após pagamento confirmado, persistência idempotente, bloqueio de e-mail/telefone/convite externo sem cópia na auditoria e exceção de falso positivo limitada ao conteúdo exato revisado. A detecção não promete reconhecer todo disfarce futuro.

Matriz atualizada conserva denominador 70 e sete concluídos (10%): item 43 concluído pelo recurso protocolado e revisão independente efetivamente validados. Há 38 parciais, 13 pendentes e 12 bloqueados; demais itens de moderação continuam parciais. Prontidão para produção bloqueada, sem percentual atribuído.
