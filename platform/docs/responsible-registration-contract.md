# Contrato de cadastro do responsável

## Estado

O contrato, a persistência e a interface estão implementados e testados. Quando a feature familiar está habilitada, responsável, endereço, aceite e primeiro perfil são criados na mesma transação; falha em qualquer etapa não deixa conta parcial. Este documento não declara o cadastro pronto para produção.

O rascunho opcional de retomada permanece desligado por padrão. Quando explicitamente habilitado, conserva por no máximo 24 horas somente campos permitidos em payload AES-256-GCM, identificado por token opaco. CPF, nascimento, senha e convite nunca entram no rascunho. Produção também exige `REGISTRATION_DRAFTS_ACTIVATION_ACKNOWLEDGED=true`; isso não substitui aprovação jurídica ou de privacidade.

## Dados exigidos na primeira etapa

- nome completo;
- CPF com validação matemática;
- data de nascimento que confirme idade mínima de 18 anos;
- endereço principal completo;
- autodeclaração versionada de veracidade;
- aceite da versão ativa e identificada pelo hash dos Termos de Uso.
- primeiro perfil familiar com somente data de nascimento, emoji e consentimento versionado, quando a feature familiar estiver formalmente habilitada.

O endereço exige CEP, logradouro, número, bairro, cidade, UF e complemento. Quando não existir complemento, a opção `noComplement` deve ser marcada explicitamente. O CEP precisa de evidência de verificação compatível com a versão atual do endereço.

## Limites de segurança e privacidade

- O servidor fornece a versão e o hash dos Termos ativos; valores enviados pelo cliente não estabelecem a versão confiável.
- Termos em rascunho ou ausentes bloqueiam o cadastro.
- CPF e nascimento são dados pessoais e não podem aparecer em logs, telemetria ou respostas desnecessárias.
- Documento oficial e prova de vida não pertencem ao cadastro normal. Eles permanecem restritos ao fluxo excepcional de recuperação de conta.
- A validação matemática do CPF não comprova identidade nem titularidade de cartão.

## Gates restantes

1. revisão profissional dos textos e da obrigatoriedade do perfil;
2. configuração dos segredos exclusivos e reconhecimentos de ativação;
3. validação humana de acessibilidade e privacidade;
4. piloto fechado, inicialmente sem dinheiro real.
