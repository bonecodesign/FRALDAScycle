import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {createInstitutionAccessService} from '../apps/api/institution-access-service.js';

const institutionId='22222222-2222-4222-8222-222222222222';
const actor={id:'11111111-1111-4111-8111-111111111111',role:'user'};

function repository(){
 const calls=[];
 return {calls,capacity:async input=>({institution_id:input.institutionId,accepting_donations:true,version:1}),changeCapacity:async input=>{calls.push(input);return {...input,version:input.expectedVersion+1};}};
}

test('verified representative can explicitly pause or resume institutional donation capacity',async()=>{
 const store=repository(),service=createInstitutionAccessService(store);
 const current=await service.capacity(actor,institutionId);
 assert.equal(current.accepting_donations,true);
 const paused=await service.changeCapacity(actor,institutionId,{acceptingDonations:false,expectedVersion:1,reason:'Armazenamento temporariamente indisponível.',confirmed:true});
 assert.equal(paused.acceptingDonations,false);
 assert.deepEqual(store.calls[0],{actorId:actor.id,institutionId,acceptingDonations:false,expectedVersion:1,reason:'Armazenamento temporariamente indisponível.'});
});

test('capacity change requires boolean availability, current version, reason and confirmation',async()=>{
 const service=createInstitutionAccessService(repository());
 for(const input of [
  {acceptingDonations:false,expectedVersion:1,reason:'Motivo suficientemente claro.',confirmed:false},
  {acceptingDonations:'false',expectedVersion:1,reason:'Motivo suficientemente claro.',confirmed:true},
  {acceptingDonations:false,expectedVersion:0,reason:'Motivo suficientemente claro.',confirmed:true},
  {acceptingDonations:false,expectedVersion:1,reason:'curto',confirmed:true},
 ])assert.throws(()=>service.changeCapacity(actor,institutionId,input),error=>error.code==='invalid_institution_capacity'&&error.status===422);
});

test('capacity migration and repositories preserve existing operations while blocking new donations',async()=>{
 const [migration,access,publication,donations]=await Promise.all([
  readFile(new URL('../database/migrations/050_institution_donation_capacity.sql',import.meta.url),'utf8'),
  readFile(new URL('../database/institution-access-repository.js',import.meta.url),'utf8'),
  readFile(new URL('../database/institution-publication.js',import.meta.url),'utf8'),
  readFile(new URL('../database/donation-repository.js',import.meta.url),'utf8'),
 ]);
 assert.match(migration,/accepting_donations boolean NOT NULL DEFAULT true/);
 assert.match(migration,/UNIQUE \(institution_id, version\)/);
 assert.match(access,/status='published'[\s\S]*NOT EXISTS\(SELECT 1 FROM transactions/);
 assert.match(access,/institution\.capacity\.changed/);
 assert.match(publication,/accepting_donations/);
 assert.match(donations,/capacityRequired:true/);
 assert.match(donations,/donation_institution_capacity_paused/);
});
