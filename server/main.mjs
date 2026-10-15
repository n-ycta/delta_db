import {readFile} from 'node:fs/promises';import {resolve} from 'node:path';import {DeltaClient,DeltaError,servePlugin} from './delta-sdk.mjs';import {BackendManager} from './backend.mjs';import {prepareRuntime} from './runtime-setup.mjs';import {message} from './messages.mjs';
const manifest=JSON.parse(await readFile(new URL('../manifest.json',import.meta.url),'utf8'));manifest.id=process.env.STORAGE_COMPONENT||'storage';const manager=await new BackendManager(resolve(process.env.DATA_DIR||process.env.DELTA_DATA||'data'),manifest.id).init();
const handlers={};let lastWriteAt=0;const activity=[];
for(const cap of manifest.capabilities.filter(c=>!['settings','status','retry_backend','prepare_runtime'].includes(c.name)))handlers[manifest.id+'.'+cap.name]=async(a,c)=>{const result=await manager.call(cap.name,a,c);if(cap.name==='write'){lastWriteAt=Date.now();activity.push({t:lastWriteAt,n:result.inserted??result.accepted??0});while(activity[0]?.t<Date.now()-60000)activity.shift()}return result};
handlers[manifest.id+'.status']=async()=>({...manager.status(),activity:{eventsPerMin:activity.filter(x=>x.t>=Date.now()-60000).reduce((s,x)=>s+x.n,0),lastSyncAt:lastWriteAt||undefined,rateLabel:{ru:'записей/мин',en:'records/min'}}});
handlers[manifest.id+'.settings']=a=>manager.settings(a);
handlers[manifest.id+'.retry_backend']=async()=>manager.start();
let setupChild;
handlers[manifest.id+'.prepare_runtime']=async({_locale}={})=>{if(setupChild)throw new DeltaError('conflict',message('busy',_locale));const r=prepareRuntime(_locale);setupChild=r.started;setupChild.on('error',()=>{manager.job={state:'error',error:'unsupported'};setupChild=null});setupChild.on('exit',code=>{setupChild=null;if(code===0&&!manager.pending)manager.start();else if(code!==0)manager.job={state:'error',error:'unsupported'}});return {accepted:true,message:message('runtime',_locale)}};
const controller=new AbortController();for(const s of ['SIGINT','SIGTERM'])process.on(s,()=>controller.abort());
// Register before pulling images: the package readiness deadline must never wait for database provisioning.
manager.start();await servePlugin(new DeltaClient(),manifest,handlers,{signal:controller.signal});await manager.close();
