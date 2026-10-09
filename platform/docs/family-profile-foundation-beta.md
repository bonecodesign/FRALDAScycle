# Maioridade e fundação de perfis infantis — beta local

## Maioridade

O cadastro exige declaração explícita e versionada `FC-AGE-1`, sem coletar data de nascimento do adulto. Contas existentes podem registrar a declaração apenas para si. Publicação, início de transação, atos de doação e mudanças Premium exigem a declaração; login, histórico, suporte e privacidade permanecem acessíveis. Registro e auditoria são atômicos e repetição idêntica é segura.

## Perfis infantis preparados, mas inativos

A fundação suporta múltiplos perfis por conta, apelido opcional, data de nascimento privada, consentimento `FC-CHILD-PROFILE-1`, correção versionada e remoção que interrompe a personalização. O mecanismo interno deriva somente uma faixa etária; a data exata não integra os sinais de ofertas nem é exposta a parceiros.

`CHILD_PROFILES_ENABLED` é falso por padrão. Enquanto estiver desligado, o serviço retorna `404` antes de consultar ou escrever no banco e a interface infantil não é criada. Nenhuma coleta infantil fica ativa nesta entrega.

## Condições para ativação futura

Antes de habilitar a feature são obrigatórias revisão jurídica e de privacidade, definição de finalidade, base legal, retenção, exclusão, atendimento do responsável, compartilhamento e transparência das ofertas. O cadastro infantil não pode ser requisito para criar conta, comprar, vender, doar ou solicitar suporte. Publicidade exige escolha separada.

## Evidência e limites

- Migração 033 e contratos de maioridade/faixa etária.
- Declaração integrada ao cadastro e às novas operações sensíveis.
- Serviço privado com criação, correção, remoção, múltiplos perfis e proteção concorrente.
- Interface adulta ativa; interface infantil condicionada ao backend habilitado.
- 11/11 contratos familiares e 83/83 regressões aprovados sem HTTP.

HTTP real e PostgreSQL nativo permanecem pendentes. O item 30 é parcial. Os itens 26–28 e 31–33 continuam bloqueados; código inativo não substitui autorização jurídica nem ativa coleta.
