# Contrato de cadastro do responsável

## Estado

O contrato de validação está implementado e testado. A persistência, a interface em duas etapas e a integração com a versão ativa dos Termos de Uso serão entregues em pacotes separados. Este documento não declara o cadastro completo pronto para produção.

## Dados exigidos na primeira etapa

- nome completo;
- CPF com validação matemática;
- data de nascimento que confirme idade mínima de 18 anos;
- endereço principal completo;
- autodeclaração versionada de veracidade;
- aceite da versão ativa e identificada pelo hash dos Termos de Uso.

O endereço exige CEP, logradouro, número, bairro, cidade, UF e complemento. Quando não existir complemento, a opção `noComplement` deve ser marcada explicitamente. O CEP precisa de evidência de verificação compatível com a versão atual do endereço.

## Limites de segurança e privacidade

- O servidor fornece a versão e o hash dos Termos ativos; valores enviados pelo cliente não estabelecem a versão confiável.
- Termos em rascunho ou ausentes bloqueiam o cadastro.
- CPF e nascimento são dados pessoais e não podem aparecer em logs, telemetria ou respostas desnecessárias.
- Documento oficial e prova de vida não pertencem ao cadastro normal. Eles permanecem restritos ao fluxo excepcional de recuperação de conta.
- A validação matemática do CPF não comprova identidade nem titularidade de cartão.

## Próximos pacotes

1. persistência transacional do responsável, endereço principal e aceites;
2. integração do serviço HTTP com compatibilidade controlada do fluxo atual;
3. interface em duas etapas, consulta de CEP e tratamento de erros;
4. testes PostgreSQL e HTTP do fluxo integrado.
