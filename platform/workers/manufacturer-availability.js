import {isMainModule} from '../packages/contracts/main-module.js';
const wait=(ms,signal)=>new Promise(resolve=>{const timer=setTimeout(done,ms);function done(){clearTimeout(timer);signal?.removeEventListener('abort',done);resolve();}signal?.addEventListener('abort',done,{once:true});});
export async function runManufacturerAvailabilityWorker({mode,env=process.env,refresh=async()=>({checked:0,observations:0}),waitFor=wait,signal}={}){
  if(!['once','serve'].includes(mode))throw new Error('Use --once ou --serve.');
  if(mode==='serve'&&(env.NODE_ENV!=='production'||env.MANUFACTURER_AVAILABILITY_REFRESH_ENABLED!=='true'||env.MANUFACTURER_AVAILABILITY_ACTIVATION_ACKNOWLEDGED!=='true'))throw new Error('O worker exige produção e ativação reconhecida.');
  do{const result=await refresh();console.log(JSON.stringify({type:'manufacturer.availability.refresh.completed',...result,compatibilityAuthority:'manufacturer_catalog'}));if(mode==='once'||signal?.aborted)break;await waitFor(60*60*1000,signal);}while(!signal?.aborted);
}
if(isMainModule(import.meta.url)){const controller=new AbortController();process.once('SIGTERM',()=>controller.abort());process.once('SIGINT',()=>controller.abort());await runManufacturerAvailabilityWorker({mode:process.argv[2]==='--once'?'once':process.argv[2]==='--serve'?'serve':process.argv[2],signal:controller.signal});}
