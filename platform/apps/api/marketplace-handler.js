import { readJson } from "./body.js";
import { authenticatedUser } from "./session.js";
import { sendJson } from "./http.js";
import { requireAdultDeclaration } from "./adult-declaration-service.js";

export async function handleMarketplace(request, response, {
  url, headers, requestId, marketplaceService, marketplaceProviders, authService,
}) {
  if (!url.pathname.startsWith("/v1/")) return false;

  if(request.method==='POST'&&url.pathname==='/v1/media/listing-read'){
    const user=await authenticatedUser(request,authService);
    if(!marketplaceProviders)return false;
    const media=await marketplaceProviders.signedListingRead(user.id,await readJson(request));
    sendJson(response,200,{media,requestId},{...headers,'cache-control':'no-store'});
    return true;
  }

  if (request.method === "POST" && url.pathname === "/v1/media/uploads") {
    const user = await authenticatedUser(request, authService);
    if (!marketplaceProviders) return false;
    const upload = await marketplaceProviders.signedUpload(user.id, await readJson(request));
    sendJson(response, 201, { upload, requestId }, headers);
    return true;
  }

  if (request.method === "POST" && url.pathname === "/v1/geocoding/resolve") {
    const user = await authenticatedUser(request, authService);
    if (!marketplaceProviders) return false;
    const location = await marketplaceProviders.geocode(user.id, await readJson(request));
    sendJson(response, 200, { location, requestId }, headers);
    return true;
  }

  if (!marketplaceService) return false;
  const resubmit = url.pathname.match(/^\/v1\/account\/listings\/([0-9a-f-]{36})\/resubmit$/i);
  if (resubmit && request.method === "POST") {
    const user = await authenticatedUser(request, authService);
    requireAdultDeclaration(user);
    const listing = await marketplaceService.resubmitListing(user.id, resubmit[1], await readJson(request));
    sendJson(response, 200, { listing, requestId }, { ...headers, "cache-control": "no-store" });
    return true;
  }
  if (request.method === "GET" && url.pathname === "/v1/account/listings") {
    const user = await authenticatedUser(request, authService);
    sendJson(response, 200, { items: await marketplaceService.ownListings(user.id), requestId }, { ...headers, "cache-control": "no-store" });
    return true;
  }
  if (url.pathname === "/v1/support/tickets" && ["GET","POST"].includes(request.method)) {
    const actor=await authenticatedUser(request,authService);
    const result=request.method==="POST"
      ? await marketplaceService.createSupportTicket(actor.id,await readJson(request))
      : await marketplaceService.supportPage(actor,{page:url.searchParams.get('page')??'1'});
    sendJson(response,request.method==="POST"&&!result.reused?201:200,{...result,requestId},{...headers,"cache-control":"no-store"});return true;
  }
  const support=url.pathname.match(/^\/v1\/support\/tickets\/([0-9a-f-]{36})(\/reply)?$/i);
  if(support && ((request.method==="GET"&&!support[2])||(request.method==="POST"&&support[2]))) {
    const actor=await authenticatedUser(request,authService);
    const result=request.method==="GET"
      ? {ticket:await marketplaceService.supportTicket(actor,support[1])}
      : await marketplaceService.replySupportTicket(actor,support[1],await readJson(request));
    sendJson(response,200,{...result,requestId},{...headers,"cache-control":"no-store"});return true;
  }
  const cancellationDecision=url.pathname.match(/^\/v1\/support\/tickets\/([0-9a-f-]{36})\/cancellation-decision$/i);
  if(cancellationDecision&&request.method==='POST'){
    const actor=await authenticatedUser(request,authService);
    const result=await marketplaceService.supportCancellationDecision(actor,cancellationDecision[1],await readJson(request));
    sendJson(response,result.reused?200:201,{...result,requestId},{...headers,'cache-control':'no-store'});return true;
  }

  if (request.method === "GET" && url.pathname === "/v1/listings") {
    const items = await marketplaceService.search(Object.fromEntries(url.searchParams));
    sendJson(response, 200, { items, requestId }, headers);
    return true;
  }

  const detail = url.pathname.match(/^\/v1\/listings\/([0-9a-f-]{36})$/i);
  if (request.method === "GET" && detail) {
    sendJson(response, 200, { listing: await marketplaceService.detail(detail[1]), requestId }, headers);
    return true;
  }

  if (request.method === "POST" && url.pathname === "/v1/listings") {
    const user = await authenticatedUser(request, authService);
    requireAdultDeclaration(user);
    const listing = await marketplaceService.create(user.id, await readJson(request));
    sendJson(response, listing.reused?200:201, { listing, requestId }, {...headers,'cache-control':'no-store'});
    return true;
  }

  if (request.method === "GET" && url.pathname === "/v1/favorites") {
    const user = await authenticatedUser(request, authService);
    sendJson(response, 200, { items: await marketplaceService.favorites(user.id), requestId }, headers);
    return true;
  }

  const favorite = url.pathname.match(/^\/v1\/favorites\/([0-9a-f-]{36})$/i);
  if (favorite && ["POST", "DELETE"].includes(request.method)) {
    const user = await authenticatedUser(request, authService);
    const result = request.method === "POST"
      ? await marketplaceService.addFavorite(user.id, favorite[1])
      : await marketplaceService.removeFavorite(user.id, favorite[1]);
    sendJson(response, 200, { ...result, requestId }, headers);
    return true;
  }

  const startTransaction = url.pathname.match(/^\/v1\/listings\/([0-9a-f-]{36})\/transactions$/i);
  if (request.method === "POST" && startTransaction) {
    const user = await authenticatedUser(request, authService);
    requireAdultDeclaration(user);
    const transaction = await marketplaceService.startTransaction(user.id, startTransaction[1]);
    sendJson(response, 201, { transaction, requestId }, headers);
    return true;
  }

  const chatAccess = url.pathname.match(/^\/v1\/transactions\/([0-9a-f-]{36})\/chat-access$/i);
  if (request.method === "GET" && chatAccess) {
    const user = await authenticatedUser(request, authService);
    const access = await marketplaceService.chatAccess(user.id, chatAccess[1]);
    sendJson(response, 200, { ...access, requestId }, headers);
    return true;
  }
  const contactAccess=url.pathname.match(/^\/v1\/transactions\/([0-9a-f-]{36})\/contact$/i);
  if(request.method==='GET'&&contactAccess){
    const user=await authenticatedUser(request,authService);
    const contact=await marketplaceService.transactionContact(user.id,contactAccess[1]);
    sendJson(response,200,{contact,requestId},{...headers,'cache-control':'no-store'});return true;
  }

  const transactionAction = url.pathname.match(/^\/v1\/transactions\/([0-9a-f-]{36})\/(cancel|complete)$/i);
  if (request.method === "POST" && transactionAction) {
    const user = await authenticatedUser(request, authService);
    const transaction = transactionAction[2] === "cancel"
      ? await marketplaceService.cancelTransaction(user.id, transactionAction[1])
      : await marketplaceService.completeTransaction(user.id, transactionAction[1]);
    sendJson(response, 200, { transaction, requestId }, headers);
    return true;
  }

  return false;
}
