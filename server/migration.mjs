import {privateDirectory} from './private-files.mjs';
import {readFile,writeFile,mkdir,rename,chmod} from 'node:fs/promises';import {join} from 'node:path';import {createHash,randomUUID} from 'node:crypto';
const canonical=v=>v===null||typeof v!=='object'?JSON.stringify(v):Array.isArray(v)?'['+v.map(canonical).join(',')+']':'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';
export function canonicalOwner(owner){let a;try{a=JSON.parse(owner)}catch{const first=owner.indexOf(':'),second=owner.indexOf(':',first+1);if(first<0||second<0)throw Error('invalid_document_owner');a=[owner.slice(0,first),owner.slice(first+1,second),owner.slice(second+1)]}if(!Array.isArray(a)||a.length!==3||a.some(x=>typeof x!=='string'))throw Error('invalid_document_owner');return JSON.stringify(a)}
const pgOwner=owner=>JSON.parse(canonicalOwner(owner)).join(':');
export function normalized(s){return {records:[...s.records].sort((a,b)=>a.time-b.time||a.id.localeCompare(b.id)),documents:s.documents.map(d=>({namespace:d.namespace,key:d.key,owner:canonicalOwner(d.owner),value:d.value})).sort((a,b)=>canonical([a.namespace,a.key,a.owner]).localeCompare(canonical([b.namespace,b.key,b.owner])))}}
export function digest(snapshot){return createHash('sha256').update(canonical(normalized(snapshot))).digest('hex')}
export async function snapshot(backend){
 if(backend.engine==='file'){let s;try{s=JSON.parse(await readFile(backend.file,'utf8'))}catch(e){if(e.code!=='ENOENT')throw e;s={records:[],documents:{}}}return normalized({records:s.records,documents:Object.values(s.documents)})}
 const c=await backend.pool.connect();try{await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');const r=await c.query('SELECT id,round(extract(epoch FROM time)*1000)::double precision AS time,source,node,metric,value,dimensions,payload FROM delta_records ORDER BY time,id');const d=await c.query('SELECT namespace,key,owner,value FROM delta_documents ORDER BY namespace,key,owner');await c.query('COMMIT');return normalized({records:r.rows,documents:d.rows});}catch(e){await c.query('ROLLBACK').catch(()=>{});throw e}finally{c.release()}
}
async function backup(dir,name,data){await privateDirectory(dir);const id=Date.now()+'-'+randomUUID()+'-'+name+'.json';await writeFile(join(dir,id),JSON.stringify(data),{mode:0o600,flag:'wx'});return id}
const fileState=s=>({records:s.records,documents:Object.fromEntries(s.documents.map(d=>[JSON.stringify([canonicalOwner(d.owner),d.namespace,d.key]),{...d,owner:canonicalOwner(d.owner)}]))});
export async function copyVerified(source,target,backupDir,onProgress=()=>{}){
 onProgress('snapshot');const data=await snapshot(source),before=await snapshot(target),expected=digest(data);if(target.engine==='file'&&data.records.length>100000)throw Object.assign(Error('file_capacity'),{code:'file_capacity'});
 // Backups contain data, never connection URLs. Both source and prior destination survive.
 const sourceBackup=await backup(backupDir,'source',data),targetBackup=await backup(backupDir,'target',before);onProgress('copying');
 if(target.engine==='file'){
  const tmp=target.file+'.migration-'+randomUUID();try{await writeFile(tmp,JSON.stringify(fileState(data)),{mode:0o600,flag:'wx'});if(digest(await snapshot({engine:'file',file:tmp}))!==expected)throw Error('verification_failed');await rename(tmp,target.file)}catch(e){const{unlink}=await import('node:fs/promises');await unlink(tmp).catch(()=>{});throw e}
 }else{
  const c=await target.pool.connect();try{await c.query('BEGIN');await c.query('LOCK TABLE delta_records,delta_documents IN ACCESS EXCLUSIVE MODE');await c.query('DELETE FROM delta_records');await c.query('DELETE FROM delta_documents');for(const r of data.records)await c.query('INSERT INTO delta_records(time,id,source,node,metric,value,dimensions,payload) VALUES(to_timestamp($1/1000.0),$2,$3,$4,$5,$6,$7,$8)',[r.time,r.id,r.source,r.node,r.metric,r.value,JSON.stringify(r.dimensions),JSON.stringify(r.payload)]);for(const d of data.documents)await c.query('INSERT INTO delta_documents(namespace,key,owner,value) VALUES($1,$2,$3,$4)',[d.namespace,d.key,pgOwner(d.owner),JSON.stringify(d.value)]);
   onProgress('verifying');const r=await c.query('SELECT id,round(extract(epoch FROM time)*1000)::double precision AS time,source,node,metric,value,dimensions,payload FROM delta_records');const d=await c.query('SELECT namespace,key,owner,value FROM delta_documents');if(digest({records:r.rows,documents:d.rows})!==expected)throw Error('verification_failed');await c.query('COMMIT');
  }catch(e){await c.query('ROLLBACK').catch(()=>{});throw e}finally{c.release()}
 }
 onProgress('verified');return {records:data.records.length,documents:data.documents.length,sha256:expected,sourceBackup,targetBackup};
}
