import {mkdir,chmod} from 'node:fs/promises';import {execFile} from 'node:child_process';import {promisify} from 'node:util';
const exec=promisify(execFile);
export async function privateDirectory(path){
 await mkdir(path,{recursive:true,mode:0o700});
 if(process.platform==='win32'){
  const {stdout}=await exec('whoami.exe',['/user','/fo','csv','/nh'],{windowsHide:true});const sid=stdout.match(/S-1-\d+(?:-\d+)+/)?.[0];if(!sid)throw Error('Cannot determine current Windows security identity');
  // Unlike POSIX chmod, Windows ACLs actually protect the stored database password.
  await exec('icacls.exe',[path,'/inheritance:r','/grant:r','*'+sid+':(OI)(CI)F','*S-1-5-18:(OI)(CI)F'],{windowsHide:true});
 }else await chmod(path,0o700);
}
