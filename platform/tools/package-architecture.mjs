import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, relative, basename, extname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { PROJECT_ROOT, writeArchitectureSnapshot } from './architecture-network.mjs';
import { isMainModule } from '../packages/contracts/main-module.js';

export async function packageArchitecture({root=PROJECT_ROOT,output=resolve(root,'.release')}={}){
 const graph=await writeArchitectureSnapshot(root,resolve(root,'platform/apps/api/private/architecture-network.json'));await mkdir(output,{recursive:true});
 const files=[];
 async function walk(dir){for(const item of await readdir(dir,{withFileTypes:true})){if(['.git','node_modules','.release'].includes(item.name))continue;if(item.name.startsWith('.env')&&item.name!=='.env.example')continue;const full=resolve(dir,item.name),path=relative(root,full);if(item.isDirectory()){if(dir===root&&!['platform','assets','architecture','.github'].includes(item.name))continue;await walk(full);}else if(item.isFile()){if(dir===root&&!['.md','.js','.mjs','.css','.html','.yaml','.yml','.cmd'].includes(extname(item.name)))continue;files.push(path);}}}
 await walk(root);files.sort();
 const archive=resolve(output,'arquitetura-neural-fraldascycle.tar.gz');const packed=spawnSync('tar',['-czf',archive,'-C',root,'--',...files],{timeout:30000});if(packed.status!==0)throw new Error('Não foi possível preparar o pacote de implantação.');
 const manifest={name:'Arquitetura Neural do FraldasCycle',createdAt:new Date().toISOString(),archive:basename(archive),sha256:createHash('sha256').update(await readFile(archive)).digest('hex'),architectureRevision:graph.metadata.revision,sourceFiles:files.length,statistics:graph.stats,entrypoint:'/admin/architecture',deploymentReady:false,requirements:['Definir o servidor de destino e configurar a API/sessão administrativa.','Executar a suíte HTTP/CI em ambiente que permita portas locais.','Construir e implantar as imagens com o snapshot privado desta versão.']};
 await writeFile(resolve(output,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');return {archive,manifest};
}
if(isMainModule(import.meta.url)){const result=await packageArchitecture();console.log(JSON.stringify(result,null,2));}
