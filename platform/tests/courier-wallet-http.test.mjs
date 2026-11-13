import assert from 'node:assert/strict';
import test from 'node:test';
import {Readable} from 'node:stream';
import {handleCourierWallet} from '../apps/api/courier-wallet-handler.js';
import {createCourierWalletService} from '../apps/api/courier-wallet-service.js';

function response(){return{status:null,headers:null,body:null,writeHead(status,headers){this.status=status;this.headers=headers;},end(body){this.body=JSON.parse(body);}};}
function request(method,cookie,body){const stream=Readable.from(body?[Buffer.from(JSON.stringify(body))]:[]);stream.method=method;stream.headers={cookie,...(body?{'content-type':'application/json'}:{})};return stream;}

test('courier wallet HTTP is private, owner-scoped and never cached',async()=>{
  const calls=[];const service=createCourierWalletService({
    async summary(id){calls.push(['summary',id]);return{available_cents:5200,reserved_cents:2000,version:3,updated_at:'2030-01-01'};},
    async activity(id){calls.push(['activity',id]);return{entries:[{id:1,kind:'delivery_credit',amount_cents:5200,available_after_cents:5200,reserved_after_cents:0,source_type:'courier_payout',created_at:'2030-01-01'}],withdrawals:[]};},
    async requestWithdrawal(input){calls.push(['withdrawal',input]);return{withdrawal:{id:'withdrawal'},reused:false};},
  });
  const authService={async session(token){return token==='courier'?{id:'courier-id',role:'courier'}:token==='customer'?{id:'customer-id',role:'customer'}:null;}};
  const invoke=async(method,path,cookie,body)=>{const output=response();await handleCourierWallet(request(method,cookie,body),output,{url:new URL(`http://local${path}`),headers:{},requestId:'request-id',authService,courierWalletService:service});return output;};
  await assert.rejects(invoke('GET','/v1/courier/wallet',undefined),error=>error.status===401);
  await assert.rejects(invoke('GET','/v1/courier/wallet','fc_session=customer'),error=>error.status===403);
  const summary=await invoke('GET','/v1/courier/wallet','fc_session=courier');assert.equal(summary.status,200);assert.equal(summary.headers['cache-control'],'no-store');assert.equal(summary.body.wallet.availableCents,5200);
  const activity=await invoke('GET','/v1/courier/wallet/activity','fc_session=courier');assert.equal(activity.body.activity.entries[0].kind,'delivery_credit');
  const withdrawal=await invoke('POST','/v1/courier/wallet/withdrawals','fc_session=courier',{amountCents:2000,idempotencyKey:'wallet-request-http-0001',confirmed:true});assert.equal(withdrawal.status,201);assert.equal(calls.at(-1)[1].courierId,'courier-id');
});
