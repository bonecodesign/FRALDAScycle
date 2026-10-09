import { relative, resolve } from 'node:path';
export function isPrivateArchitectureFile(root,file){
 const path=relative(resolve(root),resolve(file)).replaceAll('\\','/');
 return path==='architecture/viewer'||path.startsWith('architecture/viewer/')||path==='platform'||path.startsWith('platform/');
}
export function redirectToAdmin(response){
 const origin=process.env.ADMIN_PANEL_ORIGIN||'http://127.0.0.1:4103';
 response.writeHead(302,{location:new URL('/admin/architecture',origin).href,'cache-control':'no-store'});response.end();
}
