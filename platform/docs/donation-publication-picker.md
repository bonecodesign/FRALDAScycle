# Instituição destinatária na publicação

Site e app oferecem a seleção na etapa Condição para anúncios de doação. A consulta usa somente os dados públicos de `/v1/institutions`, que retorna instituições ativas. O usuário pode filtrar por cidade e carregar páginas adicionais de 100 resultados.

Não há instituição selecionada por padrão. Pacotes abertos mostram somente instituições que os aceitam. Alterar a condição invalida uma escolha incompatível. Carregamento, consulta vazia e falha impedem avançar sem uma escolha válida; falhas permitem nova consulta.

O app mantém o identificador e nome público no rascunho da aba. Site e app mostram a destinatária na revisão e enviam `institutionId` somente em doações. O servidor continua revalidando o estado da instituição e a aceitação do pacote ao gravar e aprovar o anúncio. Selecionar uma instituição não confirma o recebimento da doação.

Verificação local: testes de interface com DOM simulado, incluindo paginação, falha, pacotes abertos, descarte de respostas antigas e envio do identificador. Testes HTTP e homologação em navegador continuam pendentes.
