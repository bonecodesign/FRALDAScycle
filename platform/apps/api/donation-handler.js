import {readJson} from './body.js';
import {authenticatedUser} from './session.js';
import {sendJson} from './http.js';
export async function handleDonations(request,response,{url,headers,requestId,authService,donationService}){
 if(!donationService)return false;
 const root=url.pathname==='/v1/donations',listings=url.pathname==='/v1/donations/listings',match=url.pathname.match(/^\/v1\/donations\/([0-9a-f-]{36})(\/(accept|pickup))?$/i);
 if(!((root&&['GET','POST'].includes(request.method))||(listings&&request.method==='GET')||(match&&((request.method==='GET'&&!match[2])||(request.method==='POST'&&match[2])))))return false;
 const actor=await authenticatedUser(request,authService);let result;
 if(request.method==='GET')result=root?{items:await donationService.list(actor)}:listings?{items:await donationService.listings(actor)}:{donation:await donationService.detail(actor,match[1])};
 else result={donation:root?await donationService.create(actor,await readJson(request)):await donationService[match[3]](actor,match[1],await readJson(request))};
 sendJson(response,request.method==='POST'&&!result.donation.reused?201:200,{...result,requestId},{...headers,'cache-control':'no-store','pragma':'no-cache'});return true;
}
