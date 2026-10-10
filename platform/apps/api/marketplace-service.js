import { assertContentAllowed } from './content-guard.js';
import {createHash} from 'node:crypto';
import { pagination } from "./pagination.js";
import { ServiceError } from "./service-error.js";
import { catalogHasModel } from "../../packages/contracts/diaper-catalog.js";
import { hasScope, requireScope } from "./authorization.js";

export class MarketplaceError extends ServiceError {
  constructor(code, status, message) {
    super(code, status, message);
  }
}

const KINDS = new Set(["sale", "exchange", "donation"]);
const CATEGORIES = new Set(["infant", "swim"]);
const PACKAGE_CONDITIONS = new Set(["sealed", "open"]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validListingId(value) {
  if (!UUID_PATTERN.test(String(value ?? ""))) {
    throw new MarketplaceError("listing_not_found", 404, "Anúncio não encontrado.");
  }
}

export function createMarketplaceService(repository, moderation = null, mediaProvider = null) {
  async function verifyMedia(userId, mediaKeys) {
    if (!mediaProvider?.verifyListingMedia) throw new MarketplaceError("media_verification_unavailable", 503, "Não foi possível confirmar o processamento das fotos.");
    await mediaProvider.verifyListingMedia(userId, mediaKeys);
  }
  return Object.freeze({
    ownListings(userId) { return repository.ownListings(userId); },
    async resubmitListing(userId, listingId, input) {
      validListingId(listingId);
      const allowed = ["title", "description", "mediaKeys", "expectedUpdatedAt", "confirmed"];
      if (!input || typeof input !== "object" || Array.isArray(input) ||
          Object.keys(input).some(key => !allowed.includes(key)) || input.confirmed !== true) {
        throw new MarketplaceError("invalid_resubmission", 422, "Confirme as correções antes de reenviar.");
      }
      const title = String(input.title ?? "").trim();
      const description = String(input.description ?? "").trim();
      if (title.length < 5 || title.length > 120 || description.length < 20 || description.length > 4_000 ||
          typeof input.expectedUpdatedAt !== "string" || !Number.isFinite(Date.parse(input.expectedUpdatedAt))) {
        throw new MarketplaceError("invalid_resubmission", 422, "Revise o título e a descrição e carregue o anúncio novamente.");
      }
      const mediaKeys = input.mediaKeys;
      if (mediaKeys !== undefined && (!Array.isArray(mediaKeys) || mediaKeys.length < 1 || mediaKeys.length > 8 ||
          new Set(mediaKeys).size !== mediaKeys.length || mediaKeys.some(key =>
            typeof key !== "string" || !key.startsWith(`listings/${userId}/`) ||
            !/^[a-zA-Z0-9._/-]{1,512}$/.test(key) || key.includes("..")))) {
        throw new MarketplaceError("invalid_media", 422, "Envie de uma a oito fotos da sua conta.");
      }
      await assertContentAllowed(moderation, userId, "listing", title + "\n" + description);
      if (mediaKeys !== undefined) await verifyMedia(userId, mediaKeys);
      return repository.resubmitListing({ sellerId: userId, listingId, title, description,
        mediaKeys, expectedUpdatedAt: input.expectedUpdatedAt });
    },
    async createSupportTicket(userId, input) {
      const category = String(input?.category ?? "general");
      const subject = String(input?.subject ?? "").trim();
      const details = String(input?.details ?? "").trim();
      const transactionId = String(input?.transactionId ?? "").trim() || null;
      const idempotencyKey = String(input?.idempotencyKey ?? "").trim();
      if (!["general","cancellation","receipt_problem","privacy","account"].includes(category) ||
          subject.length < 5 || subject.length > 120 || details.length < 10 || details.length > 2000 ||
          idempotencyKey.length < 16 || idempotencyKey.length > 128 ||
          (transactionId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(transactionId)) ||
          (["cancellation","receipt_problem"].includes(category) && !transactionId)) {
        throw new MarketplaceError("invalid_support_ticket",422,"Informe categoria, assunto, descrição e operação quando necessária.");
      }
      return repository.createSupportTicket({requesterId:userId,transactionId,category,subject,details,idempotencyKey});
    },
    async supportTickets(actor) {
      return repository.supportTickets({userId:actor.id,reviewer:hasScope(actor,"admin:support:write")});
    },
    async supportPage(actor,{page='1',status='',category='',q='',assignment='',sort='newest'}={}) {
      if(typeof page!=='string'||! /^[1-9][0-9]{0,5}$/.test(page)||Number(page)>100000)throw new MarketplaceError('invalid_support_page',400,'Informe uma página válida.');
      const reviewer=hasScope(actor,'admin:support:write');
      if((status!==''&&!['open','under_review','resolved'].includes(status))||(category!==''&&!['general','cancellation','receipt_problem','privacy','account'].includes(category))||(typeof q!=='string'||q.length>100||/[\u0000-\u001f\u007f]/.test(q))||(assignment!==''&&!['mine','unassigned'].includes(assignment))||!['newest','oldest','stale'].includes(sort))throw new MarketplaceError('invalid_support_filter',400,'O filtro de atendimento é inválido.');
      if(!reviewer&&(status!==''||category!==''||q!==''||assignment!==''||sort!=='newest'))throw new MarketplaceError('support_filter_forbidden',403,'Filtros da fila administrativa indisponíveis para esta conta.');
      const current=Number(page),rows=await repository.supportTickets({userId:actor.id,reviewer,limit:51,offset:(current-1)*50,status:status||null,category:category||null,q:q.trim()||null,assignment:assignment||null,sort});
      return {items:rows.slice(0,50),page:current,hasMore:rows.length>50};
    },
    async supportTicket(actor,ticketId) {
      return repository.supportTicket({userId:actor.id,ticketId,reviewer:hasScope(actor,"admin:support:write")});
    },
    async replySupportTicket(actor,ticketId,input) {
      requireScope(actor,"admin:support:write");
      const body=String(input?.body??"").trim();
      const status=String(input?.status??"under_review");
      const idempotencyKey=input?.idempotencyKey;
      if(body.length<10||body.length>2000||!["open","under_review","resolved"].includes(status)||typeof idempotencyKey!=='string'||! /^[a-zA-Z0-9:_-]{16,128}$/.test(idempotencyKey)) {
        throw new MarketplaceError("invalid_support_reply",422,"Informe a resposta e o estado do atendimento.");
      }
      return repository.replySupportTicket({actorId:actor.id,ticketId,body,status,idempotencyKey});
    },
    async setSupportAssignment(actor,ticketId,input) {
      requireScope(actor,'admin:support:write');
      if(!['claim','release'].includes(input?.action))throw new MarketplaceError('invalid_support_assignment',422,'Escolha assumir ou liberar o atendimento.');
      return repository.setSupportAssignment({actorId:actor.id,ticketId,action:input.action});
    },
    async supportCancellationDecision(actor,ticketId,input) {
      requireScope(actor,"admin:support:write");
      const reason=String(input?.reason??"").trim();
      if(input?.confirmed!==true||reason.length<10||reason.length>1000)throw new MarketplaceError('invalid_cancellation_decision',422,'Confirme a decisão e informe uma justificativa de 10 a 1000 caracteres.');
      return repository.supportCancellationDecision({actorId:actor.id,ticketId,reason});
    },
    async search(params = {}) {
      const { limit, offset } = pagination(params, { defaultLimit: 24, maxLimit: 50 });
      const kind = params.kind && KINDS.has(params.kind) ? params.kind : null;
      const hasLatitude = params.latitude != null && params.latitude !== "";
      const hasLongitude = params.longitude != null && params.longitude !== "";
      if (hasLatitude !== hasLongitude) {
        throw new MarketplaceError("invalid_location", 422, "Informe latitude e longitude juntas.");
      }
      const latitude = hasLatitude ? Number(params.latitude) : null;
      const longitude = hasLongitude ? Number(params.longitude) : null;
      if (latitude != null && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
          !Number.isFinite(longitude) || longitude < -180 || longitude > 180)) {
        throw new MarketplaceError("invalid_location", 422, "Informe coordenadas válidas.");
      }
      const radiusKm = latitude == null ? null : Math.min(200, Math.max(1, Number(params.radiusKm) || 25));
      const query = String(params.query ?? "").trim();
      const size = String(params.size ?? "").trim();
      if (query.length > 120 || size.length > 40) {
        throw new MarketplaceError("invalid_search", 422, "Revise os filtros informados.");
      }
      return repository.search({
        query: query || null,
        size: size || null,
        kind, latitude, longitude, radiusKm, limit, offset,
      });
    },

    async detail(id) {
      const listing = await repository.detail(id);
      if (!listing) throw new MarketplaceError("listing_not_found", 404, "Anúncio não encontrado.");
      return listing;
    },

    async create(userId, input) {
      const idempotencyKey=input?.idempotencyKey??null;
      if(idempotencyKey!==null&&(typeof idempotencyKey!=='string'||!UUID_PATTERN.test(idempotencyKey)))throw new MarketplaceError('invalid_listing_creation_key',422,'Chave de envio inválida.');
      const title = String(input?.title ?? "").trim();
      const description = String(input?.description ?? "").trim();
      const kind = String(input?.kind ?? "");
      const quantity = Number(input?.quantity);
      const priceCents = input?.priceCents == null ? null : Number(input.priceCents);
      const category = String(input?.category ?? "");
      const packageCondition = String(input?.packageCondition ?? "");
      const brand = String(input?.brand ?? "").trim();
      const model = String(input?.model ?? "").trim();
      const institutionId = String(input?.institutionId ?? "").trim() || null;
      const size = String(input?.size ?? "").trim() || null;
      const city = String(input?.city ?? "").trim() || null;
      const state = String(input?.state ?? "").trim().toUpperCase() || null;
      const hasLatitude = input?.latitude != null && input.latitude !== "";
      const hasLongitude = input?.longitude != null && input.longitude !== "";
      const latitude = hasLatitude ? Number(input.latitude) : null;
      const longitude = hasLongitude ? Number(input.longitude) : null;
      const mediaKeys = Array.isArray(input?.mediaKeys) ? input.mediaKeys : [];
      if (title.length < 5 || title.length > 120) throw new MarketplaceError("invalid_title", 422, "Informe o título do anúncio.");
      if (description.length < 20 || description.length > 4000) throw new MarketplaceError("invalid_description", 422, "Descreva o produto com mais detalhes.");
      if (!KINDS.has(kind)) throw new MarketplaceError("invalid_kind", 422, "Escolha venda, troca ou doação.");
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100_000) throw new MarketplaceError("invalid_quantity", 422, "Informe uma quantidade válida.");
      if (kind === "sale" && (!Number.isInteger(priceCents) || priceCents < 0)) throw new MarketplaceError("invalid_price", 422, "Informe um valor válido.");
      if (kind !== "sale" && priceCents !== null) throw new MarketplaceError("unexpected_price", 422, "Trocas e doações não possuem preço.");
      if (!CATEGORIES.has(category)) throw new MarketplaceError("invalid_category", 422, "Escolha fralda infantil descartável ou descartável para piscina.");
      if (!PACKAGE_CONDITIONS.has(packageCondition)) throw new MarketplaceError("invalid_package_condition", 422, "Informe se o pacote está fechado ou aberto.");
      if (packageCondition === "open" && kind !== "donation") throw new MarketplaceError("open_package_not_allowed", 422, "Pacotes abertos são permitidos somente em doações.");
      if (packageCondition === "open" && input?.openPackageAttested !== true) throw new MarketplaceError("open_package_attestation_required", 422, "Confirme as condições sanitárias do pacote aberto.");
      if (kind === "donation" && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(institutionId ?? "")) {
        throw new MarketplaceError("institution_required", 422, "Escolha uma instituição verificada para receber a doação.");
      }
      if (kind !== "donation" && institutionId) throw new MarketplaceError("unexpected_institution", 422, "A instituição é permitida somente em doações.");
      if (kind === "donation" && !idempotencyKey) {
        const institution = await repository.activeInstitution(institutionId);
        if (!institution) throw new MarketplaceError("institution_not_active", 409, "A instituição escolhida não está ativa.");
        if (packageCondition === "open" && !institution.open_packages_accepted) {
          throw new MarketplaceError("institution_rejects_open_packages", 409, "A instituição escolhida não recebe pacotes abertos.");
        }
      }
      if (!brand || !model) throw new MarketplaceError("invalid_model", 422, "Informe a marca e o modelo da fralda.");
      if (!catalogHasModel(category, brand, model)) throw new MarketplaceError("unsupported_model", 422, "Escolha um modelo disponível no catálogo brasileiro.");
      if (size && size.length > 40) throw new MarketplaceError("invalid_size", 422, "Informe um tamanho válido.");
      if (city && (city.length < 2 || city.length > 120)) throw new MarketplaceError("invalid_city", 422, "Informe uma cidade válida.");
      if (state && !/^[A-Z]{2}$/.test(state)) throw new MarketplaceError("invalid_state", 422, "Informe uma UF válida.");
      if (hasLatitude !== hasLongitude || (hasLatitude && (
        !Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
        !Number.isFinite(longitude) || longitude < -180 || longitude > 180
      ))) throw new MarketplaceError("invalid_location", 422, "Informe coordenadas válidas.");
      if (mediaKeys.length > 8 || new Set(mediaKeys).size !== mediaKeys.length || mediaKeys.some((key) => {
        const value = String(key);
        return !value.startsWith(`listings/${userId}/`) || !/^[a-zA-Z0-9._/-]{1,512}$/.test(value) || value.includes("..");
      })) throw new MarketplaceError("invalid_media", 422, "As fotos do anúncio são inválidas.");
      if (!mediaKeys.length) throw new MarketplaceError("listing_media_required", 422, "Envie pelo menos uma foto do produto antes de publicar.");
      const creation={sellerId:userId,title,description,kind,quantity,priceCents,institutionId,category,brand,model,packageCondition,openPackageAttested:packageCondition==='open'&&input.openPackageAttested===true,size,city,state,latitude,longitude,mediaKeys};
      const creationFingerprint=createHash('sha256').update(JSON.stringify(creation)).digest('hex');
      if(idempotencyKey&&repository.creationByKey){const existing=await repository.creationByKey(userId,idempotencyKey,creationFingerprint);if(existing)return existing;}
      if(kind==='donation'&&idempotencyKey){
        const institution=await repository.activeInstitution(institutionId);
        if(!institution)throw new MarketplaceError('institution_not_active',409,'A instituição escolhida não está ativa.');
        if(packageCondition==='open'&&!institution.open_packages_accepted)throw new MarketplaceError('institution_rejects_open_packages',409,'A instituição escolhida não recebe pacotes abertos.');
      }
      await assertContentAllowed(moderation,userId,'listing',title+'\n'+description);
      await verifyMedia(userId, mediaKeys);
      return repository.create({
        sellerId: userId, title, description, kind, quantity, priceCents, institutionId,idempotencyKey,creationFingerprint:idempotencyKey?creationFingerprint:null,
        category, brand, model, packageCondition,
        openPackageAttested: packageCondition === "open" && input.openPackageAttested === true,
        size, city, state, latitude, longitude, mediaKeys,
      });
    },

    favorites(userId) { return repository.favorites(userId); },
    async addFavorite(userId, listingId) { validListingId(listingId); await repository.addFavorite(userId, listingId); return { saved: true }; },
    async removeFavorite(userId, listingId) { validListingId(listingId); await repository.removeFavorite(userId, listingId); return { saved: false }; },

    async startTransaction(userId, listingId) {
      validListingId(listingId);
      const listing=await repository.detail(listingId);
      if(listing?.kind==='exchange')throw new MarketplaceError('exchange_offer_required',409,'Escolha o anúncio que você oferece e use o fluxo bilateral de troca.');
      return repository.startTransaction({ buyerId: userId, listingId });
    },

    async cancelTransaction(userId, transactionId) {
      return repository.cancelTransaction({ actorId: userId, transactionId });
    },

    async completeTransaction(userId, transactionId) {
      return repository.completeTransaction({ actorId: userId, transactionId });
    },

    async chatAccess(userId, transactionId) {
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(transactionId)) {
        throw new MarketplaceError("transaction_not_found", 404, "Operação não encontrada.");
      }
      const access = await repository.chatAccess({ actorId: userId, transactionId });
      if (!access) throw new MarketplaceError("transaction_not_found", 404, "Operação não encontrada.");
      const terminal = new Set(["cancelled", "refunded"]);
      const allowed = access.kind !== "donation" && access.payment_confirmed && !terminal.has(access.status);
      return {
        allowed,
        reason: allowed ? "payment_confirmed"
          : access.kind === "donation" ? "donation_chat_disabled"
          : terminal.has(access.status) ? "transaction_closed"
          : "payment_not_confirmed",
      };
    },
    async transactionContact(userId,transactionId) {
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(transactionId)) throw new MarketplaceError('transaction_not_found',404,'Operação não encontrada.');
      return repository.transactionContact({actorId:userId,transactionId});
    },
  });
}

