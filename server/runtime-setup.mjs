import {execFile} from 'node:child_process';import {message} from './messages.mjs';import {DeltaError} from './delta-sdk.mjs';
// Fixed script, no caller-supplied shell content. Runs only after a separately confirmed plugin action.
// Installs a rootless runtime from the OS vendor's configured signed repositories, never grants docker-group/root access.
export const LINUX_SETUP=`set -eu
[ -n "\${PKEXEC_UID:-}" ] && [ "$PKEXEC_UID" -gt 0 ] || exit 1
. /etc/os-release
case "$ID" in
 arch|omarchy|manjaro|endeavouros) /usr/bin/pacman -S --needed --noconfirm podman slirp4netns fuse-overlayfs python ;;
 debian|ubuntu|linuxmint|pop) /usr/bin/apt-get update; /usr/bin/apt-get install -y podman uidmap slirp4netns fuse-overlayfs python3 ;;
 fedora|rhel|centos|rocky|almalinux) /usr/bin/dnf install -y podman shadow-utils slirp4netns fuse-overlayfs python3 ;;
 *) exit 3 ;;
esac
/usr/bin/python3 - <<'PYROOT'
import os,pwd,subprocess,fcntl
lock=open('/run/delta-subids.lock','a'); fcntl.flock(lock,fcntl.LOCK_EX)
uid=int(os.environ['PKEXEC_UID']); user=pwd.getpwuid(uid).pw_name
for path,flag in [('/etc/subuid','--add-subuids'),('/etc/subgid','--add-subgids')]:
    try: lines=open(path).read().splitlines()
    except FileNotFoundError: lines=[]
    entries=[line.split(':') for line in lines if line and not line.startswith('#')]
    if any(e[0] in (user,str(uid)) and int(e[2])>=65536 for e in entries): continue
    ranges=sorted((int(e[1]),int(e[1])+int(e[2])) for e in entries)
    begin=100000
    for low,high in ranges:
        if begin+65536<=low: break
        if begin<high: begin=high
    if begin+65536>=2147483647: raise SystemExit('No subordinate ID range available')
    command='/usr/sbin/usermod' if os.path.exists('/usr/sbin/usermod') else '/usr/bin/usermod'
    subprocess.run([command,flag,str(begin)+'-'+str(begin+65535),user],check=True)
PYROOT
`;
export function prepareRuntime(locale){
 if(process.platform==='linux'){
  // Return promptly: the UI action must not timeout while an OS package manager is working.
  const child=execFile('pkexec',['/bin/sh','-c',LINUX_SETUP],{timeout:600000,maxBuffer:1048576});
  return {started:child};
 }
 throw new DeltaError('unavailable',message('unsupported',locale));
}
