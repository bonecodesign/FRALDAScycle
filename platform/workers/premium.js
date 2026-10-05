// Execução local deliberada: não instala serviços, não agenda cobrança ou envia avisos.
import { createDatabase } from '../database/client.js';
import { createPremiumRepository } from '../database/premium-repository.js';
if (process.argv[2] !== '--once') throw new Error('Use --once para aplicar o limite local; não existe daemon de cobrança.');
let url;
try { url = new URL(process.env.DATABASE_URL || 'invalid:'); }
catch { throw new Error('Informe uma conexão PostgreSQL local válida.'); }
if (!['127.0.0.1','localhost','[::1]'].includes(url.hostname) || !['postgres:','postgresql:'].includes(url.protocol)) throw new Error('Esta rotina beta aceita somente PostgreSQL local.');
const database = createDatabase({ databaseUrl: url.toString(), databaseSsl: false });
try { console.log(JSON.stringify(await createPremiumRepository(database).regularizeExpired())); }
finally { await database.close(); }
