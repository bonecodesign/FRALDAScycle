import assert from 'node:assert/strict';
import test from 'node:test';
import {createRegistrationDraftService} from '../apps/api/registration-draft-service.js';

const key=Buffer.alloc(32,7).toString('base64url');
const base={fullName:'Maria da Silva',displayName:'Maria',contact:'maria@example.test',step:2,address:{postalCode:'30110-028',street:'Avenida Afonso Pena',number:'1000',complement:'Apto 10',noComplement:false,district:'Centro',city:'Belo Horizonte',state:'MG'}};

function memory(){let row=null;return{repository:{async create(input){row={id:'draft-1',encrypted_payload:input.encryptedPayload,encryption_iv:input.iv,authentication_tag:input.tag,expires_at:input.expiresAt};return row;},async find(){return row;},async update(input){row={...row,encrypted_payload:input.encryptedPayload,encryption_iv:input.iv,authentication_tag:input.tag};return row;},async remove(){row=null;return true;}},current:()=>row};}

test('registration draft is encrypted, resumable and fixed to 24 hours',async()=>{const store=memory(),now=Date.parse('2030-01-01T12:00:00Z'),service=createRegistrationDraftService(store.repository,{encryptionKey:key,clock:()=>now});const saved=await service.save({draft:base});assert.match(saved.resumeToken,/^[A-Za-z0-9_-]{43}$/);assert.equal(new Date(saved.expiresAt).getTime(),now+86_400_000);assert.doesNotMatch(store.current().encrypted_payload.toString('utf8'),/Maria|Afonso|example/);const resumed=await service.resume({resumeToken:saved.resumeToken});assert.deepEqual(resumed.draft,base);const updated=await service.save({resumeToken:saved.resumeToken,draft:{...base,step:1}});assert.equal(updated.resumeToken,saved.resumeToken);assert.equal(new Date(updated.expiresAt).getTime(),now+86_400_000);});

test('draft rejects secrets and unknown fields',async()=>{const service=createRegistrationDraftService(memory().repository,{encryptionKey:key});for(const field of ['cpf','birthDate','password','pilotInvitationToken'])await assert.rejects(service.save({draft:{...base,[field]:'secret'}}),error=>error.code==='invalid_registration_draft');});

