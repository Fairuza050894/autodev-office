import { readFile } from 'node:fs/promises';
import { pool } from './store.js';
const client=await pool.connect();
try {await client.query('BEGIN');await client.query('SELECT pg_advisory_xact_lock(42026)');await client.query(await readFile(new URL('../migrations/001_office.sql',import.meta.url),'utf8'));await client.query("INSERT INTO schema_migrations(version) VALUES('001_office') ON CONFLICT DO NOTHING");await client.query('COMMIT');}catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();await pool.end();}
