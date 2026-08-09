# Planejamento oficial de infraestrutura e produção

**Projeto:** FraldaCycle  
**Estado:** referência aprovada para o piloto  
**Localidade inicial:** Belo Horizonte, MG  
**Data de consolidação:** 8 de agosto de 2026

## Objetivo e limites

Este documento consolida as diretrizes de infraestrutura-base, produção e orçamento operacional tecnológico do piloto. Ele complementa `platform/docs/provider-readiness.md`.

Estas decisões não autorizam contratação, provisionamento, publicação externa ou inclusão de credenciais no repositório. Qualquer contratação e entrada em produção dependem de autorização expressa do fundador, homologação e testes aprovados.

## Resumo executivo

- Produção inicial: Hostinger VPS KVM 2.
- Homologação: ambiente separado, ativado conforme necessidade antes do lançamento e mantido separado após a publicação.
- Aplicações: site, admin e API em contêineres Docker.
- Dados: PostgreSQL e Redis sem exposição pública.
- Imagens: armazenamento externo compatível com S3 e distribuição por CDN.
- Disponibilidade interna pretendida: 99,5% ao mês no piloto.
- Recuperação: RTO de até 4 horas e RPO de até 6 horas.
- Infraestrutura-base: teto planejado de R$ 300 por mês.
- Operação tecnológica fixa: teto planejado de R$ 300 por mês.
- Total tecnológico fixo: até R$ 600 por mês, sem custos variáveis por transação.
- Expansão: KVM 4 e posterior separação de serviços quando os indicadores exigirem.

## 1. Ambientes

### Desenvolvimento

- execução no ambiente de desenvolvimento;
- dados exclusivamente fictícios;
- integrações simuladas;
- sem acesso público;
- mudanças em branches próprias;
- credenciais distintas de qualquer outro ambiente.

### Homologação

- mesma arquitetura Docker da produção;
- banco, arquivos e credenciais próprios;
- somente dados de teste;
- integrações em sandbox;
- acesso restrito;
- endereço pretendido: `homolog.fraldacycle.com.br`;
- não deve compartilhar o VPS de produção depois do lançamento;
- pode utilizar Hostinger KVM 1 ou ambiente temporário equivalente.

### Produção

- Hostinger VPS KVM 2;
- Ubuntu 24.04 LTS;
- Docker Compose;
- site, admin, API, PostgreSQL e Redis isolados;
- imagens externas ao VPS;
- HTTPS obrigatório;
- firewall e SSH por chave;
- backups, monitoramento e alertas;
- somente versões aprovadas em homologação.

Fluxo obrigatório:

`branch -> testes -> homologação -> validação -> autorização -> produção -> monitoramento`

## 2. Domínios e DNS

O domínio principal pretendido é `fraldacycle.com.br`, sujeito à confirmação de disponibilidade e titularidade.

| Endereço | Finalidade |
| --- | --- |
| `fraldacycle.com.br` | site institucional |
| `www.fraldacycle.com.br` | redirecionamento para o domínio principal |
| `api.fraldacycle.com.br` | backend |
| `admin.fraldacycle.com.br` | painel administrativo |
| `homolog.fraldacycle.com.br` | homologação restrita |
| `status.fraldacycle.com.br` | estado dos serviços |
| `assets.fraldacycle.com.br` | imagens e arquivos públicos controlados |

Diretrizes:

- domínio em nome do fundador ou da empresa;
- Cloudflare recomendado para DNS, CDN e proteção;
- autenticação de dois fatores e DNSSEC;
- HTTPS obrigatório;
- banco, Redis e portas internas sem endereço público;
- admin e homologação sem indexação;
- SPF, DKIM e DMARC quando o e-mail for contratado;
- exportação e documentação da configuração DNS.

## 3. Segurança e acessos

- princípio do menor privilégio;
- contas individuais, sem compartilhamento;
- fundador como titular das contas principais;
- autenticação de dois fatores nas contas críticas;
- revisão mensal de acessos;
- separação de credenciais por ambiente;
- segredos apenas em variáveis protegidas ou cofre;
- nenhuma credencial em Git, logs, tickets ou documentos;
- SSH por chave, autenticação por senha desativada e acesso direto de root restringido;
- PostgreSQL e Redis acessíveis somente pela rede interna;
- branch principal protegida e alterações por pull request;
- logs de autenticação e ações administrativas;
- senhas administrativas protegidas com algoritmo seguro, preferencialmente Argon2id;
- limitação de tentativas, expiração de sessão e segundo fator no admin antes do lançamento;
- conta de emergência controlada pelo fundador e não usada no cotidiano.

## 4. Backups e recuperação

