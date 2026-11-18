# FC-311 — Preparação segura da homologação humana BH

**Estado:** somente roteiro público para execução futura; **não executado**, sem aceites, evidências ou nomes de participantes. Piloto BH **NO-GO**, matriz **48/70** e preflight **16/21**. Histórico original preservado.

## Para que serve

O [registro de preparação](../config/pilot-human-session-preparation.v1.json) espelha **exatamente os cinco itens pendentes** do [preflight oficial](../config/pilot-technical-preflight.v1.json). O [validador](../tools/pilot-human-session-preparation.mjs) recusa alegações de execução humana, referências privadas, alterações de política, papéis de rollback aceitos ou qualquer aprovação de lançamento. Isso impede que um checklist pronto seja confundido com evidência concluída.

Na pasta platform/, executar somente a validação de **preparação**:

~~~sh
node tools/pilot-human-session-preparation.mjs
node --test tests/pilot-human-session-preparation.test.mjs
~~~

Uma saída valid:true prova apenas que o roteiro público está completo, **nunca** que alguém testou dispositivos, leitores de tela ou rollback. Não há agendamento automático, criação de contas reais nem integração a serviços.

## Roteiro de campo (17 verificações)

| Evidência oficial | Tarefas a executar presencialmente ou com observação humana verificável | O que registrar no cofre de evidências privado |
| --- | --- | --- |
| publish-search-negotiate | Ambiente de mídia **homologado e sintético**; oito etapas de publicação; revisão independente; busca e negociação com chat bloqueado antes do pagamento | Commit, versões, contexto de mídia, observador, resultados por etapa, eventuais problemas e interrupções; nunca imagem de criança ou cobrança real |
| keyboard-check | Navegação apenas pelo teclado; ordem de foco, atalhos e links de pular conteúdo; erros, estados e avisos anunciados | Teclado, navegador, sequência realmente percorrida, barreiras reproduzíveis e decisão humana |
| device-matrix | Identificar e usar **dispositivos físicos**, não confundir emulação com aparelho; retrato/paisagem; foco, zoom e usabilidade | Tipo de dispositivo não identificável, sistema/navegador/versões, orientação, resultados e limites não testados |
| screen-reader-check | Identificar tecnologia assistiva e versão; observar cadastro, busca, publicação, erros e estados; verificar bloqueio de chat e suporte | Avaliação por pessoa, equipamento, leitor de tela, tarefas, falhas com severidade e aceite privado |
| rollback-owner | Nomear titular, substituto e observador **distintos**; receber aceites privados; ensaiar três incidentes sintéticos; comprovar segregação de pausa, retomada e recuperação | Referências privadas dos aceites, autenticação, versão do runbook, resultados de exercícios e decisão assinada fora do GitHub |

**Se não houver infraestrutura autorizada para mídia, nenhum teste de publicação com upload real deverá ser improvisado.** O item continua pendente. Se um dispositivo, tecnologia assistiva ou pessoa necessária não estiver disponível, marcar como **não executado** no registro privado.

## Integridade do aceite

1. **Antes da sessão:** confirmar commit exato, ambiente isolado, testes com dados sintéticos, acessibilidade e autorização para usar exclusivamente os dispositivos de teste. O arquivo público não deve conter nomes civis, CPF, telefones, e-mails, tokens, URL de acesso privativo, gravações ou prova identificável.
2. **Durante a sessão:** cada resultado deve ter observação real, instante, técnica/dispositivo, identificador de evidência privado, responsável pela decisão e severidade de achados. Apenas rótulos de tarefas não constituem evidência.
3. **Depois da sessão:** responsáveis independentes analisam achados e aceites, revisam LGPD/segurança, assinam a decisão no sistema de evidências de acesso restrito. Nunca adicionar aceites pessoais ao Git público.
4. **Critério de bloqueio:** falha grave, não execução, ausência de observador ou de substituto, fornecedor não homologado ou dúvida sobre o resultado mantém **NO-GO**. Os scripts de preparação não validam identidade nem provam presença humana.
5. **Promover evidência:** somente após revisão externa e uma mudança futura separada, autorizada e fundamentada do preflight. **Não reescrever o registro histórico da rodada anterior**. Homologação humana isolada também não autoriza pagamento, logística, produção ou lançamento.

## Próximo trabalho condicionado a pessoas e fornecedores

- **H1 (qualidade):** sessão humana real com leitor de tela e dispositivos; documentar falhas em repositório privado, corrigir em PR própria e repetir os cenários afetados.
- **H2 (recuperação):** nomeação/aceite de titular, substituto e observador, seguida dos exercícios supervisionados de rollback.
- **Jornada pública:** somente com adaptação de mídia efetivamente homologada, executar publicação com foto, revisão independente, busca e negociação.
- **Portões externos:** serviços financeiros/logísticos, revisão jurídica/LGPD e segurança permanecem separados. O piloto BH continua NO-GO.

Este pacote serve para **não repetir a implementação já pronta** e para evitar a promoção de cenários que ainda não foram observados por pessoas.
