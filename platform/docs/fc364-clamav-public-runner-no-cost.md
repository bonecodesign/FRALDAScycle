# FC-364 — tentativa de antivírus ClamAV real, sem novos gastos, no GitHub Actions

**Data:** 24/11/2026. **Projeto:** exclusivamente `bonecodesign/FRALDAScycle`, repositório **público**. **Objetivo:** superar a impossibilidade de instalar ClamAV no contêiner temporário da sessão ChatGPT, sem pedir ao usuário que execute comandos.

## Custo e isolamento

O repositório foi conferido como **público** via GitHub. Segundo a documentação oficial, uso de **executores padrão hospedados pelo GitHub em repositórios públicos é gratuito**:
https://docs.github.com/en/actions/concepts/billing-and-usage

O workflow `.github/workflows/fc364-clamav-sandbox.yml` usa **somente** `ubuntu-24.04` padrão com tempo máximo de 15 minutos, permissões `contents: read`, checkout sem credenciais persistidas, sem caches, artefatos, serviços persistentes, variáveis privadas ou deploy. Nenhuma infraestrutura real do FraldaCycle, Supabase, usuário, criança, cartão ou armazenamento externo é acessada.

**Observação:** a instalação de software gratuito ocorre temporariamente no executor GitHub e requer acesso a repositórios oficiais Debian/Ubuntu e ao atualizador ClamAV. Não é a mesma coisa que um processador permanentemente gratuito em produção. Não instalar no computador do usuário.

## Procedimento de prova

1. Gatilho limitado a PR que muda o próprio workflow ou o laboratório AV, ou disparo manual futuro.
2. Instala `clamav` e `clamav-freshclam` em runner descartável, sem criar serviço permanente.
3. Executa `freshclam` para baixar assinaturas oficiais. Indisponibilidade/rate-limit/timeout **reprovam** o teste, não autorizam usar banco velho.
4. Executa `node --test tests/media-local-antivirus-lab.test.mjs` (lógica do bloqueio) **e, separadamente,** `node tools/media-local-antivirus-lab.mjs`, que chama `clamscan` de verdade em **um PNG artificial e no padrão de teste EICAR, inofensivo**, com `sigtool`, banco diário recente e dois resultados distintos.
5. A saída JSON expõe só `passed/blocked`, jamais texto bruto de scanner, URLs privadas ou dados de usuários. O workflow conclui `success` **somente se a prova real tiver sido realizada** e todas as verificações passarem.
6. Em caso de sucesso, registrar ID do workflow, commit e limitações. Em caso de falha, investigar somente erros de instalação/assinaturas/teste e **não declarar homologação**.

## Limites absolutos

Um teste EICAR detectado confirma o funcionamento local da engine sob aquelas assinaturas, **não** prova detecção de malware adversarial em fotos reais, quarentena, atualização contínua, privacidade, concorrência, imutabilidade, OCR/QR de produção ou homologação de fornecedor. `MED-G04` e a jornada de mídia completa permanecem **pendentes**, mesmo com CI verde.

Decisão FC-361: primeiro testar a alternativa gratuita, **depois** decidir oficialmente fornecedor. Novo gasto autorizado: **R$ 0**. Preservar 48/70 requisitos, 16/21 evidências no piloto BH e **NO-GO**; não modificar outra aplicação ou o PR #333.
