import { authenticatedUser } from './session.js';
import { readJson } from './body.js';
import { sendJson } from './http.js';
export async function handleModeration(request,response,{url,headers,requestId,authService,moderationService,communicationsService}) {
  const send=result=>sendJson(response,200,{...result,requestId},{...headers,'cache-control':'no-store'});
  if(moderationService) {
    const decision=url.pathname.match(/^\/v1\/moderation\/decisions\/([0-9a-f-]{36})(?:\/(appeal|review))?$/i);
    if(url.pathname==='/v1/moderation/decisions'&&request.method==='GET') { const actor=await authenticatedUser(request,authService);send({items:await moderationService.list(actor)});return true; }
    if(url.pathname==='/v1/moderation/suspensions'&&request.method==='POST') { const actor=await authenticatedUser(request,authService);send(await moderationService.suspend(actor,await readJson(request)));return true; }
    if(decision&&((!decision[2]&&request.method==='GET')||(decision[2]&&request.method==='POST'))) {
      const actor=await authenticatedUser(request,authService);
      send(!decision[2]?{decision:await moderationService.detail(actor,decision[1])}:await moderationService[decision[2]==='appeal'?'appeal':'reviewAppeal'](actor,decision[1],await readJson(request)));return true;
    }
  }
  if(communicationsService) {
    const route=url.pathname.match(/^\/v1\/transactions\/([0-9a-f-]{36})\/(messages|reviews)$/i);
    if(route&&((route[2]==='messages'&&['GET','POST'].includes(request.method))||(route[2]==='reviews'&&request.method==='POST'))) {
      const actor=await authenticatedUser(request,authService);
      send(request.method==='GET'?{items:await communicationsService.messages(actor.id,route[1])}:await communicationsService[route[2]==='messages'?'send':'review'](actor.id,route[1],await readJson(request)));return true;
    }
    const reviews=url.pathname.match(/^\/v1\/users\/([0-9a-f-]{36})\/reviews$/i);
    if(reviews&&request.method==='GET') { send({items:await communicationsService.publicReviews(reviews[1])});return true; }
  }
  return false;
}
