'use strict';
const layers = [
 {name:'Experiências',color:'#72bda5',items:[['Site público','Home, busca, anúncios, publicação, impacto e ajuda. A interface aprovada da raiz orienta as superfícies da plataforma.','platform/apps/site'],['App / PWA','Jornada de autenticação, negociação, reserva, pagamento, entrega e perfil.','platform/apps/app'],['Administração','Operação de usuários, moderação, finanças, logística, relatórios e alertas.','platform/apps/admin']]},
 {name:'Fundação compartilhada',color:'#86b8c9',items:[['Design system','Tokens e componentes compartilhados. Laboratórios de acessibilidade, movimento e responsividade complementam o protótipo.','platform/packages/ui'],['Contratos','Esquemas e contratos de comunicação entre as superfícies e a API.','platform/packages/contracts'],['API HTTP','Roteamento, sessão, autorização, segurança, limitação de requisições e telemetria.','platform/apps/api/server.js']]},
 {name:'Serviços de produto',color:'#c5ad77',items:[['Marketplace e doações','Anúncios, busca, negociação e fluxos de doação e acesso institucional.','platform/apps/api/marketplace-service.js · donation-service.js'],['Financeiro e premium','Pagamentos, carteiras, reembolsos e regras de assinatura premium.','platform/apps/api/payment-service.js · premium-service.js'],['Logística e confiança','Entregas, reputação, moderação, notificações, privacidade e consentimento.','platform/apps/api/logistics-service.js · moderation-service.js · privacy-request-service.js']]},
 {name:'Persistência e processos',color:'#a49bc9',items:[['PostgreSQL','Esquema persistente, migrações, seeds e rotinas de backup e restauração.','platform/database'],['Workers','Processamento de notificações e tarefas relacionadas ao premium.','platform/workers/notifications.js · premium.js'],['Adaptadores externos','Contratos e provedores para pagamento, logística e marketplace. Ativação depende de configuração e validação.','platform/apps/api/payment-provider.js · logistics-provider.js · marketplace-providers.js']]},
 {name:'Entrega e governança',color:'#95a7b1',items:[['Containers e entrega','Empacotamento da API e das superfícies, composição de serviços e configuração de produção.','platform/Dockerfile · Dockerfile.surface · compose.yaml'],['Qualidade e observação','Testes, verificações de prontidão, smoke de implantação e telemetria.','platform/tests · platform/tools · platform/apps/api/telemetry.js'],['Governança e piloto','Documentação de requisitos, privacidade, seleção de provedores e evidências do piloto.','platform/docs · OWNERSHIP.md']]}
];
const $=id=>document.getElementById(id),svg=$('model');
const state={x:30,y:-35,zoom:1,explode:0,selected:null,auto:false};
const modules=layers.flatMap((l,li)=>l.items.map((item,i)=>({id:`${li}-${i}`,li,i,item,color:l.color,x:(i-1)*205,z:(li-2)*138})));
let groundBucket=0;let faces=[],raf=0,autoFrame=0,lastTime=0;const pointers=new Map();let moved=false,start=null,lastDrag=0;
function project(p){const ry=state.y*Math.PI/180,rx=state.x*Math.PI/180;const x=p[0]*Math.cos(ry)+p[2]*Math.sin(ry),z=-p[0]*Math.sin(ry)+p[2]*Math.cos(ry),y=p[1]*Math.cos(rx)-z*Math.sin(rx);return [450+x*state.zoom*.88,395-y*state.zoom*.88,p[1]*Math.sin(rx)+z*Math.cos(rx)]}
function color(hex,n){const rgb=hex.slice(1).match(/../g).map(v=>Math.max(0,Math.min(255,Math.round(parseInt(v,16)*n))));return '#'+rgb.map(v=>v.toString(16).padStart(2,'0')).join('')}
function face(points,fill,m){const pp=points.map(project);faces.push({bucket:groundBucket,points:pp,depth:pp.reduce((a,p)=>a+p[2],0)/pp.length,fill,m})}
// Beveled solids: planar main faces, narrow smooth chamfers and corner facets.
function solid(center,size,fill,m,r=5){const half=size.map(v=>v/2);r=Math.min(r,...half.map(v=>v*.65));const verts=[];
 for(const sx of [-1,1])for(const sy of [-1,1])for(const sz of [-1,1])for(let inner=0;inner<3;inner++){const signs=[sx,sy,sz];verts.push(signs.map((s,a)=>center[a]+s*(half[a]-(a===inner?r:0))))}
 for(let axis=0;axis<3;axis++)for(const sign of [-1,1]){const indices=[0,1,2].filter(a=>a!==axis);const pts=verts.filter(v=>Math.abs(v[axis]-(center[axis]+sign*half[axis]))<.001);pts.sort((a,b)=>Math.atan2(a[indices[1]]-center[indices[1]],a[indices[0]]-center[indices[0]])-Math.atan2(b[indices[1]]-center[indices[1]],b[indices[0]]-center[indices[0]]));face(pts,color(fill,axis===1?(sign>0?1.10:.74):axis===0?(sign>0?.88:.97):(sign>0?1:.82)),m)}
 for(let free=0;free<3;free++){const fixed=[0,1,2].filter(a=>a!==free);for(const sa of [-1,1])for(const sb of [-1,1]){const pts=[];for(const [sf,inner] of [[-1,fixed[0]],[1,fixed[0]],[1,fixed[1]],[-1,fixed[1]]]){const signs=[];signs[free]=sf;signs[fixed[0]]=sa;signs[fixed[1]]=sb;pts.push(signs.map((s,a)=>center[a]+s*(half[a]-(a===free||a===inner?r:0))))}face(pts,color(fill,1.02),m)}}
 for(const sx of [-1,1])for(const sy of [-1,1])for(const sz of [-1,1]){const signs=[sx,sy,sz];face([0,1,2].map(inner=>signs.map((s,a)=>center[a]+s*(half[a]-(a===inner?r:0)))),color(fill,1.04),m)}
}
function building(m){const lift=state.selected===m.id?32:0,e=state.explode*.68;const c=m.color,x=m.x,z=m.z;
 solid([x,8+lift,z],[172,16,110],'#e7e9df',m,6);
 // Three silhouettes: terraced pavilion, tall tower, and courtyard building.
 const floors=m.i===1?4:m.i===0?2:3,heights=m.i===1?27:24;
 for(let f=0;f<floors;f++){const y=28+lift+f*(heights+e),w=m.i===0?142-f*28:m.i===2?142-f*13:95,d=m.i===1?75:82-f*4;
 solid([x,y,z],[w,heights-3,d],f%2===0?c:'#f0f0e5',m,5);
 // Flush, dark glazing bands on two facades make these read as buildings.
 solid([x,y+1,z+d/2+.7],[w-20,7,2],'#427e78',m,1);
 solid([x+w/2+.7,y+1,z],[2,7,d-17],'#5b9690',m,1);
 if(m.i!==1&&f===0)solid([x-w/2+18,y-5,z+d/2+2],[16,18,5],'#365d54',m,2);
 }
 const roofY=28+lift+floors*(heights+e)-heights+heights/2+4+e*.35;
 solid([x,roofY,z],[m.i===1?107:m.i===0?126:126,8,m.i===1?85:78],'#f7f4e6',m,4);
}
function render(){raf=0;faces=[];groundBucket=0;solid([0,-12,0],[665,20,760],'#c5d4bc',null,12);solid([0,1,0],[646,5,741],'#e4e9d9',null,8);
 // A pedestrian spine and cross paths connect the neighborhood.
 solid([-103,5,0],[21,3,700],'#c7d3bf',null,1);solid([104,5,0],[21,3,700],'#c7d3bf',null,1);
 for(let r=-1;r<=1;r++)solid([0,5,r*138+69],[603,3,15],'#c7d3bf',null,1);
 groundBucket=1;for(const m of modules)building(m);
 for(const x of [-305,305])for(const z of [-295,-150,0,150,295]){solid([x,12,z],[22,15,28],'#b8c7a6',null,4);solid([x,30,z],[25,25,28],'#80a98b',null,9)}
 faces.sort((a,b)=>a.bucket-b.bucket||a.depth-b.depth);
 svg.innerHTML='<defs><filter id="shadow"><feGaussianBlur stdDeviation="16"/></filter></defs><ellipse cx="450" cy="530" rx="280" ry="100" fill="#52694a" opacity=".13" filter="url(#shadow)"/>'+faces.map(f=>`<polygon points="${f.points.map(p=>p[0].toFixed(1)+','+p[1].toFixed(1)).join(' ')}" fill="${f.fill}" stroke="${f.fill}" stroke-width=".5" ${f.m?`data-module="${f.m.id}"`:''}/>`).join('');
 if(state.selected){const m=modules.find(m=>m.id===state.selected);const p=project([m.x,170+state.explode*2,m.z]);svg.innerHTML+=`<g pointer-events="none"><rect x="${p[0]-90}" y="${p[1]-15}" width="180" height="30" rx="15" fill="#25433d"/><text x="${p[0]}" y="${p[1]+5}" text-anchor="middle" font-family="Arial" font-size="12" fill="white">${m.item[0]}</text></g>`}
 $('runtime').textContent='INTERATIVO ATIVO · '+(state.selected?modules.find(m=>m.id===state.selected).item[0]:state.explode?'PEÇAS SEPARADAS':'MAQUETE MONTADA');$('explode').value=state.explode;$('tilt').value=state.x;$('turn').value=state.y;$('assembly').setAttribute('aria-pressed',String(state.explode>0));$('assembly').textContent=state.explode>0?'↙ Reunir construções':'↗ Explodir construções';
}
function draw(){if(!raf)raf=requestAnimationFrame(render)}
function updateNow(){if(raf)cancelAnimationFrame(raf);raf=0;render();}
function select(id){const m=modules.find(m=>m.id===id);if(!m)return;state.selected=id;$('name').textContent=m.item[0];$('description').textContent=m.item[1];$('source').textContent=m.item[2];$('gesture-hint').textContent=m.item[0]+' · Selecionado';$('selection-card').hidden=false;$('selection-name').textContent=m.item[0];$('selection-description').textContent=m.item[1];document.querySelectorAll('.module').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.module===id)));updateNow()}
for(const m of modules){const b=document.createElement('button');b.className='module';b.dataset.module=m.id;b.setAttribute('aria-pressed','false');b.innerHTML=`<i style="background:${m.color}"></i>${m.item[0]}`;b.onclick=()=>select(m.id);$('modules').append(b)}
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),wrap=v=>((v+180)%360+360)%360-180;
function stopAuto(){state.auto=false;cancelAnimationFrame(autoFrame);$('auto').setAttribute('aria-pressed','false');$('auto').textContent='⟳ Girar automaticamente';lastTime=0}
function reset(){stopAuto();Object.assign(state,{x:30,y:-35,zoom:1,explode:0,selected:null});$('selection-card').hidden=true;$('gesture-hint').textContent='Arraste para girar · Pinça para zoom';document.querySelectorAll('.module').forEach(b=>b.setAttribute('aria-pressed','false'));updateNow()}
$('reset').onclick=reset;$('iso').onclick=()=>{state.x=35.264;state.y=-45;updateNow()};$('plus').onclick=()=>{state.zoom=clamp(state.zoom+.15,.5,2.5);updateNow()};$('minus').onclick=()=>{state.zoom=clamp(state.zoom-.15,.5,2.5);updateNow()};$('assembly').onclick=()=>{state.explode=state.explode?0:70;updateNow()};
for(const [id,key]of [['explode','explode'],['tilt','x'],['turn','y']])$(id).oninput=e=>{stopAuto();state[key]=Number(e.target.value);updateNow()};
function spin(t){if(!state.auto)return;if(lastTime)state.y=wrap(state.y+Math.min(t-lastTime,60)*.012);lastTime=t;draw();autoFrame=requestAnimationFrame(spin)}
$('auto').onclick=()=>{if(state.auto)return stopAuto();state.auto=true;$('auto').setAttribute('aria-pressed','true');$('auto').textContent='Ⅱ Pausar rotação';autoFrame=requestAnimationFrame(spin)};
svg.addEventListener('pointerdown',e=>{stopAuto();try{svg.setPointerCapture(e.pointerId)}catch{}pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===1){start={x:e.clientX,y:e.clientY};moved=false}else moved=true});
svg.addEventListener('pointermove',e=>{const prev=pointers.get(e.pointerId);if(!prev)return;if(pointers.size===2){const other=[...pointers.entries()].find(([id])=>id!==e.pointerId)[1];const before=Math.hypot(prev.x-other.x,prev.y-other.y),after=Math.hypot(e.clientX-other.x,e.clientY-other.y);if(before>0)state.zoom=clamp(state.zoom*after/before,.5,2.5);moved=true}else if(pointers.size===1){state.y=wrap(state.y+(e.clientX-prev.x)*.4);state.x=clamp(state.x+(e.clientY-prev.y)*.3,-70,85);if(Math.hypot(e.clientX-start.x,e.clientY-start.y)>5)moved=true}pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});draw()});
function end(e,cancel){if(moved)lastDrag=Date.now();if(!cancel&&!moved&&pointers.size===1){const target=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-module]');if(target)select(target.dataset.module)}pointers.delete(e.pointerId);if(pointers.size)moved=true;else start=null}
svg.addEventListener('click',e=>{if(Date.now()-lastDrag<350)return;const target=e.target.closest('[data-module]');if(target)select(target.dataset.module)});
svg.addEventListener('pointerup',e=>end(e,false));svg.addEventListener('pointercancel',e=>end(e,true));svg.addEventListener('lostpointercapture',e=>{if(pointers.has(e.pointerId))end(e,true)});svg.addEventListener('wheel',e=>{e.preventDefault();state.zoom=clamp(state.zoom*Math.exp(-e.deltaY*.001),.5,2.5);draw()},{passive:false});
svg.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-','Home'].includes(e.key))return;e.preventDefault();stopAuto();if(e.key==='Home')return reset();if(e.key==='ArrowLeft')state.y=wrap(state.y-5);if(e.key==='ArrowRight')state.y=wrap(state.y+5);if(e.key==='ArrowUp')state.x=clamp(state.x-5,-70,85);if(e.key==='ArrowDown')state.x=clamp(state.x+5,-70,85);if(e.key==='+')state.zoom=clamp(state.zoom+.1,.5,2.5);if(e.key==='-')state.zoom=clamp(state.zoom-.1,.5,2.5);draw()});
$('selection-close').onclick=()=>{$('selection-card').hidden=true;state.selected=null;updateNow()};
render();$('runtime').textContent='INTERATIVO ATIVO · TOQUE E EXPLORE';$('script-help').hidden=true;
