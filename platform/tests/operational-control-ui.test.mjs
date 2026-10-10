import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
function element(){return {children:[],append(...nodes){this.children.push(...nodes)},replaceChildren(){this.children=[]}};}
async function harness(){const source=(await readFile(new URL('../apps/admin/operational-control.js',import.meta.url),'utf8')).replace(/^import .*;\s*$/gm,'');const states=element(),summary=element();const context=vm.createContext({document:{getElementById:id=>({'operational-control-states':states,'operational-control-summary':summary})[id],createElement:element}});vm.runInContext(source,context);return {states,summary,render:items=>{context.items=items;vm.runInContext('render(items)',context)}};}
test('operational reason is rendered as text instead of executable markup',async()=>{const app=await harness();app.render([{domain:'global',paused:true,reason:'<img src=x onerror=alert(1)>'}]);assert.equal(app.states.children[0].children[1].children[1].textContent,'<img src=x onerror=alert(1)>');assert.equal(app.summary.textContent,'1 domínio pausado');});
test('invalid operational states are refused instead of showing fictional authorization',async()=>{const app=await harness();for(const items of [[{domain:'constructor',paused:false}],[{domain:'global',paused:'false'}],null])assert.throws(()=>app.render(items),/inválido/);assert.equal(app.states.children.length,0);});