| Indicador | Meta do piloto |
| --- | --- |
| RPO | até 6 horas |
| RTO | até 4 horas |
| Retenção operacional | 30 dias |
| Teste de restauração | trimestral |

Política:

- backup do PostgreSQL a cada 6 horas;
- cópia completa diária;
- retenção diária por 30 dias;
- cópia mensal por 12 meses;
- backups criptografados e armazenados fora do VPS;
- backup semanal da Hostinger como camada adicional;
- snapshot antes de atualização crítica;
- versionamento ou proteção contra exclusão no armazenamento de imagens;
- restauração trimestral em ambiente isolado;
- alerta para falha de backup;
- código versionado e releases identificáveis;
- restauração seguida de validação dos fluxos essenciais.

## 5. Imagens dos anúncios

As imagens não serão armazenadas permanentemente no VPS nem no PostgreSQL.

Diretrizes:

- armazenamento externo compatível com S3;
- banco guarda identificadores e metadados;
- distribuição por CDN;
- upload autenticado;
- validação do conteúdo real do arquivo;
- remoção de EXIF e localização;
- redimensionamento, compressão e miniaturas;
- WebP preferencial para exibição;
- dimensão ampliada máxima sugerida de 1600 x 1600 px;
- upload original limitado tecnicamente a 10 MB;
- nomes aleatórios, sem dados pessoais;
- upload incompleto removido após 24 horas;
- verificação semanal de arquivos órfãos;
- alertas de capacidade em 70% e 85%;
- fornecedor substituível por meio da interface S3.

Referência de capacidade, considerando em média cinco imagens otimizadas por anúncio:

| Anúncios | Armazenamento estimado |
| ---: | ---: |
| 5.000 | 5 a 10 GB |
| 10.000 | 10 a 20 GB |
| 30.000 | 30 a 60 GB |
| 100.000 | 100 a 200 GB |

## 6. Monitoramento e alertas

Monitorar continuamente:

- disponibilidade do site, API e admin;
- CPU, memória, disco, rede e reinicializações;
- PostgreSQL, Redis e filas;
- latência e taxa de erros;
- uploads e armazenamento;
- validade do HTTPS;
- idade e integridade do último backup;
- estado das integrações externas;
- versão implantada.

Limites:

| Indicador | Atenção | Crítico |
| --- | ---: | ---: |
| CPU sustentada | 70% por 15 min | 90% por 5 min |
| Memória | 75% | 90% |
| Disco | 70% | 85% |
| Erros da API | 2% por 5 min | 5% por 5 min |
| Latência comum | acima de 500 ms | acima de 1,5 s |
| Backup atrasado | 8 horas | 12 horas |
| Certificado | 30 dias | 7 dias |
| Indisponibilidade | 2 minutos | 5 minutos |

Incidentes serão classificados de P1 a P4. P1 inclui indisponibilidade geral, possível vazamento, perda de dados ou pagamentos afetados. Logs não podem conter senhas, tokens completos, cartões ou dados pessoais desnecessários.

## 7. Implantação e reversão

Toda mudança seguirá pull request e CI. Antes do merge:

- instalação limpa;
- lint e análise de tipos;
- testes unitários e de integração;
- testes de fluxos essenciais;
- build;
- análise de vulnerabilidades;
- busca por credenciais;
- validação de Docker e migrações.

Produção exige:

- testes aprovados;
- homologação concluída;
- nenhuma falha crítica;
- backup válido;
- plano de reversão;
- autorização expressa do fundador.

As imagens Docker serão imutáveis e vinculadas ao commit. Migrações serão versionadas e preferencialmente compatíveis com a versão anterior. Migração destrutiva exige análise e autorização específica.

Meta de reversão normal: até 30 minutos. Recuperação com banco segue RTO de até 4 horas.

O aplicativo móvel possui processo separado de assinatura, teste e publicação nas lojas.

## 8. Disponibilidade, desempenho e qualidade

| Indicador | Meta |
| --- | ---: |
| Disponibilidade da API e do site | 99,5% ao mês |
| Disponibilidade do admin | 99,0% ao mês |
| API comum p95 | até 500 ms |
| API comum p99 | até 1,5 s |
| Taxa de erro interno | inferior a 1% |
| Sessões móveis sem falha | superior a 99,5% |
| LCP das páginas principais | até 2,5 s |
| INP | até 200 ms |
| CLS | inferior a 0,1 |

Teste de carga anterior ao lançamento:

- 100 usuários simultâneos em uso normal;
- progressão até 300 usuários simultâneos;
- pico controlado para identificar o limite;
- ausência de perda, corrupção ou duplicação;
- taxa de erro inferior a 1%;
- recuperação normal após o pico.

Falha de segurança, dados incorretos, testes essenciais reprovados, erro nos percentuais, fluxo crítico indisponível ou impossibilidade de reversão bloqueiam a publicação.

