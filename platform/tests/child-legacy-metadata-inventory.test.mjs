import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

const scriptPath = new URL('../infra/supabase/child-legacy-metadata-readonly.sql', import.meta.url);

test('historical child-data inventory is read-only and returns only aggregate counts', async () => {
  const sql = await readFile(scriptPath, 'utf8');
  const source = sql.replace(/^--[^\n]*$/gm, '').trim();
  assert.match(source, /^BEGIN TRANSACTION READ ONLY;/i);
  assert.match(source, /\bCOMMIT;\s*$/i);
  assert.doesNotMatch(source, /\b(?:INSERT|UPDATE|DELETE|TRUNCATE|ALTER|DROP|CREATE|GRANT|REVOKE|COPY|CALL|EXECUTE|DO)\b/i);
  assert.doesNotMatch(source, /\bSELECT\s+\*/i);
  assert.match(source, /\bFROM\s+audit_events\b/i);
  assert.match(source, /\bFROM\s+notification_outbox\b/i);
  assert.match(source, /\bFROM\s+account_notices\b/i);
  assert.match(source, /\bSELECT\s+source\s*,\s*records_examined\s*,\s*records_needing_review\s*,\s*limitation\s+FROM\s+inventory\b/i);
  assert.match(source, /\bcount\s*\(\s*\*\s*\)/i);
  assert.match(source, /\brecords_needing_review\b/i);
});
