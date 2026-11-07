# Encaminhamento de divergências financeiras para supervisão humana

Reaproveita `operational_incidents`, com responsável, histórico de eventos, severidade, setor e controles de acesso. A conciliação local de frete **não cria tickets de cliente** (que exigem um solicitante real), nem inventa uma ocorrência crítica.

O financeiro de nível 3 ou superior pode associar **explicitamente** um plano de frete a um incidente operacional preexistente de domínio `payments` ou `payouts`, aberto e autorizado, usando `POST /v1/admin/freight-settlement-plans/:id/supervision` com `{"incidentId":"uuid","confirmed":true}`. O vínculo é idempotente para o mesmo par, exclusivo por plano e por incidente, e deixa trilha de auditoria. O setor financeiro também pode consultar `GET` na mesma rota; não recebe dados pessoais de tickets.

O vínculo só é permitido se o plano tem divergência local **registrada e ainda aberta**. O sistema não resolve incidentes operacionais automaticamente, não cria um novo ticket, não executa cobrança, não libera repasse e não confunde correção local com homologação externa. O incidente operacional segue seu fluxo existente de atribuição e revisão humana. A conciliação continua protegida pela trava externa.
