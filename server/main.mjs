import pg from 'pg'; import {readFile} from 'node:fs/promises'; import {DeltaClient,servePlugin} from './delta-sdk.mjs'; import {storageHandlers} from './storage.mjs';
import {fileHandlers} from './file.mjs';import {resolve} from 'node:path';
const databaseUrl=process.env.DATABASE_URL;
const pool=databaseUrl?new pg.Pool({connectionString:databaseUrl,max:10,connectionTimeoutMillis:5000,statement_timeout:10000}):null;
if(pool)await pool.query(await readFile(new URL('../migrations/001_storage.sql',import.meta.url),'utf8'));
const manifest=JSON.parse(await readFile(new URL('../manifest.json',import.meta.url),'utf8')); manifest.id=process.env.STORAGE_COMPONENT||'storage';
const controller=new AbortController();for(const s of ['SIGINT','SIGTERM'])process.on(s,()=>controller.abort());
await servePlugin(new DeltaClient(),manifest,pool?storageHandlers(pool,manifest.id):await fileHandlers(resolve(process.env.DATA_DIR||'data','storage.json'),manifest.id),{signal:controller.signal});if(pool)await pool.end();
