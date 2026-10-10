# Comprovante do entregador — proteção da interface

A tela permitia repetir o envio enquanto obtinha localização e mantinha uma chave de foto sem vínculo com a entrega selecionada. Agora os controles ficam bloqueados durante upload e registro; a foto é vinculada ao identificador da entrega. Uma mudança de entrega durante upload ou localização não envia o comprovante anterior. Resposta antiga não apaga a foto de outra entrega nem redireciona sua tela.

Falha de localização ou API conserva os dados para nova tentativa. Uma resposta incompleta não apresenta sucesso. O registro reconhece a resposta idempotente do backend e só limpa a foto correspondente. A autorização e a validação reais continuam no backend.

O campo do recebedor tem rótulo associado e limites de 2 a 100 caracteres. A ação usa botão nativo com estado desabilitado e `aria-busy`; o texto “Registrar comprovante” corresponde ao estado que ainda aguarda aprovação e validação.

Validação local: sete testes executam o código da interface com DOM/API simulados e cobrem repetição, permissão recusada, falha de API, mudança de entrega durante upload/localização e resposta antiga. A beta integrada também usa a tela real do Chromium, API e PostgreSQL descartável: localização recusada preserva a foto; a tentativa seguinte por teclado registra o comprovante e abre o histórico. Quatro larguras (320, 375, 768, 1280) passaram sem overflow horizontal ou inputs sem rótulo. Sintaxe de produção aprovada. Evidência resumida em `courier-proof-interface.json`.

Comandos: `node --test tests/courier-proof-ui.test.mjs tests/postgres-beta.test.mjs`; regressão de contratos e logística em `node --test tests/foundation.test.mjs tests/logistics.test.mjs`. Estes testes integram o CI da plataforma.

A foto armazenada e as coordenadas no navegador são fixtures. Não comprova upload para fornecedor real, câmera física, GPS físico, entrega presencial, seleção operacional de rotas ou repasses. Sem alteração dos percentuais formais ou ativação de produção.
