import { authenticatedUser } from './session.js';
import { readJson } from './body.js';
import { sendJson } from './http.js';
export async function handleAccountConsent(request,response,{url,headers,requestId,authService,accountConsentService}) {
  if(!accountConsentService)return false;
  const marketing=url.pathname==='/v1/account/marketing-preferences';
  const cookies=url.pathname==='/v1/account/cookie-preferences';
  const operational=url.pathname==='/v1/account/operational-preferences';
  const terms=url.pathname==='/v1/account/terms';
  const accept=url.pathname==='/v1/account/terms/accept';
  const history=url.pathname==='/v1/account/terms/history';
  if(!(((marketing||cookies||operational)&&['GET','PUT'].includes(request.method))||((terms||history)&&request.method==='GET')||(accept&&request.method==='POST')))return false;
  const user=await authenticatedUser(request,authService);
  const privateHeaders={...headers,'cache-control':'no-store'};
  let result;
  if(operational)result=request.method==='GET'?{preferences:await accountConsentService.operationalPreferences(user.id)}:await accountConsentService.saveOperationalPreferences(user.id,await readJson(request));
  if(marketing)result={preferences:request.method==='GET'?await accountConsentService.marketingPreferences(user.id):await accountConsentService.saveMarketingPreferences(user.id,await readJson(request))};
  if(cookies)result={preferences:request.method==='GET'?await accountConsentService.cookiePreferences(user.id):await accountConsentService.saveCookiePreferences(user.id,await readJson(request))};
  if(terms)result={terms:await accountConsentService.terms()};
  if(history)result={items:await accountConsentService.termsHistory(user.id)};
  if(accept)result=await accountConsentService.acceptTerms(user.id,await readJson(request));
  sendJson(response,accept&&!result.reused?201:200,{...result,requestId},privateHeaders);return true;
}
