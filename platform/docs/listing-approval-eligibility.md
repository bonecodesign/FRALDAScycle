# Elegibilidade na aprovação de anúncios

A aprovação para publicação confere os controles operacionais global, marketplace e doações com trava compartilhada. Em seguida, bloqueia a conta do vendedor antes de bloquear o anúncio, seguindo a ordem usada pelos fluxos de publicação, reenvio e plano.

Conta desativada e suspensão temporária de novas operações impedem aprovação. A consulta de Premium usa o horário do banco. Sem benefícios ativos, três anúncios publicados esgotam a quota gratuita e o anúncio em revisão permanece aguardando. Aprovações concorrentes da mesma conta são serializadas pela trava do usuário; a proteção deve ser ensaiada em PostgreSQL na homologação.

Para doações, a instituição precisa estar ativa e aceitar a condição do pacote. Pausa de doações impede nova publicação de doação. Rejeições administrativas seguem disponíveis durante essas restrições.

Bloqueios não publicam, removem ou aprovam o anúncio, nem criam uma decisão de revisão. Não há pausa automática de anúncios existentes para abrir vaga. A conta pode gerenciar os anúncios pelo fluxo já disponível do plano.

Evidência local: testes de contrato com repositório simulado. Homologação PostgreSQL concorrente e HTTP ainda pendentes.
