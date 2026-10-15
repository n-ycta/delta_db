import {privateDirectory} from './private-files.mjs';
import pg from 'pg';
import {readFile,writeFile,mkdir,rename,access} from 'node:fs/promises';
import {resolve} from 'node:path';
import {storageHandlers} from './storage.mjs';import {fileHandlers} from './file.mjs';import {copyVerified} from './migration.mjs';import {ManagedPostgres} from './managed-postgres.mjs';import {DeltaError} from './delta-sdk.mjs';import {message} from './messages.mjs';
export class BackendManager {
 constructor(dir,id,{managed=new ManagedPostgres(dir),openBackend}={}){this.dir=dir;this.id=id;this.managed=managed;this.openBackend=openBackend||this.open.bind(this);this.configFile=resolve(dir,'backend.json');this.backend=null;this.job={state:'starting'};this.active=0;this.changing=false;this.pending=null;}
 async init(){await privateDirectory(this.dir);try{this.config=JSON.parse(await readFile(this.configFile,'utf8'))}catch(e){if(e.code!=='ENOENT')throw e;let existing=false;try{await access(resolve(this.dir,'storage.json'));existing=true}catch{}this.config={engine:process.env.DATABASE_URL?'postgres':existing?'file':'postgres',databaseUrl:process.env.DATABASE_URL||''}}return this}
 async open(config){
  if(config.engine==='file'){const file=resolve(this.dir,'storage.json');return {engine:'file',file,handlers:await fileHandlers(file,this.id),close:async()=>{}}}
  if(config.engine!=='postgres')throw Object.assign(Error('engine'),{code:'engine'});
  let c=config;if(!c.databaseUrl)c={...c,...await this.managed.ensure()};
  if(!/^postgres(ql)?:\/\//.test(c.databaseUrl))throw Object.assign(Error('url'),{code:'url'});
  const pool=new pg.Pool({connectionString:c.databaseUrl,max:10,connectionTimeoutMillis:5000,statement_timeout:30000});
  try{
   // The managed container may still be initializing after docker run returns.
   let connected=false;for(let i=0;i<(c.managed?90:1);i++){try{await pool.query('SELECT 1');connected=true;break}catch{if(c.managed)await new Promise(r=>setTimeout(r,1000))}}
   if(!connected)throw Error('connection');
   if(c.managed)await pool.query('CREATE EXTENSION IF NOT EXISTS timescaledb');
   await pool.query(await readFile(new URL('../migrations/001_storage.sql',import.meta.url),'utf8'));
   if(c.managed)await pool.query("SELECT create_hypertable('delta_records','time',if_not_exists=>TRUE,migrate_data=>TRUE)");
   return {engine:'postgres',pool,handlers:storageHandlers(pool,this.id),close:()=>pool.end()};
  }catch(e){await pool.end();throw Object.assign(Error('connection'),{code:'connection'})}
 }
 error(e){return ['container_engine_required','file_capacity','url','engine','connection'].includes(e?.code)?e.code:'failed'}
 start(next=this.requested||this.config,{migrate=false}={}){
  if(this.pending)throw new DeltaError('conflict',message('busy'));
  this.requested=next;this.retryMigration=migrate||this.retryMigration;this.job={state:migrate?'migration':'setup',startedAt:Date.now()};
  this.pending=(async()=>{let candidate;try{
   candidate=await this.openBackend(next);this.changing=true;while(this.active)await new Promise(r=>setTimeout(r,10));
   let migration;
   if((migrate||this.retryMigration)&&this.backend){migration=await copyVerified(this.backend,candidate,resolve(this.dir,'backups'),phase=>{this.job={...this.job,phase}});if(candidate.engine==='file'){await candidate.close();candidate=await this.openBackend(next)}}
   await writeFile(this.configFile+'.tmp',JSON.stringify(next),{mode:0o600});await rename(this.configFile+'.tmp',this.configFile);
   const old=this.backend;this.backend=candidate;candidate=null;this.config=next;this.retryMigration=false;this.job={state:'ready',completedAt:Date.now(),...(migration?{migration}:{})};
   await old?.close().catch(()=>{});
  }catch(e){await candidate?.close().catch(()=>{});this.job={state:'error',error:this.error(e),completedAt:Date.now()};}finally{this.changing=false;this.pending=null}})();
  return {accepted:true,job:{...this.job},engine:this.config.engine};
 }
 async call(cap,args,caller){if(!this.backend||this.changing)throw new DeltaError('unavailable',message('unavailable',args?._locale));this.active++;try{return await this.backend.handlers[this.id+'.'+cap](args,caller)}finally{this.active--}}
 settings({values,_locale}={}){
  const fail=(code,key)=>{throw new DeltaError(code,message(key,_locale))};
  if(values===undefined)return this.publicSettings();if(this.pending)fail('conflict','busy');
  if(!['file','postgres'].includes(values?.engine))fail('bad_request','engine');
  const next={engine:values.engine,databaseUrl:typeof values.databaseUrl==='string'&&values.databaseUrl.trim()?values.databaseUrl.trim():this.config.databaseUrl||''};
  if(values.useManagedPostgres===true)next.databaseUrl='';
  if(next.engine==='postgres'&&next.databaseUrl&&!/^postgres(ql)?:\/\//.test(next.databaseUrl))fail('bad_request','url');
  const changed=next.engine!==this.config.engine||next.databaseUrl!==this.config.databaseUrl;
  if(changed&&this.backend&&values.confirmBackendChange!==true)fail('bad_request','confirm');
  if(!changed&&this.backend){this.requested=this.config;this.retryMigration=false;this.job={state:'ready'};return this.publicSettings()}
  return {...this.publicSettings(),...this.start(next,{migrate:changed&&!!this.backend})};
 }
 publicSettings(){return {engine:this.config.engine,databaseUrl:!!this.config.databaseUrl,useManagedPostgres:!this.config.databaseUrl}}
 status(){const state=this.job.state;const key=state==='error'?this.job.error:state;return {settings:this.publicSettings(),job:this.job,ready:!!this.backend&&!this.changing,notices:state==='ready'?[]:[{id:'storage.backend',severity:state==='error'?'warn':'info',message:message(key),localizations:{ru:message(key,'ru')},...(state==='error'?{actionId:this.job.error==='container_engine_required'?'prepare_runtime':'retry_backend'}:{})}]}}
 async close(){await this.pending;await this.backend?.close()}
}
