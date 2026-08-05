# Diligência pré-contratação de fornecedores

Estado: preparada e não enviada.

Este pacote transforma a seleção preliminar em um portão auditável. Ele não autoriza contato externo, abertura de conta, envio de dados, aceite de termos, contratação, provisionamento, credenciais ou pagamento.

## Fluxo de decisão

1. Autorizar formalmente o início da diligência de uma capacidade.
2. Copiar somente as perguntas daquela capacidade para o canal aprovado.
3. Registrar respostas e documentos em repositório privado apropriado, nunca no Git.
4. Referenciar aqui apenas identificadores internos não sensíveis das evidências.
5. Avaliar todos os critérios eliminatórios.
6. Pontuar as seis dimensões.
7. Exigir nota mínima 80 e todos os portões aprovados.
8. Registrar decisão: rejeitado, pendente ou elegível para sandbox.
9. Sandbox exige autorização separada e credenciais somente no cofre.
10. Contratação e produção exigem decisões posteriores independentes.

## Pesos

| Dimensão | Peso |
| --- | ---: |
| Técnica | 25 |
| Segurança | 20 |
| Privacidade/LGPD | 15 |
| Comercial | 15 |
| Jurídica | 10 |
| Operação e suporte | 15 |

A nota ponderada não substitui os portões eliminatórios. Um fornecedor com nota superior a 80 continua reprovado se falhar em qualquer portão.

## Portões eliminatórios

- compatibilidade formal com marketplace;
- DPA/LGPD aprovados;
- HTTPS e criptografia adequados;
- sandbox ou método equivalente de homologação;
- exportação e exclusão de dados;
- custo limitado por quota, orçamento ou contrato;
- plano de saída viável;
- nenhuma alteração no protótipo aprovado.

## Evidências

Permitidas no repositório:

- URL pública;
- referência de documento redigida;
- identificador de aprovação;
- identificador de resultado de teste.

Proibidas no repositório:

- credencial ou segredo;
- URL privada;
- dado pessoal;
- cópia de contrato;
- resposta comercial confidencial;
- payload real de usuário.

As respostas completas devem permanecer fora do Git em local privado aprovado.

## Responsabilidade para equipe de duas pessoas

Uma pessoa prepara a avaliação e a outra confirma os portões e a nota. Quando uma aprovação especializada for necessária, o estado permanece pendente até parecer jurídico, contábil, segurança ou privacidade. Ausência de responsável nunca equivale a aprovação.

## Resultado deste pacote

Os quarenta questionamentos específicos estão em `platform/config/provider-due-diligence.v1.json`. O validador garante cobertura das oito capacidades, pesos totalizando 100, nota mínima, portões obrigatórios e estado não contatado.
