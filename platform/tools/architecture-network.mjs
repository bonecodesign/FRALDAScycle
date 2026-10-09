import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, relative, dirname, extname, basename } from 'node:path';
import { createHash } from 'node:crypto';
import { isMainModule } from '../packages/contracts/main-module.js';

export const PROJECT_ROOT = resolve(import.meta.dirname, '../..');
export const SNAPSHOT_PATH = resolve(import.meta.dirname, '../apps/api/private/architecture-network.json');
const AREAS = [
 ['surfaces','Experiências','#75cdb8','Site, app/PWA e operação administrativa.'],
 ['market','Marketplace e impacto','#d6bd78','Anúncios, catálogo, doações e instituições.'],
 ['finance','Financeiro','#e19d83','Pagamentos, regras comerciais, premium e liquidação.'],
 ['logistics','Logística','#87b7e4','Entregas, endereços e confirmação de recebimento.'],
 ['trust','Identidade e confiança','#b2a0e0','Autenticação, autorização, consentimento, privacidade e moderação.'],
 ['messages','Comunicação','#e1abc7','Chat, eventos em tempo real, notificações e workers.'],
 ['foundation','API e fundação','#8bc7d2','Servidor HTTP, runtime, contratos e design system.'],
 ['data','Persistência','#9fbe8d','PostgreSQL, repositórios, migrações e recuperação.'],
 ['delivery','Infraestrutura e qualidade','#9db0cb','Containers, testes, auditoria, ferramentas e observação.'],
 ['governance','Governança e produto','#d1b497','Documentação, requisitos, prontidão, piloto e titularidade.'],
];
const LABELS = {marketplace:'Marketplace',donation:'Doações',institution:'Instituições','institution-access':'Acesso institucional',payment:'Pagamentos',premium:'Premium',logistics:'Entregas','address-change':'Alteração de endereço',address:'Endereços',auth:'Autenticação',authorization:'Permissões',session:'Sessões',security:'Segurança',cookies:'Cookies de sessão','account-consent':'Consentimentos','privacy-request':'Privacidade',moderation:'Moderação','review-moderation':'Reputação e avaliações',communications:'Chat e suporte',realtime:'Tempo real',notifications:'Notificações','content-guard':'Validação de conteúdo','rate-limit':'Limitação de requisições','webhook-signature':'Assinaturas de webhook',secrets:'Configuração protegida'};
function classify(path) {
 const stem=basename(path,extname(path));
 if(path.startsWith('platform/apps/')&&!path.startsWith('platform/apps/api/')){const surface=path.split('/')[2];return ['surfaces',surface,{site:'Site público',app:'App / PWA',admin:'Administração'}[surface]];}
 if(path.startsWith('platform/database/'))return ['data',path.includes('/migrations/')?'migrations':stem.includes('repository')?'repositories':'database',path.includes('/migrations/')?'Migrações':stem.includes('repository')?'Repositórios':'PostgreSQL e recuperação'];
 if(path.startsWith('platform/tests/'))return ['delivery','tests','Testes automatizados'];
 if(path.startsWith('platform/tools/'))return ['delivery','tools','Verificações e ferramentas'];
 if(path.startsWith('platform/docs/'))return ['governance','docs','Documentação técnica e produto'];
 if(path.startsWith('platform/workers/'))return ['messages','workers','Workers assíncronos'];
 if(path.startsWith('platform/packages/ui/'))return ['foundation','ui','Design system compartilhado'];
 if(path.startsWith('platform/packages/contracts/')){
  if(['commercial-rules','settlement-readiness','premium-rules'].includes(stem))return ['finance','rules','Regras financeiras'];
  if(stem==='institution-receipt-readiness')return ['logistics','receipt','Confirmação de recebimento'];
  if(stem==='diaper-catalog')return ['market','catalog','Catálogo de fraldas'];
  return ['foundation','contracts','Contratos compartilhados'];
 }
 if(path.startsWith('platform/apps/api/')){
  const base=stem.replace(/-(service|handler|provider|providers)$/,'');
  for(const [area,keys] of [['market',['marketplace','donation','institution','institution-access']],['finance',['payment','premium']],['logistics',['logistics','address-change','address']],['trust',['auth','authorization','session','security','cookies','account-consent','privacy-request','moderation','review-moderation','content-guard','rate-limit','webhook-signature','secrets']],['messages',['communications','realtime','notifications']]])if(keys.includes(base))return [area,base,LABELS[base]||base];
  return ['foundation','api','API HTTP e runtime'];
 }
 if(path.startsWith('platform/config/'))return ['delivery','config','Configuração e prontidão'];
 if(path.endsWith('.md')||path.startsWith('architecture/'))return ['governance','records','Registros e arquitetura'];
 if(basename(path).startsWith('Dockerfile')||/\.ya?ml$/.test(path))return ['delivery','containers','Containers e entrega'];
 return ['surfaces','prototype','Protótipo e laboratórios'];
}
export async function buildArchitectureGraph(root=PROJECT_ROOT) {
 const files=[];const contents=new Map();
 async function scan(directory){for(const entry of await readdir(directory,{withFileTypes:true})){if(['node_modules','.git','.openai','viewer','assets','private'].includes(entry.name))continue;const absolute=resolve(directory,entry.name),path=relative(root,absolute).replaceAll('\\','/');if(entry.isDirectory()){if(!path.includes('/')&&!['platform','architecture','.github'].includes(path))continue;await scan(absolute);}else if(entry.isFile()&&entry.name!=='package-lock.json'&&( /\.(?:js|mjs|html|css|md|sql|json|yaml|yml)$/.test(entry.name)||entry.name.startsWith('Dockerfile'))){files.push(path);contents.set(path,await readFile(absolute,'utf8'));}}}
 await scan(root);files.sort();const hash=createHash('sha256');for(const path of files)hash.update(path+'\0'+contents.get(path)+'\0');
 const nodes=[{id:'root',label:'FraldaCycle',kind:'root',area:null,description:'Mapa estrutural do projeto e dependências locais encontradas no código.',files:[]}],edges=[],sectors=new Map(),fileNodes=new Map();
 const areas=AREAS.map(([id,label,color,description])=>({id,label,color,description}));
 for(const a of areas){nodes.push({...a,id:'area:'+a.id,kind:'area',area:a.id,files:[]});edges.push({source:'root',target:'area:'+a.id,type:'structure'});}
 for(const path of files){const [area,sector,label]=classify(path),parent=`sector:${area}:${sector}`;if(!sectors.has(parent)){const n={id:parent,label,kind:'sector',area,files:[],description:'Setor identificado pelos arquivos do repositório.'};sectors.set(parent,n);nodes.push(n);edges.push({source:'area:'+area,target:parent,type:'structure'});}sectors.get(parent).files.push(path);const n={id:'file:'+path,label:basename(path),kind:'file',area,parent,path,files:[path],description:'Arquivo do projeto. As conexões de código indicam imports locais resolvidos.'};nodes.push(n);fileNodes.set(path,n);edges.push({source:parent,target:n.id,type:'structure'});}
 for(const a of areas)nodes.find(n=>n.id==='area:'+a.id).files=files.filter(p=>fileNodes.get(p).area===a.id);
 const imports=[];const seen=new Set();
 for(const path of files){if(!/\.(?:js|mjs)$/.test(path))continue;for(const match of contents.get(path).matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s*)['"]([^'"]+)['"]/g)){const spec=match[1];if(!spec.startsWith('.'))continue;const target=relative(root,resolve(root,dirname(path),spec)).replaceAll('\\','/');if(!fileNodes.has(target))continue;const a=fileNodes.get(path),b=fileNodes.get(target),evidence=path+' → '+spec;imports.push({source:a.id,target:b.id,type:'import',evidence});if(a.parent!==b.parent&&!seen.has(a.parent+'\0'+b.parent)){edges.push({source:a.parent,target:b.parent,type:'dependency',evidence});seen.add(a.parent+'\0'+b.parent);}}}
 edges.push(...imports);
 // Derive constructor injection only when the corresponding runtime source exists.
 const runtime=contents.get('platform/apps/api/runtime.js')||'';
 for(const [a,b,expression]of [['marketplace','moderation','createMarketplaceService(createMarketplaceRepository(database),moderationRepository)'],['communications','moderation','createCommunicationsService(createCommunicationsRepository(database),moderationRepository)'],['review-moderation','moderation','createReviewModerationService(createReviewModerationRepository(database),moderationRepository)']]){
  const source=[...sectors.keys()].find(k=>k.endsWith(':'+a)),target=[...sectors.keys()].find(k=>k.endsWith(':'+b));
  if(source&&target&&runtime.replaceAll(/\s/g,'').includes(expression))edges.push({source,target,type:'wiring',evidence:'platform/apps/api/runtime.js · injeção de dependência'});
 }
 return {nodes,edges,areas,stats:{files:fileNodes.size,sectors:sectors.size,imports:imports.length},metadata:{revision:hash.digest('hex'),generatedAt:new Date().toISOString(),mode:'repository'},scope:'Arquivos textuais do projeto e platform, excluindo dependências instaladas, assets binários, lockfile, dados privados gerados e o visualizador avulso. Imports dinâmicos construídos em runtime, chamadas remotas e fluxos internos de banco não são inferidos.'};
}
export async function writeArchitectureSnapshot(root=PROJECT_ROOT,output=SNAPSHOT_PATH){const graph=await buildArchitectureGraph(root);await mkdir(dirname(output),{recursive:true});await writeFile(output,JSON.stringify(graph));return graph;}
if(isMainModule(import.meta.url)){const graph=await writeArchitectureSnapshot();console.log(`Arquitetura Neural sincronizada: ${graph.stats.files} arquivos, revisão ${graph.metadata.revision.slice(0,12)}.`);}
