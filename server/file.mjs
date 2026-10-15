import {readFile,mkdir,writeFile,rename} from 'node:fs/promises';
import {dirname} from 'node:path';
import {Batch,Query,Document} from './schema.mjs';
import {DeltaError} from './delta-sdk.mjs';
const parse=(schema,a)=>{const r=schema.safeParse(a);if(!r.success)throw new DeltaError('bad_request','Invalid storage request');return r.data};
export function checkProducer(records,c){for(const r of records){if(c.scopes?.includes('admin'))continue;if(c.kind==='peer'){if(r.node!==c.peer_id)throw new DeltaError('forbidden','Peer record node must match authenticated node');}else if(r.source!==c.name)throw new DeltaError('forbidden','Record source must match producer token name');}}
export async function fileHandlers(file,id='storage'){
 let state={records:[],documents:{}};
 try{state=JSON.parse(await readFile(file,'utf8'));if(!Array.isArray(state.records)||!state.documents)throw Error('Invalid storage file');}catch(e){if(e.code!=='ENOENT')throw e;}
 await mkdir(dirname(file),{recursive:true,mode:0o700});
 let queue=Promise.resolve();
 const mutate=fn=>{const next=queue.then(async()=>{const draft=structuredClone(state),result=fn(draft);await writeFile(file+'.tmp',JSON.stringify(draft),{mode:0o600});await rename(file+'.tmp',file);state=draft;return result;});queue=next.catch(()=>{});return next;};
 const owner=c=>JSON.stringify([c.kind,c.peer_id||'',c.name]);
 const doc=(a,c)=>{const d=parse(Document,a);return {...d,id:JSON.stringify([owner(c),d.namespace,d.key])};};
 return {
 [`${id}.health`]:async()=>({status:'ok',contract:'1.0.0',engine:'file',records:state.records.length,capacity:100000}),
 [`${id}.write`]:async(a,c)=>{const {records}=parse(Batch,a);checkProducer(records,c);return mutate(s=>{const keys=new Set(s.records.map(r=>r.time+':'+r.id));let inserted=0;for(const r of records)if(!keys.has(r.time+':'+r.id)){s.records.push(r);keys.add(r.time+':'+r.id);inserted++;}if(s.records.length>100000)throw new DeltaError('conflict','File storage capacity reached; configure PostgreSQL');return {accepted:records.length,inserted};});},
 [`${id}.query`]:async a=>{const q=parse(Query,a),rows=state.records.filter(r=>r.source===q.source&&r.metric===q.metric&&r.time>=q.from&&r.time<q.to&&Object.entries(q.filters||{}).every(([k,v])=>v.includes(r.dimensions[k]))).sort((a,b)=>a.time-b.time||a.id.localeCompare(b.id));return {records:rows.slice(0,q.limit),truncated:rows.length>q.limit};},
 [`${id}.document_put`]:async(a,c)=>{const d=doc(a,c);if(!d.value)throw new DeltaError('bad_request','value required');if(Buffer.byteLength(JSON.stringify(d.value))>1048576)throw new DeltaError('bad_request','Document too large');return mutate(s=>{s.documents[d.id]={namespace:d.namespace,key:d.key,owner:owner(c),value:d.value};return d.value;});},
 [`${id}.document_get`]:async(a,c)=>state.documents[doc(a,c).id]?.value??null,
 [`${id}.document_list`]:async(a,c)=>{const d=doc({...a,key:'list'},c);return Object.values(state.documents).filter(v=>v.owner===owner(c)&&v.namespace===d.namespace).sort((a,b)=>a.key.localeCompare(b.key)).slice(0,1000).map(({key,value})=>({key,value}));},
 [`${id}.document_delete`]:async(a,c)=>{const d=doc(a,c);return mutate(s=>{delete s.documents[d.id];return {deleted:true};});}
 };
}
