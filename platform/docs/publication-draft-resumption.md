# Retomada do rascunho e da foto

Na etapa Fotos do app, uma referência enviada anteriormente é reaproveitada. A tela consulta a imagem com o mesmo acesso privado temporário usado na revisão e oferece a troca da foto. A referência existente permite continuar sem repetir o upload; propriedade e processamento são novamente conferidos pelo servidor ao enviar o anúncio.

Uma troca só substitui a referência quando o upload termina e a nova chave é gravada no rascunho. Falha, arquivo inválido, cancelamento da escolha ou saída da página preservam a referência anterior. Durante o envio, o botão de continuar fica desabilitado. JPEG, PNG e WebP de até 10 MB são aceitos.

O site passa a manter campos, etapa e referência da foto em `sessionStorage`, retomando-os após recarregar na mesma aba. URLs assinadas e prévias locais não são gravadas; a foto restaurada é consultada novamente. Rascunhos corrompidos ou versões desconhecidas são ignorados. A publicação bem-sucedida limpa o rascunho; erros preservam os dados.

O armazenamento é local à sessão da aba: não há sincronização entre dispositivos, abas ou contas. Chaves de outra conta são rejeitadas pela API. Objetos enviados que não se tornam anúncios continuam sujeitos ao ciclo de limpeza do provedor de mídia.

Verificação local com armazenamento e DOM simulados: retomada de campos e foto, substituição com sucesso/falha, validação de arquivo e resposta tardia após sair. Homologação em navegador e testes HTTP continuam pendentes.
