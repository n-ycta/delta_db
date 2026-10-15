import {privateDirectory} from './private-files.mjs';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readFile,writeFile,mkdir,chmod} from 'node:fs/promises';
import {createHash,randomBytes} from 'node:crypto';
import {resolve,join} from 'node:path';
export const IMAGE='timescale/timescaledb:2.24.0-pg16@sha256:5db0a2eb9cde672e5ea90336f72d220c016cc5046c61d88d284e7f0aa47ef7db';
const exec=promisify(execFile);
const run=async(cmd,args,opts={})=>(await exec(cmd,args,{timeout:180000,maxBuffer:1048576,...opts})).stdout.trim();
export class ManagedError extends Error {constructor(code){super(code);this.code=code}}
export class ManagedPostgres {
 constructor(dir,{execute=run}={}){this.dir=resolve(dir,'postgres');this.execute=execute;const id=createHash('sha256').update(resolve(dir)).digest('hex').slice(0,16);this.name='delta-db-'+id;this.volume=this.name+'-data';this.state={state:'idle'};}
 async engine(){let saved;try{saved=JSON.parse(await readFile(join(this.dir,'runtime.json'),'utf8')).engine}catch(e){if(e.code!=='ENOENT')throw e}if(saved){if(!['podman','docker'].includes(saved))throw new ManagedError('managed_container_conflict');try{await this.execute(saved,['info','--format','json'],{timeout:10000});return saved}catch{throw new ManagedError('container_engine_required')}}for(const engine of ['podman','docker'])try{await this.execute(engine,['info','--format','json'],{timeout:10000});return engine}catch{}throw new ManagedError('container_engine_required')}
 async ensure(){
  this.state={state:'starting'};await privateDirectory(this.dir);const engine=await this.engine();await writeFile(join(this.dir,'runtime.json'),JSON.stringify({engine}),{mode:0o600});
  const credential=join(this.dir,'credentials.json');let auth;
  try{auth=JSON.parse(await readFile(credential,'utf8'))}catch(e){if(e.code!=='ENOENT')throw e;auth={password:randomBytes(32).toString('hex')};await writeFile(credential,JSON.stringify(auth),{mode:0o600,flag:'wx'})}
  if(!/^[a-f0-9]{64}$/.test(auth.password))throw new ManagedError('managed_credentials_invalid');await chmod(credential,0o600);
  // Only fixed names and a private env file enter container arguments; no database secrets in argv/logs.
  const envFile=join(this.dir,'container.env');await writeFile(envFile,'POSTGRES_USER=delta\nPOSTGRES_DB=delta\nPOSTGRES_PASSWORD='+auth.password+'\n',{mode:0o600});await chmod(envFile,0o600);
  let inspect;try{inspect=JSON.parse(await this.execute(engine,['inspect',this.name]))[0]}catch{}
  if(inspect){if(inspect.Config?.Labels?.['dev.delta.storage']!==this.name||!inspect.Mounts?.some(m=>m.Name===this.volume&&m.Destination==='/var/lib/postgresql/data'))throw new ManagedError('managed_container_conflict');await this.execute(engine,['start',this.name]);}
  else{
   let volume;try{volume=JSON.parse(await this.execute(engine,['volume','inspect',this.volume]))[0]}catch{}if(volume&&volume.Labels?.['dev.delta.storage']!==this.name)throw new ManagedError('managed_container_conflict');if(!volume)await this.execute(engine,['volume','create','--label','dev.delta.storage='+this.name,this.volume]);
   this.state={state:'pulling'};await this.execute(engine,['pull',IMAGE],{timeout:600000});
   await this.execute(engine,['run','-d','--name',this.name,'--label','dev.delta.storage='+this.name,'--restart','unless-stopped','-p','127.0.0.1::5432','--env-file',envFile,'-v',this.volume+':/var/lib/postgresql/data',IMAGE],{timeout:120000});
  }
  const ports=JSON.parse(await this.execute(engine,['inspect',this.name]))[0]?.NetworkSettings?.Ports?.['5432/tcp'];
  if(!ports?.length||ports.some(p=>p.HostIp!=='127.0.0.1')||!/^\d+$/.test(ports[0].HostPort))throw new ManagedError('unsafe_database_binding');
  this.state={state:'waiting',engine};return {databaseUrl:'postgres://delta:'+auth.password+'@127.0.0.1:'+ports[0].HostPort+'/delta',managed:true};
 }
}
