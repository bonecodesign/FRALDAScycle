# Localização e foto no resumo do app

Na etapa Localização, o app consulta `/v1/geocoding/resolve` com CEP e bairro mediante ação do anunciante. Cidade/UF também podem ser informadas manualmente. A falta de configuração ou uma falha do provedor aparece na tela, sem preencher uma cidade de exemplo. A publicação exige cidade/UF válidas.

As coordenadas recebidas são arredondadas para duas casas decimais antes de entrar no rascunho e no anúncio. Um resultado pendente não sobrescreve alterações feitas nos campos. A posição consultada só é reutilizada quando CEP, bairro, cidade e UF continuam iguais; preenchimento manual envia coordenadas nulas. O CEP permanece no rascunho da aba e não aparece na descrição pública.

`POST /v1/media/listing-read` autentica a conta, aceita somente chaves `listings/<usuário>/...` e exige confirmação de processamento seguro e imutável antes de obter o link de leitura. A resposta usa `Cache-Control: no-store`. O provedor de mídia continua responsável por validar e servir os objetos privados.

O app não guarda URLs assinadas no rascunho. O resumo carrega a foto com `referrerPolicy=no-referrer`, prazo máximo de cinco minutos e opção de consultar novamente. Falha, processamento pendente e expiração não são tratados como uma imagem carregada. Sair da página ou concluir o envio remove o acesso da interface. A revisão administrativa independente continua obrigatória.

Verificação local: provedores e DOM simulados, sem rede HTTP real. Credenciais dos provedores, homologação dos endpoints e verificação visual em navegador permanecem pendentes.
