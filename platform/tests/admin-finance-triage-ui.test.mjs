import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=(await readFile(new URL('../apps/admin/truthful-operations.js',import.meta.url),'utf8')).replace(/^import .*;\s*$/gm,'').split('\nfunction resolutionForm')[0];
function harness(send){
  const nodes=new Map();
  function node(){return{textContent:'',disabled:false,hidden:true,rows:[],replaceChildren(){this.rows=[]},append(x){this.rows.push(x)}}}
  const ctx=vm.createContext({Intl,document:{getElementById(id){if(!nodes.has(id))nodes.set(id,node());return nodes.get(id)},createElement:node},apiRequest:send});
  vm.runInContext(source,ctx);return{ctx,nodes};
}
test('FC-421: finance triage labels do not claim payment failure from age alone',()=>{
  const h=harness(()=>{throw Error('unused')});
  assert.equal(h.ctx.financeReviewLabel({status:'pending',overdue_pending:true,open_cases:0}),'Pendente há 2h ou mais');
  assert.match(h.ctx.financeReviewLabel({status:'disputed',open_cases:2}),/Pagamento em disputa.*Ocorrências abertas: 2/);
  assert.match(h.ctx.financeReviewLabel({status:'failed'}),/conciliar antes de repetir/);
  assert.equal(h.ctx.financeReviewLabel({status:'paid',overdue_pending:false,open_cases:0}),'—');
});
test('FC-421: snapshot failure clears all prior financial figures and does not claim empty data',async()=>{
  let failed=false;const h=harness(async()=>{if(failed)throw {status:403};return{summary:{payment_count:2,paid_volume_cents:4000,paid_count:1,pending_count:1,exception_count:1,overdue_pending_count:1},items:[]}});
  await h.ctx.loadFinance();assert.equal(h.nodes.get('finance-overdue-count').textContent,'1');
  failed=true;await h.ctx.loadFinance();
  for(const key of ['finance-payment-count','finance-paid-volume','finance-paid-count','finance-pending-count','finance-exception-count','finance-overdue-count'])assert.equal(h.nodes.get(key).textContent,'—');
  assert.equal(h.nodes.get('finance-empty').hidden,true);
  assert.match(h.nodes.get('finance-status').textContent,/não possui permissão/);
});
