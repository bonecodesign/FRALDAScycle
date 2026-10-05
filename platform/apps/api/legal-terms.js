import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

export async function loadLegalTerms() {
  const sources = ['politicas-privacidade-cookies-termos-pre-operacionais.md',
    'politicas-operacionais-instituicoes-pre-operacionais.md'];
  const documents = await Promise.all(sources.map(async name => ({ name,
    content: await readFile(new URL('../../docs/legal/' + name, import.meta.url), 'utf8'),
  })));
  const contentHash = createHash('sha256').update(JSON.stringify(documents)).digest('hex');
  // Activation requires a separately reviewed and approved change.
  return { version: 'FC-PREOP-1.0', status: 'draft', contentHash, documents };
}
