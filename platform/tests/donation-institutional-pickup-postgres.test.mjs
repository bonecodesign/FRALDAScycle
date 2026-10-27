import test from 'node:test';
import {createDatabase} from '../database/client.js';
import {discoverMigrations,migrate} from '../database/migrate.js';
import {validateSyntheticDonation} from '../tools/beta-donation-check.mjs';

const databaseUrl=process.env.FC_LISTING_TEST_DATABASE_URL;

test('PostgreSQL enforces institutional pickup as the only donation logistics mode',{
  skip:!databaseUrl?'Banco temporário de validação não configurado.':false,
  timeout:60000,
},async()=>{
  const url=new URL(databaseUrl);
  if(!['localhost','127.0.0.1'].includes(url.hostname))throw new Error('O teste aceita somente PostgreSQL local descartável.');
  const database=createDatabase({databaseUrl,databaseSsl:false});
  const donor='10000000-0000-4000-8000-000000000001';
  const representative='10000000-0000-4000-8000-000000000002';
  try{
    await migrate(database,await discoverMigrations());
    await database.query(`INSERT INTO users(id,email,password_hash,display_name,role,email_verified_at,adult_declared_at,adult_declaration_version) VALUES
      ($1,'donor-pickup@example.test','fixture','Doador fictício','customer',now(),now(),'FC-AGE-1'),
      ($2,'representative-pickup@example.test','fixture','Representante fictício','customer',now(),now(),'FC-AGE-1'),
      ('10000000-0000-4000-8000-000000000003','admin-pickup@example.test','fixture','Admin fictício','admin',now(),now(),'FC-AGE-1'),
      ('10000000-0000-4000-8000-000000000004','courier-pickup@example.test','fixture','Entregador fictício','courier',now(),now(),'FC-AGE-1')`,[donor,representative]);
    await validateSyntheticDonation(database,{user:donor,other:representative});
  }finally{await database.close();}
});
