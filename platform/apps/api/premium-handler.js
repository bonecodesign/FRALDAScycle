import { authenticatedUser } from './session.js';
import { readJson } from './body.js';
import { sendJson } from './http.js';
import { requireAdultDeclaration } from './adult-declaration-service.js';
export async function handlePremium(request, response, { url, headers, requestId, authService, premiumService, premiumSubscriptionService }) {
  if (!premiumService) return false;
  const action = new Map([
    ['GET /v1/account/premium', 'status'], ['POST /v1/account/premium/subscribe', 'subscribe'],
    ['POST /v1/account/premium/cancel-renewal', 'cancelRenewal'],
    ['PUT /v1/account/premium/listing-choice', 'saveChoice'], ['POST /v1/account/premium/regularize-listings', 'regularize'],
    ['POST /v1/account/premium/listing-status', 'changeListingStatus'],
  ]).get(`${request.method} ${url.pathname}`);
  if (!action) return false;
  const user = await authenticatedUser(request, authService);
  if (action !== 'status') requireAdultDeclaration(user);
  if(action==='subscribe'&&!premiumSubscriptionService){
    sendJson(response,503,{error:{code:'premium_billing_not_enabled',message:'Cobrança Premium não ativada.'},requestId},{...headers,'cache-control':'no-store'});
    return true;
  }
  const target=['subscribe','cancelRenewal'].includes(action)&&premiumSubscriptionService?premiumSubscriptionService:premiumService;
  const result = await target[action](user.id, action === 'status' ? undefined : await readJson(request));
  sendJson(response, action==='subscribe'&&!result.reused?202:200, action === 'status' ? { premium: result, requestId } : { ...result, requestId }, { ...headers, 'cache-control': 'no-store' });
  return true;
}
