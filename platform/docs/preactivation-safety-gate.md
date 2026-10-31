# Gate de segurança de pré-ativação

Enquanto o projeto estiver formalmente **NO-GO**, execute:

```sh
npm run preactivation:safety
```

O comando falha se encontrar ativa uma capacidade que possa iniciar coleta
infantil, cadastro real, piloto, cobrança, cotação/checkout de entrega,
comunicação externa, armazenamento externo ou worker operacional. Também falha
se Asaas ou Lalamove já estiverem selecionados para produção.

Esse gate comprova somente que o ambiente permanece inerte. Resultado verde
não representa homologação, contratação, aprovação jurídica, autorização do
fundador ou autorização de lançamento. Credenciais e flags de reconhecimento
continuam insuficientes para ativar o projeto enquanto o status formal for
NO-GO.

Na ativação futura, este gate deverá ser substituído deliberadamente por um
procedimento de lançamento versionado, com aprovações e evidências externas.
