# Controle de anúncios duplicados

Estado: contrato técnico implementado; integração com o processamento de mídia e a publicação ainda pendente.

## Regra equilibrada

- comparar categoria, marca, modelo, tamanho, condição da embalagem e modalidade;
- usar hashes do conteúdo das imagens já processadas, nunca URLs temporárias;
- ignorar ordem e repetição das mesmas imagens;
- bloquear duplicata exata ativa do mesmo anunciante;
- encaminhar duplicata exata entre anunciantes diferentes para revisão humana;
- não excluir anúncio ou acusar fraude automaticamente;
- permitir nova publicação quando o registro anterior estiver concluído ou removido;
- Premium não ignora nem reduz o controle.

Estados considerados ativos: revisão, publicado e pausado.

## Privacidade e correção

O registro antifraude mantém somente fingerprints e IDs técnicos. Título, descrição, endereço e conteúdo bruto das fotos não entram no fingerprint persistido. O anunciante deve receber mensagem clara e poder corrigir o anúncio ou procurar o suporte.

## Ativação pendente

O processador de mídia precisa fornecer SHA-256 confiável do conteúdo normalizado. A publicação deve consultar anúncios ativos em transação, registrar o resultado e aplicar bloqueio ou fila de revisão de forma atômica.
