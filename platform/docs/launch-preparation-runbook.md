# Preparação operacional até o lançamento real

**Estado:** preparado, não executado; piloto e produção permanecem `NO-GO`.

Este runbook transforma os 22 requisitos ainda parciais ou bloqueados em nove frentes executáveis. A fonte validável é `config/launch-preparation.v1.json`; execute:

```bash
npm run launch:preparation:validate
```

O comando deve informar nove áreas, 22 requisitos, 37 tarefas, 37 evidências requeridas, somente o fundador nomeado e `launchAuthorized=false`. Ele não chama fornecedores, não lê segredos, não contrata serviços e não promove requisitos.

## Regra de execução

1. O fundador abre a frente e mantém o gate fechado.
2. Próximo ao lançamento, cada pessoa recebe conta individual e aceita formalmente sua função.
3. Evidência sensível fica em repositório privado; o GitHub público recebe somente referência opaca, resultado, data e aprovadores.
4. A pessoa que executa não pode aprovar a própria evidência quando o gate exige independência.
5. Achado crítico ou alto bloqueia lançamento. Achado médio precisa de mitigação antes do lançamento e correção em até 30 dias. Achado baixo vence em 90 dias ou antes da próxima expansão.
6. Somente depois de todos os gates profissionais, humanos, técnicos e contratuais, o fundador registra a decisão final.

## Ordem e condição de saída

### 1. Pagamentos, frete e troca

- solicitar proposta, documentação e sandbox do Asaas e da Lalamove;
- confirmar tarifa, base de cálculo, split, repasse, estorno, disputa e saída;
- executar caminho feliz, timeout, duplicidade, evento fora de ordem, chargeback, cancelamento, prova de entrega e duas pernas da troca;
- reconciliar centavo a centavo o extrato do sandbox com o livro interno.

**Saída:** proposta e tabela aprovadas, sandbox completo e relatório de reconciliação. Item 12 continua em standby até decisão específica.

### 2. Dados infantis e perfis familiares

- nomear advogado e especialista de privacidade distintos;
- entregar o pacote consolidado pré-piloto;
- obter tabela de dado, finalidade, base legal, acesso, retenção, eliminação e risco;
- tratar achados e registrar parecer conjunto.

**Saída:** pareceres assinados, documentos versionados e autorização final. Flags infantis continuam falsas até esse momento.

### 3. Marketplace e mídia

- obter ambiente autorizado de armazenamento/processamento;
- executar lote de 500 imagens artificiais;
- medir telefone/e-mail, QR, falso positivo, EXIF e antimalware;
- revisar falsos resultados com pessoas distintas de níveis 2 e 3.

**Saída:** métricas mínimas atendidas, privacidade aprovada e relatório independente.

### 4. Exclusão, retenção e Termos

- aprovar retenção por categoria;
- aprovar Termos e Privacidade finais;
- executar purga autorizada em ambiente isolado;
- comprovar banco, objetos, cache e expiração de backup;
- testar aviso e novo aceite de mudança relevante.

**Saída:** parecer, documentos finais, relatório de purga e evidência de comunicação/aceite.

### 5. Notificações, suporte e incidentes

- verificar domínio e canal transacional;
- formar dois turnos, com nível 2 por turno e escalonamento 3/4/5;
- nomear responsável técnico, substituto e observador independente;
- executar os três cenários sintéticos de incidente.

**Saída:** entrega de canal comprovada, escala aceita, papéis aceitos e exercício aprovado.

### 6. Backup, recuperação e credenciais

- provisionar bucket privado, KMS, versionamento e retenção imutável;
- provisionar cofre e identidades por serviço;
- restaurar em banco isolado e medir RPO/RTO;
- testar rotação e revogação emergencial.

**Saída:** RPO até 60 minutos, RTO até 240 minutos, logs mínimos, ensaio mensal e observação independente trimestral.

### 7. Fornecedores, saída e seguro

- revisar exportação, eliminação, suboperadores, rescisão e continuidade;
- ensaiar saída sem depender de dado ou credencial real;
- manter seguro como não contratado, salvo nova proposta e decisão.

**Saída:** condições de saída aprovadas, portabilidade comprovada e decisão formal sobre seguro.

### 8. Instituições e doações

- selecionar uma ou duas instituições de Belo Horizonte;
- nível 2 verifica documentos, representante e capacidade;
- nível 3 aprova e nível 4 é notificado;
- realizar retirada sintética e confirmação bilateral.

**Saída:** referências auditáveis, aceite do representante, capacidade comprovada e ensaio aprovado.

### 9. Piloto BH e acessibilidade

- concluir publicação, busca e negociação;
- concluir teclado;
- testar Android/TalkBack, iPhone/VoiceOver e Windows/NVDA físicos;
- executar sessão com especialista independente e pessoa usuária de tecnologia assistiva;
- concluir nomeação e exercício de rollback.

**Saída:** cinco evidências pendentes concluídas, achados tratados e ata formal de `GO/NO-GO`. Mesmo 21/21 técnico não substitui os demais gates.

## Modelo de solicitação a fornecedor

Enviar sem segredo ou dado pessoal:

- identificação da FraldaCycle e escopo do piloto em Belo Horizonte;
- pedido de proposta comercial sem aceite automático;
- documentação de API, sandbox, tarifas, limites, SLA e suporte;
- webhooks, idempotência, reconciliação, estorno, disputa e exportação;
- privacidade, suboperadores, localização, retenção, eliminação e saída;
- declaração de que nenhuma produção será ativada antes da homologação.

## Registro mínimo de evidência

Cada evidência privada deve gerar uma referência pública contendo apenas:

- área e tarefa;
- versão do código/configuração;
- ambiente isolado utilizado;
- data e resultado;
- função de quem executou e de quem revisou, sem publicar dado pessoal desnecessário;
- achados por severidade;
- decisão `aprovado`, `reprovado` ou `bloqueado`;
- próximo passo e prazo.

Nunca registrar senha, token, chave, documento bruto, endereço completo, dado infantil, extrato identificável ou URL privada.

## Gate final

O lançamento continua proibido enquanto qualquer área estiver `waiting-human-or-external`, faltar evidência, existir achado crítico/alto aberto, houver mitigação média ausente, o item 12 for tratado como decidido sem nova deliberação ou `finalDecision.launchAuthorized` permanecer falso. A atualização do manifesto deverá ocorrer em PR próprio, com evidência revisada e sem reescrever o histórico.
