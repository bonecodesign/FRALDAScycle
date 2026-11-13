# Supabase — decisão de infraestrutura pré-ativação

O Supabase será adotado seletivamente como infraestrutura gerenciada. Esta decisão não ativa serviço externo, não cria projeto e não altera o status formal dos requisitos.

## Escopo aprovado

- PostgreSQL gerenciado, preservando as migrações, repositórios e transações existentes.
- TLS obrigatório e conexão direta ou Supavisor em modo `session` para a API persistente.
- Backups, restauração e observabilidade serão homologados no projeto real antes do piloto.
- Storage privado poderá ser usado atrás do gateway de mídia FraldaCycle.

## Fora do escopo

- Supabase Auth: a autenticação, sessões, MFA e RBAC de níveis 1–5 continuam próprios.
- Data API no navegador: a API FraldaCycle permanece como única porta de dados.
- Realtime e Edge Functions: não são necessários para o piloto inicial.
- Uso direto do Storage pelo frontend: proibido. O gateway deve continuar removendo EXIF, validando tipo/tamanho, realizando OCR e detecção de QR/contato e emitindo URLs temporárias.

## Ativação futura

1. Criar o projeto em região adequada ao Brasil e escolher o plano após estimativa real de banco, conexões e armazenamento.
2. Usar uma senha exclusiva e armazenar a conexão somente no cofre de segredos.
3. Aplicar todas as migrações por conexão direta; a API persistente usa pooler `session` quando necessário.
4. Manter Data API, Auth e Realtime desativados. Se o `public` continuar exposto pelo projeto, revogar acesso de `anon` e `authenticated` e habilitar RLS como defesa adicional.
5. Executar `npm run supabase:readiness`, migrações, testes PostgreSQL, teste de restauração e advisors de segurança/desempenho.
6. Só então habilitar `SUPABASE_INFRASTRUCTURE_ENABLED=true` no ambiente de piloto.

As chaves `service_role` ou secretas nunca entram no frontend, no Git ou em variáveis com prefixos públicos.
