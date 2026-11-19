// FC-322: deterministic first-human-response targets; no external dispatch.
// Regular coverage: Mon-Sat 08:00-20:00 America/Sao_Paulo.
// Critical target counts real elapsed minutes, including the unstaffed period;
// other classes consume the approved service window, skipping Sundays.
const zone='America/Sao_Paulo';
const localFormatter=new Intl.DateTimeFormat('en-US',{
 timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',
 weekday:'short',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23',
});
const budgets=Object.freeze({critical:30,high:240,normal:720,low:1440});
export const supportPriorities=Object.freeze(['critical','high','normal','low']);
function parts(at){
 const values=Object.fromEntries(localFormatter.formatToParts(at).map(p=>[p.type,p.value]));
 return {y:Number(values.year),m:Number(values.month),d:Number(values.day),h:Number(values.hour),min:Number(values.minute),s:Number(values.second),weekday:values.weekday};
}
function zonedInstant(y,m,d,h,min=0){
 const target=Date.UTC(y,m-1,d,h,min);
 let value=target;
 for(let i=0;i<4;i++){
  const p=parts(new Date(value));
  const shown=Date.UTC(p.y,p.m-1,p.d,p.h,p.min,p.s);
  value+=target-shown;
 }
 return value;
}
function nextDay(p){
 const utc=new Date(Date.UTC(p.y,p.m-1,p.d+1));
 return {y:utc.getUTCFullYear(),m:utc.getUTCMonth()+1,d:utc.getUTCDate()};
}
function align(at){
 let instant=at;
 for(let i=0;i<9;i++){
  const p=parts(new Date(instant));
  if(p.weekday==='Sun'||p.h>=20){
   const day=nextDay(p);
   instant=zonedInstant(day.y,day.m,day.d,8);
   continue;
  }
  if(p.h<8)return zonedInstant(p.y,p.m,p.d,8);
  return instant;
 }
 throw new Error('Unable to find a staffed service window');
}
export function firstResponseDeadline(createdAt,priority){
 if(!Object.hasOwn(budgets,priority))throw new TypeError('Unsupported support priority');
 const timestamp=new Date(createdAt).getTime();
 if(!Number.isFinite(timestamp))throw new TypeError('Invalid support ticket creation time');
 if(priority==='critical')return new Date(timestamp+budgets[priority]*60000).toISOString();
 let instant=align(timestamp),remaining=budgets[priority];
 for(let day=0;day<10&&remaining>0;day++){
  const p=parts(new Date(instant));
  const boundary=zonedInstant(p.y,p.m,p.d,20);
  const available=Math.max(0,(boundary-instant)/60000);
  const consumed=Math.min(remaining,available);
  instant+=consumed*60000;
  remaining-=consumed;
  if(remaining>0)instant=align(instant);
 }
 if(remaining>0)throw new Error('Support response target could not be calculated');
 return new Date(instant).toISOString();
}
