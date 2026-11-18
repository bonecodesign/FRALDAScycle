# FC-309 — Encadeamento HTTP autenticado de publicação a negociação

**Execução:** suíte sintética com API real em loopback e PostgreSQL efêmero isolado. Sem fornecedores reais, armazenamento externo de fotos, inspeção humana, pagamentos, fretes, dados pessoais ou produção.

## O que já existia

- FC-308 integrou os serviços de criação, aprovação independente, busca e início de transação em PostgreSQL.
- FC-304 cobriu teclado/32 combinações de tela, pesquisa negativa e chat bloqueado em Chromium.
- Os testes de segurança existentes já verificam separadamente permissões de administrador, autenticação, publicação e chat.

## Lacuna nova coberta

O arquivo [tests/publication-review-http-postgres.test.mjs](../tests/publication-review-http-postgres.test.mjs) atravessa as **rotas HTTP reais** com quatro atores sintéticos (vendedor, comprador, moderador e terceiro) e banco temporário em 127.0.0.1:

1. Sem sessão, a criação é recusada; chave de foto pertencente a outra conta também é recusada.
2. Vendedor autenticado publica uma vez, reenvia com a mesma chave sem duplicar e não pode reutilizar a chave com preço diferente.
3. Anúncio sob revisão não aparece na busca pública nem pode ser reservado.
4. Rota administrativa exige sessão e setor de moderação. Revisão gera contexto assinado vinculado a usuário/sessão/conteúdo, sem devolver chave bruta da mídia ao navegador.
5. Sem contexto de revisão, ou enquanto a mídia sintética está indisponível, a aprovação falha sem gravar decisões.
6. Após confirmação **simulada** da mídia, o moderador independente aprova pela rota HTTP; há apenas uma decisão e auditoria, sem permitir confirmação repetida.
7. Busca e detalhe HTTP públicos passam a exibir o anúncio com preço digitado de R$ 37,90.
8. Comprador autenticado reserva a última unidade. Terceiros não podem abrir o chat. Comprador e vendedor recebem "payment_not_confirmed" e **nenhuma cobrança é criada**; catálogo deixa de ofertar o item indisponível.

## Critérios de evidência

Executar com \`node --test tests/publication-review-http-postgres.test.mjs\` quando houver PostgreSQL nativo ou o job de CI do projeto. Usar exclusivamente o banco temporário de \`withNativeTestPostgres\`, que é criado e removido pelo próprio teste. O teste não baixa bibliotecas nem consulta provedores. Seus resultados devem ser avaliados pelo CI no commit exato da PR.

**Não promover** \`publish-search-negotiate\` no preflight com esta execução: o teste não percorre a tela completa com upload real da foto nem faz moderação humana, negociação final ou pagamento. A matriz oficial permanece 48/70 concluídos; preflight 16/21, cinco evidências pendentes; piloto BH **NO-GO**.

## Próximas verificações externas (não realizadas)

- Adaptador de mídia real com EXIF/OCR/QR e inspeção visual observada.
- Evidência integrada de navegador com foto autorizada, publicação, aprovação, busca e transação completa em ambiente homologado.
- Testes humanos de leitor de tela, dispositivos físicos e nomeação/aceite do rollback.
- Homologação de processador, logística, jurídica/LGPD, segurança, suporte e liberação específica do piloto.
