# Controle contra CEP falso

Estado: contrato técnico implementado; persistência da evidência e bloqueio no cadastro real ainda dependem da integração do provedor de endereços.

## Regra

- normalizar CEP brasileiro para oito dígitos;
- rejeitar formato inválido e sequências triviais com oito dígitos iguais;
- exigir correspondência exata do CEP retornado por provedor aprovado;
- exigir correspondência de cidade e UF;
- rejeitar resultado parcial;
- vincular a evidência ao ID e à versão do endereço;
- qualquer edição do endereço invalida a evidência anterior;
- gerar impressão digital técnica sem guardar endereço completo no evento antifraude.

No piloto de Belo Horizonte continuam valendo, adicionalmente, a cidade, UF e as faixas de CEP configuradas para a capital. Número e complemento não entram no ranking de distância.

## Comportamento

Falha de confirmação bloqueia novas cotações e novas operações que dependam daquele endereço, mas não encerra a conta, não cancela operações existentes e não prova fraude por si só. O usuário deve poder corrigir o endereço e solicitar nova verificação.

## Ativação pendente

Google Maps e/ou ViaCEP precisam retornar CEP, localidade, UF, identificador da consulta e indicação de correspondência exata. A persistência deve registrar provedor, versão do endereço, fingerprint e horário, sem copiar número ou complemento para logs antifraude.
