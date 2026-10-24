# Maioridade e fundação de perfis infantis — beta local

## Maioridade

O cadastro exige declaração explícita e versionada `FC-AGE-1`, sem coletar data de nascimento do adulto. Contas existentes podem registrar a declaração apenas para si. Publicação, início de transação, atos de doação e mudanças Premium exigem a declaração; login, histórico, suporte e privacidade permanecem acessíveis. Registro e auditoria são atômicos e repetição idêntica é segura.

## Perfis infantis preparados, mas inativos

A fundação suporta de 1 a 5 perfis por conta familiar, somente data de nascimento privada, emoji obrigatório e exclusivo, consentimento `FC-CHILD-PROFILE-1`, correção versionada e remoção que interrompe a personalização. Contas de entregador, moderador e administrador não podem usar essa área. A migração 053 apaga eventuais apelidos de ambientes de teste anteriores e remove a coluna. O mecanismo interno deriva somente faixas etárias únicas; data, identificador do perfil e quantidade de crianças não integram os sinais externos.

`CHILD_PROFILES_ENABLED` é falso por padrão. Em produção, habilitá-lo exige também `CHILD_PROFILES_ACTIVATION_ACKNOWLEDGED=true`; definir somente a flag de recurso interrompe a inicialização. Esse segundo valor é um controle operacional explícito e não substitui revisão jurídica, aprovação de privacidade ou decisão formal. Enquanto a flag estiver desligada, o serviço retorna `404` antes de consultar ou escrever no banco e a interface infantil não é criada. Nenhuma coleta infantil fica ativa nesta entrega.

## Retenção e bloqueio após remoção

A decisão de 22 de outubro define retenção ativa: a data existe somente enquanto o perfil estiver ativo. A remoção substitui a data por `NULL` na mesma transação que desativa o perfil e registra auditoria sem a data. Backups operacionais expiram em até 30 dias. O último perfil não pode ser removido manualmente.

## Condições para ativação futura

Antes de habilitar a feature são obrigatórias revisão jurídica e de privacidade, definição de finalidade, base legal, retenção, exclusão, atendimento do responsável, compartilhamento e transparência. A decisão de produto exige um perfil para concluir o cadastro familiar; contas cujo último perfil encerrar automaticamente aos 13 anos continuam ativas sem personalização. Publicidade exige escolha separada.

A data e um emoji do conjunto fixo são obrigatórios ao adicionar um perfil. Cadastros de entregador e instituição continuam separados. A interface renumera cartões após remoção, mostra a idade calculada e permite corrigir a data ou trocar por emoji ainda não utilizado. A ativação continua exigindo aprovação jurídica e de privacidade.

## Evidência e limites

- Migração 033 e contratos de maioridade/faixa etária.
- Declaração integrada ao cadastro e às novas operações sensíveis.
- Serviço privado com criação, correção, remoção, múltiplos perfis e proteção concorrente.
- Worker idempotente encerra perfis aos 13 anos, elimina a data e enfileira avisos 30 dias antes e no dia; execução periódica exige `CHILD_PROFILE_LIFECYCLE_ENABLED=true`.
- Interface adulta ativa; interface infantil condicionada ao backend habilitado.
- 12/12 verificações focadas aprovadas, incluindo HTTP/PostgreSQL nativo, isolamento por conta e papel, dois perfis simultâneos, correção, remoção completa, sessão preservada, auditoria e ausência da antiga coluna de apelido.

O item 30 está concluído. Os itens 26–28 e 31–33 continuam bloqueados até revisão jurídica e de privacidade; a decisão de produto, retenção ativa, purga operacional e bloqueio fail-closed não substituem parecer profissional nem ativam coleta.
