# FC-372 — navegação real por teclado no fluxo de publicação

Objetivo: avançar o requisito 67 e a evidência pendente keyboard-check, não repetir os 32 cenários de viewport já aprovados.

## Lacuna corrigida
A validação do preço/localização e o resumo de erros final exibiam texto, mas mantinham o foco no botão; o resumo criado antes dele não era alcançado pelo Tab seguinte. O sucesso da publicação substituía o elemento focado. O app agora move o foco ao erro ou resumo de correções e ao título de sucesso, sem incluir esses elementos na ordem normal de Tab. A navegação não altera a exigência de mídia, preço, revisão ou chat protegido.

## Evidência nova
O check Chromium existente ganha 16 percursos: oito etapas da publicação em 375 e 1280 pixels. Cada percurso começa por Tab real, ativa o link de pular conteúdo com Enter, percorre controles habilitados e compara a sequência de foco real. Confirma foco após erros de preço/localização, foco no resumo de revisão e Tab no primeiro link de correção. Nenhum upload externo, pagamento, fornecedor ou conta real.

Exigir CI 5/5 na SHA exata antes de integrar. Este ensaio verifica navegação automatizada real, não substitui observação humana, leitor de tela, dispositivo físico ou jornada completa com mídia homologada. Não promover automaticamente keyboard-check ou requisito 67. Preflight 16/21 e NO-GO até evidência formal/aceite. R$ 0 de novos gastos. Backup e credenciais seguem dependentes do executor privado já preparado.
