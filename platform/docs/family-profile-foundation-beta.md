# Maioridade e fundação de perfis infantis — beta local

## Maioridade

O cadastro exige declaração explícita e versionada `FC-AGE-1`, sem coletar data de nascimento do adulto. Contas existentes podem registrar a declaração apenas para si. Publicação, início de transação, atos de doação e mudanças Premium exigem a declaração; login, histórico, suporte e privacidade permanecem acessíveis. Registro e auditoria são atômicos e repetição idêntica é segura.

## Perfis infantis preparados, mas inativos

A fundação suporta múltiplos perfis por conta familiar, somente data de nascimento privada, consentimento `FC-CHILD-PROFILE-1`, correção versionada e remoção que interrompe a personalização. Contas de entregador, moderador e administrador não podem usar essa área. A migração 053 apaga eventuais apelidos de ambientes de teste anteriores e remove a coluna. O mecanismo interno deriva somente faixas etárias únicas; data, identificador do perfil e quantidade de crianças não integram os sinais de ofertas nem podem ser expostos a parceiros.

`CHILD_PROFILES_ENABLED` é falso por padrão. Em produção, habilitá-lo exige também `CHILD_PROFILES_ACTIVATION_ACKNOWLEDGED=true`; definir somente a flag de recurso interrompe a inicialização. Esse segundo valor é um controle operacional explícito e não substitui revisão jurídica, aprovação de privacidade ou decisão formal. Enquanto a flag estiver desligada, o serviço retorna `404` antes de consultar ou escrever no banco e a interface infantil não é criada. Nenhuma coleta infantil fica ativa nesta entrega.

## Condições para ativação futura

Antes de habilitar a feature são obrigatórias revisão jurídica e de privacidade, definição de finalidade, base legal, retenção, exclusão, atendimento do responsável, compartilhamento e transparência das ofertas. O cadastro infantil não pode ser requisito para criar conta, comprar, vender, doar ou solicitar suporte. Publicidade exige escolha separada.

A data é obrigatória somente ao adicionar um perfil dentro da área familiar. Cadastros de conta, entregador e instituição continuam separados e não aceitam esse campo. Remover todos os perfis mantém a sessão e a área familiar acessíveis; login, histórico, suporte e operações existentes não devem depender desses dados. O bloqueio de novas operações até novo preenchimento ainda não foi implementado e exige a mesma aprovação de privacidade antes de existir.

## Evidência e limites

- Migração 033 e contratos de maioridade/faixa etária.
- Declaração integrada ao cadastro e às novas operações sensíveis.
- Serviço privado com criação, correção, remoção, múltiplos perfis e proteção concorrente.
- Interface adulta ativa; interface infantil condicionada ao backend habilitado.
- 12/12 verificações focadas aprovadas, incluindo HTTP/PostgreSQL nativo, isolamento por conta e papel, dois perfis simultâneos, correção, remoção completa, sessão preservada, auditoria e ausência da antiga coluna de apelido.

O item 30 está concluído. Os itens 26–28 e 31–33 continuam bloqueados; código inativo e testes sintéticos não substituem autorização jurídica nem ativam coleta.
