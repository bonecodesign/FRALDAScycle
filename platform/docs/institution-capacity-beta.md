# Capacidade institucional — beta técnico

O representante verificado de uma instituição ativa pode consultar e alterar, com confirmação explícita, a disponibilidade para novas doações. A alteração exige a versão atual e uma justificativa, é persistida em histórico próprio e gera auditoria.

Ao pausar, anúncios de doação publicados sem operação ativa são pausados. Novas publicações, confirmações do doador e confirmações institucionais ficam bloqueadas. Operações já existentes, recusas, suporte e histórico continuam disponíveis; a retomada não republica anúncios automaticamente.

A interface do representante expõe o estado atual, a versão e a escolha explícita de pausar ou retomar. A prova HTTP/PostgreSQL valida autoridade, entrada inválida, conflito de versão, bloqueio de novas doações, pausa seletiva de anúncio livre, preservação de anúncio com transação ativa, retomada sem republicação automática, eventos e auditoria.

O escopo técnico do requisito 65 está concluído. Isso não comprova espaço físico, equipe, horário ou capacidade operacional real; esses dados precisam ser confirmados pela instituição antes da ativação e acompanhados durante o piloto.
