# Carga e capacidade — portão anterior à homologação

`assessLoadTestReadiness` valida a estrutura e os resultados de um ensaio de carga sintético sem executar tráfego real. O portão exige as duas etapas planejadas — 100 e 300 usuários simultâneos —, pico controlado de pelo menos 300, p95 de no máximo 500 ms, p99 de no máximo 1,5 s e taxa de erro interno estritamente inferior a 1% em cada etapa.

Qualquer perda ou corrupção de registro, duplicação de compromisso operacional ou ausência de recuperação após o pico bloqueia o resultado. O avaliador também recusa ambiente ou dados que não estejam explicitamente marcados como isolados e sintéticos.

O resultado possível é `synthetic-pass`, nunca autorização de lançamento. A conclusão operacional depende de executar o mesmo perfil na infraestrutura homologada, observar CPU, memória, banco, filas e rede, registrar duração e responsáveis e comprovar recuperação sem intervenção indevida.

Validação local: `tests/load-test-readiness.test.mjs`. Os números do teste são fixtures e não representam capacidade medida da FraldaCycle.

O executor `runSyntheticLoadProbe`, em `tools/synthetic-load-probe.mjs`, prepara a execução: dispara as etapas de 100 e 300 usuários virtuais, um pico configurável entre 300 e 1.000, calcula p95, p99 e taxa de falhas, solicita uma verificação separada de integridade e confirma a recuperação posterior. Falhas das operações entram na taxa de erro em vez de serem ocultadas. O executor exige confirmação explícita e retorna o relatório junto ao portão acima; cabe à homologação fornecer operações e verificações conectadas somente ao ambiente autorizado.
