# Recuperação e backup — portão de ativação

## Objetivos técnicos do piloto

O manifesto `config/recovery-objectives.v1.json` fixa como alvo inicial: backup a cada 60 minutos, RPO de 60 minutos, RTO de 240 minutos, retenção imutável de 30 dias e ensaio de restauração a cada 30 dias. São objetivos de engenharia para dimensionar a futura contratação, não evidência de que a infraestrutura externa já os cumpre.

`npm run governance:recovery` falha se as metas forem enfraquecidas além dos limites aceitos, se surgirem campos não previstos ou se o arquivo declarar produção pronta antes da homologação. O manifesto não armazena endpoint, credencial, nome de bucket, chave KMS ou identidade humana.

## Procedimento de homologação externa

1. Provisionar armazenamento privado com versionamento, KMS e retenção imutável.
2. Provisionar o cofre e conceder ao serviço de backup somente as chaves do manifesto `secret-access.v1.json`.
3. Aprovar identidades nominais de operação e acesso emergencial, sem contas compartilhadas.
4. Agendar backup e alertar atraso superior ao intervalo de 60 minutos.
5. Publicar dump e checksum pelas rotinas existentes, sem reutilizar nomes e sem sobrescrever objetos.
6. Restaurar em banco isolado, executar migrações e comparar tabelas, sequências e checksums.
7. Medir perda máxima recuperável e tempo total; somente aceitar se RPO ≤ 60 minutos e RTO ≤ 240 minutos.
8. Registrar evidência sem URL privada, credenciais ou conteúdo do banco e agendar novo ensaio em até 30 dias.

## FC-337 — transporte seguro também para dump e restore (21/11/2026)

O backend da API já possuía TLS estruturado com validação de certificado (PR #336), mas os utilitários **separados** `pg_dump`/`pg_restore` ainda aceitavam conexões remotas sem `sslmode` explícito ou com modos `require`, `prefer`, `verify-ca` e `disable`. No libpq, `prefer` pode recorrer a conexão sem criptografia, enquanto `require` não verifica a identidade do servidor.

Agora `database/recovery.js` exige `sslmode=verify-full` na URL **somente para hosts remotos**, tanto para backup quanto para restauração. O cliente `libpq` deve receber a CA do projeto por configuração privada `PGSSLROOTCERT` (arquivo montado no backend protegido ou localização padrão confiável). Sem CA confiável, hostname e cadeia válidos, a conexão deve falhar, nunca reduzir a exigência. **Não guardar CA junto com segredos**, credenciais ou dumps no Git público. O certificado de CA não é senha, mas sua distribuição e atualização precisam ser controladas.

A restauração remota continua exigindo **também** `CONFIRM_DATABASE_RESTORE=RESTORE`, destino separado e `CONFIRM_REMOTE_RESTORE_TARGET` com `host:porta/banco`. Isso **não autoriza** restaurar sobre o Supabase-BR: `pg_restore --clean` é potencialmente destrutivo. Manter o destino remoto isolado até autorização humana e prova de backup/rollback. Os testes PostgreSQL descartáveis em loopback continuam funcionando sem TLS.

**Evidência real somente leitura (21/11/2026 às 22:50 UTC):** consulta no projeto de homologação `urbrtnenrsjvgqjhfhdj` retornou `pg_settings.ssl=on`, versão mínima `TLSv1.2` e `pg_stat_ssl` da **sessão do conector** com `ssl=true` e `TLSv1.3`. Isto **não valida** a sessão da API FraldaCycle, imposição geral de SSL, certificados do backend, a rede de origem, `pg_dump` remoto ou backups realizados. O endpoint PostgreSQL direto pode exigir IPv6, e a homologação precisa escolher o host real da tela **Connect** do projeto, sem adivinhá-lo.

**Limitação do ambiente de execução desta inspeção:** tentativa não autenticada de testar o handshake TLS diretamente de um contêiner externo falhou ainda na resolução DNS; não se deve tratar isso como falha do Supabase nem como teste do certificado. Não houve conexão do aplicativo, exportação, restauração, armazenamento externo, criação de recursos ou alteração do banco.

Referências oficiais: [Conexões e SSL do Supabase](https://supabase.com/docs/guides/database/connecting-to-postgres), [Backups do Supabase](https://supabase.com/docs/guides/platform/backups) e o [inventário anterior FC-328](recovery-hosted-fc328-2026-11-20.md).

## Limites atuais

Os ensaios locais e de CI utilizam dados sintéticos e PostgreSQL descartável. Todos os portões externos permanecem `false`. A mudança desses valores exige recursos reais, responsáveis nomeados e evidência de homologação; portanto, o requisito 57 continua parcial e o projeto permanece NO-GO para produção.

## Responsabilidade humana aprovada em 20 de novembro de 2026

O responsável técnico interno será titular da operação de backup, cofre e recuperação; o substituto técnico assumirá apenas em indisponibilidade formal. Uma pessoa independente observará o ensaio completo trimestral e não poderá executar a restauração que avalia. O nível 5 revisará e aprovará o resultado final.

Essa governança não reduz a cadência técnica mensal definida neste documento: os ensaios mensais permanecem obrigatórios, e ao menos um ensaio completo por trimestre terá observação humana independente. O portão só poderá avançar depois da nomeação e aceite das pessoas, provisionamento autorizado da infraestrutura e comprovação real de RPO, RTO, retenção e restauração.
