# Google Maps — geocodificação e rotas antes da ativação

## Decisão preparada

O piloto de Belo Horizonte usa Google Maps para validar endereços e calcular distância e duração. A logística segue a ordem aprovada: Lalamove, entregador cadastrado elegível mais próximo, Loggi Express e Uber Direct. Retirada local e Correios permanecem fora do fluxo.

O cliente nativo `apps/api/google-maps-client.js` está isolado e não é chamado automaticamente. Assim, nenhuma consulta, custo ou compartilhamento de endereço ocorre antes da contratação e da configuração explícita.

## Contrato técnico concluído

- geocodificação limitada a Brasil, Minas Gerais e município de Belo Horizonte;
- rejeição de resultado fora da área do piloto;
- cálculo de rota de direção com tráfego, unidades métricas e resposta mínima;
- chave mantida exclusivamente no servidor e ausente dos resultados;
- timeout e erros externos convertidos em mensagens internas sem detalhes sensíveis;
- testes usam respostas simuladas, sem acessar ou consumir a API real.

## Último passo de ativação externa

1. Criar projeto de produção e faturamento na Google Cloud.
2. Habilitar apenas Geocoding API e Routes API.
3. Criar chave separada por ambiente, restrita às duas APIs e aos IPs de saída do back-end.
4. Definir cota diária, alerta e teto operacional de custo.
5. Homologar uma amostra representativa de endereços reais autorizados em Belo Horizonte.
6. Aprovar privacidade, retenção e política de cache conforme os termos do fornecedor.
7. Configurar a chave no cofre de segredos e então ligar o cliente ao fluxo de cotação.

Até essas sete confirmações, a funcionalidade continua pronta para integração, porém desativada. Este pacote não afirma homologação, contratação nem funcionamento real do fornecedor.
