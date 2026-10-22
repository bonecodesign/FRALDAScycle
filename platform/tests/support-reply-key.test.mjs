import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {supportReplyKey,clearSupportReplyKey} from '../packages/contracts/support-reply-key.js';
function fixture(){const values=new Map();return {values,storage:{getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)},cryptography:webcrypto};}
test('a storage read failure cannot replace a previous reply intent',async()=>{
 const env=fixture(),body='Resposta privada fictícia';
 const original=await supportReplyKey('ticket',body,'resolved',env);
 let writes=0;
 await assert.rejects(supportReplyKey('ticket',body,'resolved',{
  ...env,storage:{
   getItem(){throw new Error('Storage read unavailable');},
   setItem(){writes++;},
  },
 }),/Storage read unavailable/);
 assert.equal(writes,0);
 assert.equal(await supportReplyKey('ticket',body,'resolved',env),original);
});
test('same reply survives reload as one key without persisting message text',async()=>{const env=fixture(),body='Resposta privada fictícia';const key=await supportReplyKey('ticket',body,'resolved',env);assert.equal(await supportReplyKey('ticket',body,'resolved',env),key);assert.equal([...env.values.values()].join('').includes(body),false);const stored=JSON.parse([...env.values.values()][0]);assert.equal(stored.fingerprint.length,64);});
test('different content/status gets another intent and an older success cannot erase it',async()=>{const env=fixture(),old=await supportReplyKey('ticket','Resposta antiga','open',env),current=await supportReplyKey('ticket','Resposta nova','resolved',env);assert.notEqual(current,old);clearSupportReplyKey('ticket',old,env);assert.equal(await supportReplyKey('ticket','Resposta nova','resolved',env),current);clearSupportReplyKey('ticket',current,env);assert.equal(env.values.size,0);assert.notEqual(await supportReplyKey('ticket','Resposta nova','resolved',env),current);});
test('unusable saved key is replaced; storage failure prevents an unsafe request intent',async()=>{const env=fixture();env.values.set('fc.supportReplyKey:ticket','broken');assert.match(await supportReplyKey('ticket','Resposta fictícia','open',env),/^[0-9a-f-]{36}$/);await assert.rejects(supportReplyKey('ticket','Resposta nova','open',{...env,storage:{getItem:()=>null,setItem(){throw new Error('Storage unavailable')}}}),/Storage unavailable/);});
