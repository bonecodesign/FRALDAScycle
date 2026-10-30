# Runbook de fontes de disponibilidade

Este procedimento prepara fontes auxiliares de disponibilidade sem ativar fornecedores externos ou alterar a autoridade do catálogo oficial do fabricante.

## Princípios

- A tabela oficial do fabricante é a única autoridade para compatibilidade etária e de produto.
- Fontes públicas servem apenas para disponibilidade auxiliar.
- Descoberta automática nunca promove nem ativa uma fonte sozinha.
- Toda mudança administrativa é auditada.
- A atualização horária permanece desligada até revisão operacional e aprovação de produção.

## Configuração fixa

Defina `MANUFACTURER_AVAILABILITY_FIXED_SOURCES` como lista separada por vírgulas de URLs HTTPS, sem duplicatas.

Exemplo:

```text
MANUFACTURER_AVAILABILITY_FIXED_SOURCES=https://fabricante.example/disponibilidade,https://lojista.example/estoque
```

O carregamento rejeita HTTP, URLs inválidas e duplicatas. As fontes entram como `fixed_config`, pendentes e desativadas.

## Fluxo administrativo

1. Consultar as fontes e candidatas no painel Anúncios → Fontes de disponibilidade.
2. Revisar a URL e sua finalidade.
3. Aprovar ou rejeitar com justificativa.
4. Promover uma candidata aprovada, quando aplicável.
5. Confirmar que a fonte operacional continua desativada.
6. Ativar somente após revisão de segurança, privacidade, custos e termos do fornecedor.

## Ativação horária

Em produção, o worker exige simultaneamente:

```text
MANUFACTURER_AVAILABILITY_REFRESH_ENABLED=true
MANUFACTURER_AVAILABILITY_ACTIVATION_ACKNOWLEDGED=true
```

Sem essas flags, use apenas execução local controlada (`worker:manufacturer-availability:local`). O worker deve ser idempotente: reprocessamentos não podem duplicar candidatas ou observações.

## Checklist antes do go-live

- [ ] Fonte HTTPS revisada e aprovada.
- [ ] Finalidade e retenção verificadas.
- [ ] Limites e custos do fornecedor confirmados.
- [ ] Termos de cache e armazenamento aprovados.
- [ ] Testes de concorrência aprovados.
- [ ] Auditoria conferida.
- [ ] Flags de produção autorizadas separadamente.
- [ ] Rollback e desativação testados.

Nenhum item deste runbook constitui aprovação jurídica ou autorização para produção.