## 9. Capacidade e expansão

O KVM 2 é a referência para o piloto:

- 2 vCPUs;
- 8 GB de RAM;
- 100 GB NVMe;
- 8 TB de transferência mensal, conforme oferta consultada em 8 de agosto de 2026.

Estimativa de capacidade do piloto, sujeita a teste de carga:

- 2.000 a 5.000 usuários cadastrados;
- 100 a 300 usuários simultâneos;
- 10.000 a 30.000 anúncios;
- consumo normal de 4,5 a 6 GB de RAM.

Gatilhos de expansão:

- memória acima de 75% continuamente;
- CPU acima de 70% por períodos prolongados;
- mais de 300 usuários simultâneos;
- banco acima de 20 a 25 GB;
- filas persistentemente atrasadas;
- p95 da API acima de 500 ms com frequência.

Primeiro passo de expansão: Hostinger KVM 4. Depois, separar banco, API e aplicações web, acrescentar instâncias e balanceamento conforme métricas reais.

## 10. Fornecedores e orçamento

### Matriz de referência

| Função | Principal previsto | Alternativa | Estado |
| --- | --- | --- | --- |
| Domínio | Registro.br | registrador autorizado | diretriz |
| DNS/CDN/proteção | Cloudflare | DNS da Hostinger | recomendado |
| Produção | Hostinger KVM 2 | VPS compatível | estabelecido para piloto |
| Homologação | Hostinger KVM 1 | ambiente temporário | ativação pendente |
| Banco | PostgreSQL no VPS | PostgreSQL gerenciado | piloto |
| Cache/filas | Redis no VPS | Redis gerenciado | piloto |
| Imagens | Cloudflare R2 | serviço S3 | candidato principal |
| Código/CI | GitHub | — | mantido |
| Push | Firebase Cloud Messaging | equivalente | candidato principal |
| Erros móveis | Firebase Crashlytics | Sentry | candidato principal |
| Pagamentos/split | Mercado Pago | Pagar.me | homologação pendente |
| Mapas | Google Maps Platform | alternativa compatível | homologação pendente |
| E-mail | fornecedor transacional | segundo homologado | seleção pendente |
| Logística | fornecedor desacoplado | múltiplos parceiros | seleção pendente |
| Lojas | Google Play/Apple App Store | — | necessárias ao app |

A matriz não equivale a contratação. Os requisitos de seleção e homologação permanecem os definidos em `platform/docs/provider-readiness.md`.

### Orçamento

| Bloco | Teto mensal |
| --- | ---: |
| Infraestrutura-base | R$ 300 |
| Operação tecnológica fixa | R$ 300 |
| Total tecnológico fixo | R$ 600 |

Ficam fora do teto fixo:

- tarifas do gateway;
- antecipação e chargeback;
- entregas;
- SMS ou WhatsApp;
- uso excedente de mapas e APIs;
- publicidade;
- equipe;
- contabilidade e jurídico;
- taxas das lojas;
- equipamentos.

Custos variáveis serão medidos por transação, terão cotas e alertas quando o fornecedor permitir e dependerão de aprovação comercial.

Referências consultadas em 8 de agosto de 2026:

- Hostinger KVM 2: R$ 42,99/mês promocional e R$ 77,99/mês na renovação de dois anos;
- Registro.br: R$ 40/ano para domínio `.br`;
- Cloudflare R2: 10 GB/mês gratuitos e cobrança adicional conforme armazenamento e operações.

Preços devem ser novamente confirmados antes de qualquer contratação.

## Governança financeira e de fornecedores

- nenhuma contratação sem autorização;
- avaliar preço de renovação, impostos e câmbio;
- evitar compromisso longo antes da homologação;
- alertas em 70%, 85% e 100% dos tetos;
- contas em nome do fundador ou da empresa;
- autenticação de dois fatores;
- contratos e renovações registrados;
- revisão mensal no piloto;
- análise de LGPD, região dos dados, SLA, suporte, exportação e plano de saída;
- produção somente após homologação técnica, comercial, jurídica, segurança e privacidade.

## Pendências de execução

- confirmar disponibilidade e titularidade do domínio;
- escolher e homologar fornecedores candidatos;
- executar testes de carga;
- contratar somente mediante autorização;
- configurar ambientes, backups e monitoramento;
- comprovar restauração e reversão;
- concluir checklist de produção;
- publicar somente após autorização expressa.

## Registro da decisão

As dez etapas deste documento constituem a referência oficial de infraestrutura-base e produção do piloto FraldaCycle. Mudanças relevantes devem ser registradas por pull request, com justificativa, impacto financeiro, riscos e aprovação.
