# FC-367 — Limite de concorrência mesmo após timeout

## Lacuna verificada na FC-366
O Promise.race podia encerrar a espera de um worker sem encerrar o trabalho subjacente. A mesma vaga era reutilizada, potencialmente excedendo dois trabalhos ainda ativos apesar do contador lógico.

## Correção
- Solicitar cancelamento via AbortSignal ao atingir o timeout; repassar o sinal ao execFile do laboratório.
- Retirar definitivamente a vaga do worker que excedeu o prazo nesta execução, mesmo que o callback ignore cancelamento.
- Não executar fotos restantes se todas as vagas forem retiradas; decisões ausentes bloqueiam o anúncio inteiro.
- Contabilizar separadamente fotos com decisão (incluindo falhas), fotos não agendadas e workers retirados.
- Respostas tardias não alteram o relatório nem liberam mídia. O único worker sobrevivente pode continuar dentro do limite.

## Evidência exigida
Testes Node de callbacks que ignoram cancelamento, duas vagas retiradas, fotos não agendadas, resposta tardia, e um worker sobrevivente. Executar Platform CI e o ensaio real de ClamAV existente na SHA do PR antes de integrar. O teste de callbacks é sintético; não demonstra encerramento de toda uma árvore de processos do sistema operacional, isolamento distribuído, limite global entre invocações ou capacidade real de produção.

Sem gastos novos, fotos reais, fornecedores, dados pessoais, Supabase hospedado ou publicação. FC-41 permanece parcial; matriz 48/70, piloto BH 16/21, NO-GO. PR #333 preservado.
