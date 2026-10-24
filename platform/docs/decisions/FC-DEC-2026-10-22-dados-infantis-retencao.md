# Decisão de produto — dados infantis e retenção

Data: 22 de outubro de 2026.

## Decisões do fundador

- O cadastro da conta familiar tem duas etapas: responsável adulto e ao menos um perfil infantil.
- Cada conta mantém de 1 a 5 perfis ativos, numerados automaticamente. Datas iguais são permitidas.
- Cada perfil exige um emoji exclusivo na conta, escolhido entre 🍼, 🧸, ⭐, 🌙 e 🌈. O emoji pode ser trocado livremente.
- Perfis representam crianças de até 12 anos. A interface mostra meses até 2 anos e, depois, anos e meses; a data exata aparece somente na edição.
- Nome, apelido, foto, saúde e outros atributos da criança não são coletados.
- A data fica restrita à FraldaCycle. Não há ofertas de parceiros no lançamento nem compartilhamento externo da data, idade ou quantidade de crianças.
- A data permanece no banco operacional somente enquanto o perfil estiver ativo.
- Ao remover o perfil, a data é apagada imediatamente do banco operacional. Cópias em backups expiram no ciclo operacional máximo de 30 dias e não podem ser restauradas seletivamente para reativar personalização.
- O último perfil não pode ser removido manualmente. Ao completar 13 anos, o perfil será encerrado automaticamente, com avisos 30 dias antes e no dia, por aplicativo e e-mail. Nessa hipótese, a conta pode permanecer sem perfil e sem personalização etária.
- A correção da data e a troca do emoji são livres, versionadas e auditadas sem conservar o valor anterior.

## Uso no Marketplace

- Os perfis não exibem produtos. A data produz apenas sinais internos para ordenar a vitrine única do Marketplace.
- Não haverá aba, seção ou texto de sugestão ou recomendação. Todos os produtos permanecem acessíveis; somente a ordem padrão muda.
- A ordem equilibra faixas etárias entre os perfis e distância por trajeto entre centros dos CEPs. Se o serviço de rotas falhar, usa linha reta.
- Faixas geográficas: até 5 km, 5–15 km, 15–30 km e acima de 30 km. Itens da mesma faixa têm o mesmo peso geográfico.
- Indicações oficiais do fabricante prevalecem. Sem orientação suficiente, o produto não recebe personalização etária. Inferências por idade são aproximadas, não armazenam peso e não têm finalidade médica.
- Ordenações manuais substituem integralmente a personalização. O responsável pode desligá-la; nesse caso, a vitrine usa relevância geral e distância, sem consultar perfis.

## Limites e ativação

Esta decisão orienta a implementação técnica, mas não é parecer jurídico. `CHILD_PROFILES_ENABLED` permanece falso por padrão. A ativação em produção continua exigindo revisão jurídica e de privacidade, transparência final ao responsável, procedimento de direitos do titular e o reconhecimento operacional separado já exigido pela configuração.

Auditoria registra apenas ação, versão e identificadores técnicos; nunca a data de nascimento. A exclusão operacional não apaga evidências mínimas não reversíveis de que uma ação ocorreu, desde que essas evidências não contenham a data.

O encerramento automático aos 13 anos e os avisos internos/e-mail possuem rotina idempotente atrás de ativação operacional explícita. O ranking do Marketplace, a preferência de desligamento e a expiração física dos backups continuam requisitos aprovados ainda não implementados nesta fundação.
