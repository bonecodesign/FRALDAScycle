import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';
import { listingPrice,saleSplit } from '../packages/contracts/commercial-rules.js';
import { publicationText } from '../packages/contracts/publication-review.js';

class Element {
  constructor(tag){this.tag=tag;this.children=[];this.style={}}
  append(...nodes){this.children.push(...nodes)}
  replaceChildren(...nodes){this.children=nodes}
}
const allText=node=>[node.textContent||'',...node.children.map(allText)].join('\n');
async function render(draft,options){
  const source=(await readFile(new URL('../packages/contracts/publication-review.js',import.meta.url),'utf8')).replace(/^import .*;\s*$/gm,'').replaceAll('export function','function');
  const context={document:{createElement:tag=>new Element(tag)},listingPrice,saleSplit,Intl};vm.createContext(context);vm.runInContext(source,context);
  const root=new Element('section');root.append(new Element('old-placeholder'));context.renderPublicationReview(root,draft,options);return root;
}
const draft={kind:'sale',brand:'Babysec',model:'Premium',size:'G',quantity:'32',packageCondition:'sealed',priceCents:3700,expiry:'08/2027',delivery:'Retirada no local',location:'Boa Vista',description:'Pacote lacrado, armazenado em lugar seco.'};

test('review uses actual product, condition, price and description and replaces old sample content',async()=>{
  const root=await render(draft,{hasPhoto:true});
  const text=allText(root);
  for(const actual of ['Babysec Premium G · 32 unidades','Pacote fechado e lacrado','08/2027','Retirada no local','Boa Vista','37,00','2,96','34,04',publicationText(draft).description])assert.ok(text.includes(actual));
  assert.equal(root.children.some(node=>node.tag==='old-placeholder'),false);
  assert.doesNotMatch(text,/Pampers|Funcionários|10\/2026/);
});

test('open donation displays actual institution and declaration without a stale sale price',async()=>{
  const root=await render({...draft,kind:'donation',packageCondition:'open',institutionName:'Instituição <Teste>',openPackageAttested:true},{hasPhoto:true,photoPreview:'blob:local-photo'});
  const text=allText(root);
  assert.match(text,/Pacote aberto para doação/);
  assert.match(text,/Instituição destinatária: Instituição <Teste>/);
  assert.match(text,/Condições sanitárias declaradas/);
  assert.doesNotMatch(text,/37,00|Comissão:/);
  assert.equal(root.children[1].children[0].src,'blob:local-photo');
});

test('missing values are reported and user markup stays in text nodes',async()=>{
  const root=await render({kind:'exchange',title:'<img onerror=alert(1)>',description:'<script>unsafe</script>'});
  const text=allText(root);
  for(const missing of ['Validade não informada','Região não informada','Foto não enviada','Quantidade não informada'])assert.ok(text.includes(missing));
  assert.match(text,/<img onerror=alert\(1\)>/);
  assert.equal(root.children[1].children.some(node=>node.tag==='img'),false);
  assert.equal(publicationText({}).description,'');
});
