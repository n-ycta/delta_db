import {Batch,Query,Document} from './schema.mjs';
import {DeltaError} from './delta-sdk.mjs';
const validated=(schema,args)=>{const r=schema.safeParse(args);if(!r.success)throw new DeltaError('bad_request',r.error.issues.map(i=>`${i.path.join('.')}: ${i.message}`).join('; '));return r.data};
export function storageHandlers(pool,id='storage') {
 const owner=c=>`${c.kind}:${c.peer_id || ''}:${c.name}`;
 const doc=(args,c)=>({...validated(Document,args),owner:owner(c)});
 return {
  [`${id}.health`]: async()=>{await pool.query('SELECT 1'); return {status:'ok',contract:'1.0.0',engine:'PostgreSQL/TimescaleDB'}},
  [`${id}.write`]:async(args,caller)=>{
   const {records}=validated(Batch,args);const client=await pool.connect();let inserted=0;
   try {await client.query('BEGIN');for(const r of records){
    // Bind a write credential to its producer name unless it has explicit admin authority.
    if (!caller.scopes?.includes('admin') && r.source!==caller.name) throw new DeltaError('forbidden','Record source must equal producer token name');
    const result=await client.query(`INSERT INTO delta_records(time,id,source,node,metric,value,dimensions,payload) VALUES(to_timestamp($1/1000.0),$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(time,id) DO NOTHING`,[r.time,r.id,r.source,r.node,r.metric,r.value,JSON.stringify(r.dimensions),JSON.stringify(r.payload)]);inserted+=result.rowCount;
   }await client.query('COMMIT');return {accepted:records.length,inserted};}catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}
  },
  [`${id}.query`]:async args=>{
   const q=validated(Query,args),params=[q.source,q.metric,q.from,q.to];let where='source=$1 AND metric=$2 AND time>=to_timestamp($3/1000.0) AND time<to_timestamp($4/1000.0)';
   for(const [key,values] of Object.entries(q.filters||{})){params.push(key,values);where+=` AND dimensions->>$${params.length-1}=ANY($${params.length}::text[])`}
   params.push(q.limit+1);const {rows}=await pool.query(`SELECT id,(extract(epoch FROM time)*1000)::double precision AS time,source,node,metric,value,dimensions,payload FROM delta_records WHERE ${where} ORDER BY time,id LIMIT $${params.length}`,params);
   return {records:rows.slice(0,q.limit),truncated:rows.length>q.limit};
  },
  [`${id}.document_put`]:async(args,c)=>{const d=doc(args,c);if(!d.value)throw new DeltaError('bad_request','value required');await pool.query('INSERT INTO delta_documents(namespace,key,owner,value) VALUES($1,$2,$3,$4) ON CONFLICT(namespace,key,owner) DO UPDATE SET value=EXCLUDED.value,updated_at=now()',[d.namespace,d.key,d.owner,JSON.stringify(d.value)]);return d.value},
  [`${id}.document_get`]:async(args,c)=>{const d=doc(args,c);const {rows}=await pool.query('SELECT value FROM delta_documents WHERE namespace=$1 AND key=$2 AND owner=$3',[d.namespace,d.key,d.owner]);return rows[0]?.value??null},
  [`${id}.document_list`]:async(args,c)=>{const d=doc({...args,key:'list'},c);const {rows}=await pool.query('SELECT key,value FROM delta_documents WHERE namespace=$1 AND owner=$2 ORDER BY key LIMIT 1000',[d.namespace,d.owner]);return rows},
  [`${id}.document_delete`]:async(args,c)=>{const d=doc(args,c);await pool.query('DELETE FROM delta_documents WHERE namespace=$1 AND key=$2 AND owner=$3',[d.namespace,d.key,d.owner]);return {deleted:true}},
 };
}
