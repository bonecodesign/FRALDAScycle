'use strict';
// Orthographic 3D projection: rotate world around Y then X, with depth sorting.
const canvas = document.querySelector('#scene'), ctx = canvas.getContext('2d');
const layers = [
 {name:'Experiências',color:'#72bda5',items:[['Site público','Home, busca, anúncios, publicação, impacto e ajuda. A interface aprovada da raiz orienta as superfícies da plataforma.','platform/apps/site'],['App / PWA','Jornada de autenticação, negociação, reserva, pagamento, entrega e perfil.','platform/apps/app'],['Administração','Operação de usuários, moderação, finanças, logística, relatórios e alertas.','platform/apps/admin']]},
 {name:'Fundação compartilhada',color:'#86b8c9',items:[['Design system','Tokens e componentes compartilhados. Laboratórios de acessibilidade, movimento e responsividade complementam o protótipo.','platform/packages/ui'],['Contratos','Esquemas e contratos de comunicação entre as superfícies e a API.','platform/packages/contracts'],['API HTTP','Roteamento, sessão, autorização, segurança, limitação de requisições e telemetria.','platform/apps/api/server.js']]},
 {name:'Serviços de produto',color:'#c5ad77',items:[['Marketplace e doações','Anúncios, busca, negociação e fluxos de doação e acesso institucional.','platform/apps/api/marketplace-service.js · donation-service.js'],['Financeiro e premium','Pagamentos, carteiras, reembolsos e regras de assinatura premium.','platform/apps/api/payment-service.js · premium-service.js'],['Logística e confiança','Entregas, reputação, moderação, notificações, privacidade e consentimento.','platform/apps/api/logistics-service.js · moderation-service.js · privacy-request-service.js']]},
 {name:'Persistência e processos',color:'#a49bc9',items:[['PostgreSQL','Esquema persistente, migrações, seeds e rotinas de backup e restauração.','platform/database'],['Workers','Processamento de notificações e tarefas relacionadas ao premium.','platform/workers/notifications.js · premium.js'],['Adaptadores externos','Contratos e provedores para pagamento, logística e marketplace. Ativação depende de configuração e validação.','platform/apps/api/payment-provider.js · logistics-provider.js · marketplace-providers.js']]},
 {name:'Entrega e governança',color:'#95a7b1',items:[['Containers e entrega','Empacotamento da API e das superfícies, composição de serviços e configuração de produção.','platform/Dockerfile · Dockerfile.surface · compose.yaml'],['Qualidade e observação','Testes, verificações de prontidão, smoke de implantação e telemetria.','platform/tests · platform/tools · platform/apps/api/telemetry.js'],['Governança e piloto','Documentação de requisitos, privacidade, seleção de provedores e evidências do piloto.','platform/docs · OWNERSHIP.md']]}
];
let selected=null, width=800, height=610, targets=[], pointers=new Map(), drag=null;
const state={x:35.26438968,y:-45,zoom:100,explode:65,connections:true};
const controls={x:document.querySelector('#rotation-x'),y:document.querySelector('#rotation-y'),zoom:document.querySelector('#zoom'),explode:document.querySelector('#explode')};
const modules=layers.flatMap((l,li)=>l.items.map((item,i)=>({id:`${li}-${i}`,li,i,item,color:l.color})));
const list=document.querySelector('#module-list');
modules.forEach(m=>{const b=document.createElement('button');b.type='button';b.className='module';b.dataset.id=m.id;b.innerHTML=`<i style="background:${m.color}">${modules.indexOf(m)+1}</i><span>${m.item[0]}</span>`;b.addEventListener('click',()=>select(m));list.append(b)});
function select(m){selected=m;document.querySelector('#mobile-selection').textContent=`${modules.indexOf(m)+1}. ${m.item[0]} · Consulte Detalhes para saber mais`;openMobilePanel('details');document.querySelector('#detail-title').textContent=m.item[0];document.querySelector('#detail-text').textContent=m.item[1];document.querySelector('#detail-path').textContent=m.item[2];list.querySelectorAll('button').forEach(b=>{b.classList.toggle('active',b.dataset.id===m.id);b.setAttribute('aria-pressed',String(b.dataset.id===m.id))});render()}
function sync(){for(const [key,el] of Object.entries(controls)){el.value=state[key];document.querySelector(`#${key==='x'||key==='y'?key:key}-value`).textContent=`${Math.round(state[key])}${key==='x'||key==='y'?'°':'%'}`;}document.querySelector('#view-status').textContent=`X ${Math.round(state.x)}° / Y ${Math.round(state.y)}°`;render()}
Object.entries(controls).forEach(([key,el])=>el.addEventListener('input',()=>{state[key]=Number(el.value);sync()}));
document.querySelector('#connections').addEventListener('change',e=>{state.connections=e.target.checked;render()});
function reset(){Object.assign(state,{x:35.26438968,y:-45,zoom:100,explode:65});sync()}
document.querySelector('#reset').onclick=reset;
document.querySelector('#iso').onclick=()=>{state.x=35.26438968;state.y=-45;sync()};
document.querySelector('#top').onclick=()=>{state.x=85;state.y=0;sync()};
document.querySelector('#front').onclick=()=>{state.x=0;state.y=0;sync()};
function project(x,y,z){const ry=state.y*Math.PI/180,rx=state.x*Math.PI/180;const xx=x*Math.cos(ry)+z*Math.sin(ry),zz=-x*Math.sin(ry)+z*Math.cos(ry);const yy=y*Math.cos(rx)-zz*Math.sin(rx),depth=y*Math.sin(rx)+zz*Math.cos(rx);const scale=Math.min(width/(width<=700?680:850),height/660)*state.zoom/100;return {x:width/2+xx*scale,y:height/2-yy*scale,depth,scale}}
function polygon(points,fill,stroke){ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();if(fill){ctx.fillStyle=fill;ctx.fill()}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.stroke()}}
function tint(hex,factor){return '#'+hex.slice(1).match(/../g).map(v=>Math.min(255,Math.round(parseInt(v,16)*factor)).toString(16).padStart(2,'0')).join('')}
function box(x,y,z,w,h,d,color,module=null){const v=[[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]].map(([a,b,c])=>project(x+a*w/2,y+b*h/2,z+c*d/2));const faces=[[0,1,2,3,.83],[4,7,6,5,1],[3,2,6,7,1.15],[0,4,5,1,.72],[0,3,7,4,.9],[1,5,6,2,.96]];return faces.map(([a,b,c,d,f])=>({points:[v[a],v[b],v[c],v[d]],depth:(v[a].depth+v[b].depth+v[c].depth+v[d].depth)/4,color:tint(color,f),module}))}
function positions(){const gap=48+state.explode*1.5;return layers.map((l,i)=>({y:(2-i)*gap,l,i}))}
function render(){if(!width)return;ctx.clearRect(0,0,width,height);ctx.fillStyle='#edf3ee';ctx.fillRect(0,0,width,height);ctx.strokeStyle='#dce7df';ctx.lineWidth=.6;for(let x=0;x<width;x+=28){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,height);ctx.stroke()}for(let y=0;y<height;y+=28){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(width,y);ctx.stroke()}
 const pos=positions(),faces=[];targets=[];
 // Dashed assembly guides emphasize the separation of the five planes.
 ctx.setLineDash([4,6]);ctx.strokeStyle='#8da99b';[[-285,-110],[285,-110],[-285,110],[285,110]].forEach(([x,z])=>{const a=project(x,pos[0].y+18,z),b=project(x,pos[4].y-18,z);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke()});ctx.setLineDash([]);
 if(state.connections){ctx.setLineDash([3,5]);ctx.strokeStyle='#6b9485';ctx.lineWidth=1.2;for(let n=0;n<4;n++)for(let i=0;i<3;i++){const a=project((i-1)*185,pos[n].y,0),b=project((i-1)*185,pos[n+1].y+20,0);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke()}ctx.setLineDash([])}
 for(const p of pos){faces.push(...box(0,p.y-12,0,590,10,250,p.l.color));for(let i=0;i<3;i++){const m=modules.find(m=>m.li===p.i&&m.i===i);faces.push(...box((i-1)*185,p.y+6,0,166,27,170,selected?.id===m.id?'#3aa785':m.color,m))}}
 faces.sort((a,b)=>a.depth-b.depth);for(const f of faces){polygon(f.points,f.color,'#ffffff85');if(f.module)targets.push(f)}
 // Screen-facing annotations stay readable at every angle.
 const annotations=pos.flatMap(p=>p.l.items.map((item,i)=>({p:project((i-1)*185,p.y+23,0),item,m:modules.find(m=>m.li===p.i&&m.i===i)}))).sort((a,b)=>a.p.depth-b.p.depth);
 for(const a of annotations){const font=Math.max(9,Math.min(13,12*a.p.scale));ctx.font=`600 ${font}px Arial`;const label=width<=700?String(modules.indexOf(a.m)+1):a.item[0],tw=ctx.measureText(label).width;ctx.fillStyle=selected?.id===a.m.id?'#164a3d':'#ffffffed';ctx.beginPath();if(ctx.roundRect)ctx.roundRect(a.p.x-tw/2-8,a.p.y-11,tw+16,width<=700?30:23,4);else ctx.rect(a.p.x-tw/2-8,a.p.y-11,tw+16,width<=700?30:23);ctx.fill();ctx.fillStyle=selected?.id===a.m.id?'#fff':'#23473f';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(label,a.p.x,a.p.y+1);targets.push({points:[{x:a.p.x-tw/2-8,y:a.p.y-11},{x:a.p.x+tw/2+8,y:a.p.y-11},{x:a.p.x+tw/2+8,y:a.p.y+(width<=700?19:12)},{x:a.p.x-tw/2-8,y:a.p.y+(width<=700?19:12)}],module:a.m})}
 ctx.textAlign='left';ctx.font='10px monospace';ctx.fillStyle='#55766b';ctx.fillText(width<=700?'FC / VISTA EXPLODIDA':'FC — ARQUITETURA LÓGICA / VISTA EXPLODIDA',18,22);
 document.querySelector('#static-preview').hidden=true;
}
function inside(p,poly){let yes=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)yes=!yes}return yes}
function resize(){const r=canvas.getBoundingClientRect();width=r.width;height=r.height;const ratio=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);ctx.setTransform(ratio,0,0,ratio,0,0);render()}
if(typeof ResizeObserver!=='undefined')new ResizeObserver(resize).observe(canvas);else window.addEventListener('resize',resize);
resize();
function clamp(v,min,max){return Math.max(min,Math.min(max,v))}
function wrap(v){return ((v+180)%360+360)%360-180}
canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===1)drag={x:e.clientX,y:e.clientY,moved:false};else if(drag)drag.moved=true;});
canvas.addEventListener('pointermove',e=>{if(!pointers.has(e.pointerId)||!drag)return;const prev=pointers.get(e.pointerId);if(pointers.size===2){const other=[...pointers.entries()].find(([id])=>id!==e.pointerId)[1];const before=Math.hypot(prev.x-other.x,prev.y-other.y),after=Math.hypot(e.clientX-other.x,e.clientY-other.y);if(before>0)state.zoom=clamp(state.zoom*after/before,40,220);drag.moved=true}else if(pointers.size===1){const dx=e.clientX-prev.x,dy=e.clientY-prev.y;state.y=wrap(state.y+dx*.4);state.x=clamp(state.x+dy*.4,-85,85);if(Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>4)drag.moved=true}pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});sync()});
function endPointer(e,cancelled=false){if(!cancelled&&drag&&!drag.moved&&pointers.size===1){const r=canvas.getBoundingClientRect(),p={x:e.clientX-r.left,y:e.clientY-r.top};const target=[...targets].reverse().find(t=>inside(p,t.points));if(target)select(target.module)}pointers.delete(e.pointerId);if(!pointers.size)drag=null;else if(drag)drag.moved=true;}
canvas.addEventListener('pointerup',e=>endPointer(e));
canvas.addEventListener('pointercancel',e=>endPointer(e,true));
canvas.addEventListener('lostpointercapture',e=>{if(pointers.has(e.pointerId))endPointer(e,true)});
canvas.addEventListener('wheel',e=>{e.preventDefault();state.zoom=clamp(state.zoom*Math.exp(-e.deltaY*.001),40,220);sync()},{passive:false});
canvas.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-','Home'].includes(e.key))return;e.preventDefault();if(e.key==='Home')return reset();if(e.key==='ArrowLeft')state.y=wrap(state.y-5);if(e.key==='ArrowRight')state.y=wrap(state.y+5);if(e.key==='ArrowUp')state.x=clamp(state.x-5,-85,85);if(e.key==='ArrowDown')state.x=clamp(state.x+5,-85,85);if(e.key==='+'||e.key==='=')state.zoom=clamp(state.zoom+10,40,220);if(e.key==='-')state.zoom=clamp(state.zoom-10,40,220);sync()});
document.querySelector('#export').onclick=()=>{render();const a=document.createElement('a');a.download='fraldacycle-arquitetura-explodida.png';a.href=canvas.toDataURL('image/png');a.click()};
function openMobilePanel(which,toggle=false){
 for(const name of ['controls','details']){
 const panel=document.querySelector(name==='controls'?'#view-controls':'#module-details');
 const button=document.querySelector(`#toggle-${name}`);
 const open=name===which&&(!toggle||!panel.classList.contains('mobile-open'));
 panel.classList.toggle('mobile-open',open);button.setAttribute('aria-expanded',String(open));
 }
}
document.querySelector('#toggle-controls').onclick=()=>openMobilePanel('controls',true);
document.querySelector('#toggle-details').onclick=()=>openMobilePanel('details',true);
document.querySelector('#zoom-in').onclick=()=>{state.zoom=clamp(state.zoom+15,40,220);sync()};
document.querySelector('#zoom-out').onclick=()=>{state.zoom=clamp(state.zoom-15,40,220);sync()};
sync();
