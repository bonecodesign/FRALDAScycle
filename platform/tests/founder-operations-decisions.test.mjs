import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';

const decisionUrl=new URL('../docs/decisions/FC-DEC-2026-11-05-operacao-piloto-painel.md',import.meta.url);

test('founder operational decisions preserve sector isolation and technical 3-4-5 governance',async()=>{const source=await readFile(decisionUrl,'utf8');for(const evidence of['nível, setor e escopos','Não existe acesso excepcional temporário entre setores','Nível 3 técnico cria branch','Nível 4 técnico revisa','Nível 5 autoriza publicação','um único entregador do início ao fim','A → B → A','Marketplace não possui catálogo central obrigatório'])assert.match(source,new RegExp(evidence));});

test('decision record does not claim implementation or activate real providers',async()=>{const source=await readFile(decisionUrl,'utf8');assert.match(source,/implementação, contratação e validações externas continuam separadas/);assert.match(source,/feature flag permanece desligada/);assert.match(source,/Percentuais formais da matriz não mudam/);assert.doesNotMatch(source,/Estado: \*\*implementado|GO para produção/);});
