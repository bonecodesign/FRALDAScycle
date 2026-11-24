# FC-363 — Antivírus local: resultado observado e bloqueio conservador

**Data:** 24/11/2026 (BRT). **Projeto único:** `bonecodesign/FRALDAScycle`.
**Gastos novos:** R$ 0. **Local:** contêiner isolado da sessão ChatGPT, **não** computador do usuário, infraestrutura hospedada ou produção.

## Resultado concreto (não é homologação)

A inspeção do ambiente Debian 13 identificou que **`clamscan`, `sigtool` e `freshclam` não estavam disponíveis**, nem havia banco de assinaturas de ClamAV. Foi tentada **somente** a atualização do índice de pacotes `apt-get update` no ambiente isolado, sem instalar, contratar ou ativar serviços. A consulta falhou com **`Temporary failure resolving 'deb.debian.org'`**. Portanto **nenhum pacote foi baixado e nenhuma varredura antivírus real foi realizada**, nem em imagem sintética nem em imagem de usuário.

O comando `node tools/media-local-antivirus-lab.mjs` foi executado e terminou com **código 2** (bloqueio intencional), retornando `blocked-no-antivirus-clearance`. Todos os cinco controles sobre disponibilidade, banco de assinaturas e arquivos teste ficaram bloqueados: **não houve falso status `clean`**.

## O que acrescentamos ao código

- `tools/media-local-antivirus-lab.mjs`: autoavaliação **opcional, local e offline** que nunca instala nada nem executa `freshclam`. Exige os binários `clamscan` e `sigtool`, base `daily.cvd`/`daily.cld` existente e atualizada há no máximo 72 horas, metadados inspecionáveis e dois testes isolados: uma imagem PNG **inteiramente artificial** identificada como limpa e a assinatura padrão do **EICAR, um teste inofensivo (não malware)** detectada pelo antivírus. Arquivos são criados com permissão restrita em diretório temporário e apagados mesmo quando o teste falha. Invocação sem shell, com limites de tempo e sem rede; saída do scanner não é gravada nem devolvida no relatório.
- `tests/media-local-antivirus-lab.test.mjs`: **quatro testes Node, 4/4 aprovados localmente**, com **respostas simuladas do scanner**, exercitando aprovações condicionais e bloqueios por engine ausente, `sigtool` ausente, assinatura velha, resultado inconclusivo, advertência, timeout, EICAR ignorado e imagem benigna falsamente detectada. **Os 4/4 comprovam a lógica de decisão, não a execução do ClamAV.**
- `docs/evidence/fc363-local-antivirus-2026-11-24.json`: evidência factual resumida da ausência do antivírus, tentativa de obter índices com DNS falho e do resultado bloqueado, sem dados de usuário.

Quando e somente quando o ClamAV + assinaturas válidas estiverem instalados **de forma separadamente autorizada** no ambiente adequado, o experimento poderá retornar `local-eicar-self-test-passed-not-homologated`. Mesmo nesse caso, **o teste não emite `scanStatus=clean` para mídia do FraldaCycle**, nem libera uso comercial, fornecedor, revisão de imagens ou qualquer gate.

## Reprodução sem custos nem instalação implícita

Na pasta `platform/`, em uma máquina autorizada com Node >=20:

```bash
node --test tests/media-local-antivirus-lab.test.mjs
node tools/media-local-antivirus-lab.mjs
```

A execução da segunda linha **deve falhar fechado** com código 2 se faltarem scanner, `sigtool`, definição `daily` recente ou resposta correta dos dois testes. Não copiar exames ou URLs privados para logs. A primeira linha usa apenas mocks e é segura para rodar na CI existente.

## Pendências e limites

- Instalar/configurar ferramentas gratuitas em ambiente isolado futuro **sem custos novos**, com atualização de assinaturas aprovada e observada. Sem acesso de rede neste ambiente, essa etapa permanece bloqueada.
- Validar a execução real da varredura, atualização de assinaturas, política de quarentena, cargas de arquivos e falhas sob concorrência. EICAR é um autoteste funcional, não teste completo de detecção de malware real.
- Não foi integrado um motor antivírus em produção nem houve fornecedor contratado. A confiabilidade das próprias declarações do processador permanece sujeita à homologação real.
- **MED-G04 continua sem prova de execução real**; os demais MED-G01–G12 também dependem de fornecedores, segurança, privacidade e avaliação humana. Nenhuma promoção oficial: requisito 41 **parcial**, matriz **48/70**, piloto BH **16/21**, **NO-GO**.
- Preservada a decisão FC-361: testar primeiro opções locais com **R$ 0 de novos gastos**; somente após os testes escolher fornecedor, com autorização separada. Nenhuma alteração em Supabase, credenciais, dados infantis, pagamentos ou projetos externos. PR #333 infantil não tocado.

**Importante:** a data de modificação da base de assinaturas e o metadado emitido por `sigtool` são indícios locais de disponibilidade e atualidade; não provam autenticidade ou cobertura por si sós. Produção exigirá cadeia de atualização segura e homologação com os responsáveis.
