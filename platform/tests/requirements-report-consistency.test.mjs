import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

test('human-readable requirement reports match the formal JSON counts and current pilot evidence',async()=>{
  const [raw,matrixReport,activationReport]=await Promise.all([
    readFile(new URL('../docs/requirements-matrix.json',import.meta.url),'utf8'),
    readFile(new URL('../docs/requirements-matrix.md',import.meta.url),'utf8'),
    readFile(new URL('../docs/remaining-activation-gates.md',import.meta.url),'utf8'),
  ]);
  const matrix=JSON.parse(raw),counts=matrix.requirements.reduce((result,item)=>({...result,[item.status]:(result[item.status]??0)+1}),{});
  const percent=(counts.concluido/matrix.denominator*100).toFixed(2);
  assert.match(matrixReport,new RegExp(`\\*\\*${counts.concluido}/70 = ${percent}% concluídos\\.\\*\\* ${counts.parcial} parciais, 0 pendentes, ${counts.bloqueado} bloqueados`));
  assert.match(activationReport,new RegExp(`- ${counts.concluido} concluídos: ${percent.replace('.',',')}%\\.`));
  assert.match(activationReport,new RegExp(`- ${counts.parcial} parciais: ${(counts.parcial/70*100).toFixed(2).replace('.',',')}%\\.`));
  assert.match(activationReport,new RegExp(`- ${counts.bloqueado} bloqueados: ${(counts.bloqueado/70*100).toFixed(2).replace('.',',')}%\\.`));
  assert.doesNotMatch(activationReport,/37 concluídos|21 parciais/);
  assert.doesNotMatch(matrixReport,/Jornadas completas de destinos\/CEP/);
  assert.match(matrixReport,/19\/21 evidências técnicas/);
});
