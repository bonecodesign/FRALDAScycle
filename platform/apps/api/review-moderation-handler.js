import {readJson} from './body.js';
import {authenticatedUser} from './session.js';
import {sendJson} from './http.js';
export async function handleReviewModeration(request,response,{url,headers,requestId,authService,reviewModerationService}){
  if(!reviewModerationService)return false;
  const own=url.pathname==='/v1/account/reviews',admin=url.pathname.match(/^\/v1\/admin\/review-moderation(?:\/([0-9a-f-]{36})(\/decision)?)?$/i),action=url.pathname.match(/^\/v1\/reviews\/([0-9a-f-]{36})\/(report|appeal)$/i);
  if(!((own&&request.method==='GET')||(admin&&((request.method==='GET'&&!admin[2])||(request.method==='POST'&&admin[2])))||(action&&request.method==='POST')))return false;
  const actor=await authenticatedUser(request,authService);let result;
  if(own)result={items:await reviewModerationService.own(actor)};
  else if(action)result={report:await reviewModerationService[action[2]](actor,action[1],await readJson(request))};
  else if(request.method==='POST')result={decision:await reviewModerationService.decide(actor,admin[1],await readJson(request))};
  else result=admin[1]?{review:await reviewModerationService.detail(actor,admin[1])}:{items:await reviewModerationService.list(actor)};
  sendJson(response,request.method==='POST'&&!(result.report??result.decision).reused?201:200,{...result,requestId},{...headers,'cache-control':'no-store','pragma':'no-cache'});return true;
}
