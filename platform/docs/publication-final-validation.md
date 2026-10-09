# Validação final do rascunho

Site e app usam a mesma validação antes de solicitar a criação do anúncio. A tela de revisão lista todas as pendências e permite voltar à etapa correspondente. Nenhum anúncio é solicitado enquanto houver erros locais; dados e foto enviada permanecem disponíveis para correção.

São conferidos tipo de negociação, catálogo, título, tamanho, quantidade entre 1 e 100.000, referências de fotos, condição do pacote, declaração sanitária, instituição das doações, formato de mês/ano, descrição, preço de venda, preferência de entrega e cidade/UF brasileira. A validade aceita `MM/AAAA` ou `AAAA-MM`; essa checagem verifica o formato, sem definir uma nova política de prazo mínimo. A validade e a preferência de entrega continuam registradas na descrição.

No app também são exigidos CEP e bairro. No site, a região é informada como `Bairro, Cidade - UF`; a extração separa cidade e UF corretamente quando o geocodificador não está configurado. Coordenadas recebidas do geocodificador são validadas e arredondadas para duas casas decimais.

A validação de interface não substitui a API: identidade, declaração de maioridade, limites da conta, pausas operacionais, instituição ativa e processamento das fotos são revalidados pelo servidor. Nenhuma aprovação administrativa é presumida.

Verificação local: limites dos campos, rascunhos incompletos e inválidos, doação aberta, formatos de região e bloqueio do envio preservando o rascunho. Sem testes HTTP; homologação em navegador continua pendente.
