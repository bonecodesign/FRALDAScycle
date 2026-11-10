# Credenciais — operação e ativação

## Política preparada

`config/secret-operations.v1.json` inventaria todas as chaves aceitas pelo runtime sem registrar seus valores. A governança exige rotação padrão em até 90 dias, credencial de banco em até 180 dias, revogação emergencial em até 60 minutos e sobreposição de 60 minutos durante a troca controlada.

O fluxo administrativo segue a hierarquia aprovada: nível 3 propõe e registra, nível 4 autoriza e nível 5 dá a aprovação final. O manifesto não concede acesso ao painel, ao cofre ou aos valores; essas permissões continuam sob identidades individuais e menor privilégio.

## Ativação futura

1. Provisionar cofre, trilha de auditoria e identidades separadas por serviço.
2. Conferir que cada identidade recebe somente o conjunto de `secret-access.v1.json`.
3. Publicar a próxima versão sem remover a anterior.
4. Ativar a nova versão e verificar todos os consumidores.
5. Obter autorizações 3→4→5 e revogar a anterior.
6. Simular comprometimento, revogar em até 60 minutos e verificar que logs não revelam valores.

`npm run governance:secret-operations` impede que uma nova chave de runtime seja adicionada sem entrar no inventário e recusa prazos mais fracos ou portões externos marcados como concluídos sem homologação. O requisito 59 permanece parcial até existirem cofre, identidades, logs e exercício reais.
