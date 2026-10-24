# Ingestão das tabelas oficiais dos fabricantes

Decisão aprovada em 24 de outubro de 2026: o piloto utilizará catálogo interno versionado, importado por CSV a partir de documento oficial e submetido a duas revisões independentes.

## Regras preparadas

- fonte HTTPS, fabricante, data de vigência e SHA-256 do documento são obrigatórios;
- CSV possui cabeçalho fixo, limite de 10.000 itens e identidade única por produto/tamanho;
- faixa oficial pode ser etária, de peso ou ambas;
- peso pertence à especificação do produto; nenhum peso é atribuído ou armazenado para uma criança;
- importador não pode revisar o próprio lote;
- dois revisores distintos precisam aprovar;
- qualquer rejeição impede a ativação;
- dados sem orientação oficial suficiente continuam fora da prioridade etária.

Esta etapa valida o arquivo e a governança em memória. Persistência, tela administrativa, autorização por papel e ativação atômica do lote serão implementadas no próximo pacote. Nenhum dado real de fabricante foi incluído e nenhuma coleta automática foi autorizada.
