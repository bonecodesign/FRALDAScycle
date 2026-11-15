const MINUTE=60_000,HOUR=60*MINUTE,DAY=24*HOUR;
const sunday=new Intl.DateTimeFormat('en-US',{timeZone:'America/Sao_Paulo',weekday:'short'});

function addBusinessDays(start,days){
  let value=new Date(start),remaining=days;
  while(remaining>0){value=new Date(value.getTime()+DAY);if(sunday.format(value)!=='Sun')remaining--;}
  return value;
}

export function firstResponseDeadline(priority,createdAt=new Date()){
  const start=new Date(createdAt);
  if(!Number.isFinite(start.getTime()))throw new TypeError('Data de criação inválida.');
  if(priority==='critical')return new Date(start.getTime()+30*MINUTE).toISOString();
  if(priority==='high')return new Date(start.getTime()+4*HOUR).toISOString();
  if(priority==='normal')return addBusinessDays(start,1).toISOString();
  if(priority==='low')return addBusinessDays(start,2).toISOString();
  throw new TypeError('Prioridade inválida.');
}
