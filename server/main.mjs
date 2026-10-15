import pg from 'pg'; import {readFile} from 'node:fs/promises'; import {DeltaClient,servePlugin} from './delta-sdk.mjs'; import {storageHandlers} from './storage.mjs';
if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL is required');
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL,max:10,connectionTimeoutMillis:5000,statement_timeout:10000});
await pool.query(await readFile(new URL('../migrations/001_storage.sql',import.meta.url),'utf8'));
const manifest=JSON.parse(await readFile(new URL('../manifest.json',import.meta.url),'utf8')); manifest.id=process.env.STORAGE_COMPONENT||'storage';
const controller=new AbortController();for(const s of ['SIGINT','SIGTERM'])process.on(s,()=>controller.abort());
await servePlugin(new DeltaClient(),manifest,storageHandlers(pool,manifest.id),{signal:controller.signal});await pool.end();
