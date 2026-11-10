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

## Limites atuais

Os ensaios locais e de CI utilizam dados sintéticos e PostgreSQL descartável. Todos os portões externos permanecem `false`. A mudança desses valores exige recursos reais, responsáveis nomeados e evidência de homologação; portanto, o requisito 57 continua parcial e o projeto permanece NO-GO para produção.
