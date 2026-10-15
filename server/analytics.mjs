import {z} from 'zod';
import {Query} from './schema.mjs';
export const AggregateQuery=Query.and(z.object({groupBy:z.array(z.string().min(1).max(64)).max(6).default([]),aggregation:z.enum(['sum','avg','min','max','count','last','weighted_avg']).default('sum'),weightField:z.string().min(1).max(64).optional(),bucketMs:z.number().int().min(1000).optional()}));
export const DeleteQuery=Query;
export const matches=(r,q)=>r.source===q.source&&r.metric===q.metric&&r.time>=q.from&&r.time<q.to&&Object.entries(q.filters||{}).every(([k,v])=>!v.length||v.includes(r.dimensions[k]));
export function aggregateRows(records,q){
 const groups=new Map();for(const r of records.filter(r=>matches(r,q))){const dims=Object.fromEntries(q.groupBy.map(k=>[k,r.dimensions[k]??'unknown'])),time=q.bucketMs?Math.floor(r.time/q.bucketMs)*q.bucketMs:0,key=JSON.stringify([dims,time]);let g=groups.get(key);if(!g){g={dimensions:dims,time,values:[],weight:0,weighted:0,last:-1,lastValue:null};groups.set(key,g)}if(Number.isFinite(r.value)){g.values.push(r.value);const w=r.payload?.[q.weightField];if(Number.isFinite(w)&&w>0){g.weight+=w;g.weighted+=r.value*w}if(r.time>=g.last){g.last=r.time;g.lastValue=r.value}}}
 const rows=[...groups.values()].map(g=>({dimensions:g.dimensions,time:g.time,value:!g.values.length?null:q.aggregation==='weighted_avg'?g.weight?g.weighted/g.weight:null:q.aggregation==='count'?g.values.length:q.aggregation==='avg'?g.values.reduce((a,b)=>a+b,0)/g.values.length:q.aggregation==='last'?g.lastValue:q.aggregation==='min'?Math.min(...g.values):q.aggregation==='max'?Math.max(...g.values):g.values.reduce((a,b)=>a+b,0)})).sort((a,b)=>(b.value??-Infinity)-(a.value??-Infinity)||JSON.stringify(a.dimensions).localeCompare(JSON.stringify(b.dimensions))||a.time-b.time);
 return {rows:rows.slice(0,q.limit),truncated:rows.length>q.limit};
}
export function sqlWhere(q,params=[]){params.push(q.source,q.metric,q.from,q.to);let where=`source=$1 AND metric=$2 AND time>=to_timestamp($3/1000.0) AND time<to_timestamp($4/1000.0)`;for(const [k,v]of Object.entries(q.filters||{})){if(!v.length)continue;params.push(k,v);where+=` AND dimensions->>$${params.length-1}=ANY($${params.length}::text[])`}return where;}
export async function aggregateSql(pool,q){
 const params=[],where=sqlWhere(q,params),bind=v=>{params.push(v);return '$'+params.length},fields=q.groupBy.map((k,i)=>`dimensions->>${bind(k)} AS g${i}`),groups=q.groupBy.map((_,i)=>'g'+i);
 const bucket=q.bucketMs?`floor(extract(epoch FROM time)*1000/${bind(q.bucketMs)})*${'$'+params.length}`:'0';
 let fn={sum:'sum(value)',avg:'avg(value)',count:'count(value)',min:'min(value)',max:'max(value)',last:'(array_agg(value ORDER BY time DESC,id DESC) FILTER (WHERE value IS NOT NULL))[1]'}[q.aggregation];
 if(q.aggregation==='weighted_avg'){const p=bind(q.weightField||'weight');const w=`(CASE WHEN jsonb_typeof(payload->${p})='number' THEN greatest((payload->>${p})::double precision,0) ELSE 0 END)`;fn=`sum(value*${w})/nullif(sum(CASE WHEN value IS NOT NULL THEN ${w} ELSE 0 END),0)`}
 const limit=bind(q.limit+1);const sql=`SELECT ${fields.length?fields.join(',')+',':''}${bucket} AS bucket,${fn} AS value FROM delta_records WHERE ${where}${groups.length||q.bucketMs?' GROUP BY '+[...groups,...(q.bucketMs?['bucket']:[])].join(','):''} ORDER BY value DESC NULLS LAST${groups.length?','+groups.join(','):''},bucket LIMIT ${limit}`;
 const {rows}=await pool.query(sql,params);return {rows:rows.slice(0,q.limit).map(r=>({dimensions:Object.fromEntries(q.groupBy.map((k,i)=>[k,r['g'+i]??'unknown'])),time:Number(r.bucket),value:r.value===null?null:Number(r.value)})),truncated:rows.length>q.limit};
}
