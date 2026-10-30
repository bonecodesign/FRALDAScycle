# FC-DEC-2026-10-30 — Google Maps para rotas

- Fornecedor escolhido: Google Maps Platform, usando Routes API.
- A rota considera apenas os centros geocodificados dos endereços autorizados; GPS, número e complemento não entram no ranking.
- O resultado normalizado guarda distância e duração; a chave nunca sai do servidor.
- Se a API falhar, o checkout usa linha reta temporariamente e marca `straight_line_fallback`; nenhum produto é ocultado por isso.
- Ativação exige chave restrita, cotas, teto de custo, homologação e aprovação de privacidade.

## Disponibilidade pública

Por decisão do fundador, fontes públicas aprovadas podem ser consultadas automaticamente a cada hora. Esse sinal é apenas operacional: a fonte oficial do fabricante continua determinando faixa etária, peso e compatibilidade. O worker exige ativação explícita e não faz scraping de domínios não aprovados.
