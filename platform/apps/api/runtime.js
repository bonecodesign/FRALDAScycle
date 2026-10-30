import { loadConfig } from "./config.js";
import { isMainModule } from "../../packages/contracts/main-module.js";
import { createApiServer } from "./server.js";
import { createDatabase } from "../../database/client.js";
import { createAuthRepository } from "../../database/auth-repository.js";
import { createMarketplaceRepository } from "../../database/marketplace-repository.js";
import { createInstitutionRepository } from "../../database/institution-repository.js";
import { createAdminRepository } from "../../database/admin-repository.js";
import { createPaymentRepository } from "../../database/payment-repository.js";
import { createLogisticsRepository } from "../../database/logistics-repository.js";
import { createRealtimeRepository } from "../../database/realtime-repository.js";
import { createAuthService } from "./auth-service.js";
import { createMarketplaceService } from "./marketplace-service.js";
import { createInstitutionService } from "./institution-service.js";
import { createAdminService } from "./admin-service.js";
import { createMarketplaceProviders } from "./marketplace-providers.js";
import { migrate } from "../../database/migrate.js";
import { resolveRuntimeEnv } from "./secrets.js";
import { createTelemetry } from "./telemetry.js";
import { createPaymentProvider } from "./payment-provider.js";
import { createPaymentService } from "./payment-service.js";
import { createLogisticsProvider } from "./logistics-provider.js";
import { createLogisticsService } from "./logistics-service.js";
import { createRealtimeService } from "./realtime-service.js";
import { createAccountConsentService } from "./account-consent-service.js";
import { createAccountConsentRepository } from "../../database/account-consent-repository.js";
import { createDonationService } from "./donation-service.js";
import { createDonationRepository } from "../../database/donation-repository.js";
import { createInstitutionAccessService } from "./institution-access-service.js";
import { createInstitutionAccessRepository } from "../../database/institution-access-repository.js";
import { createReviewModerationService } from "./review-moderation-service.js";
import { createReviewModerationRepository } from "../../database/review-moderation-repository.js";
import { createPrivacyRequestService } from './privacy-request-service.js';
import { createPrivacyRequestRepository } from '../../database/privacy-request-repository.js';
import { createAddressChangeService } from './address-change-service.js';
import { createModerationService } from './moderation-service.js';
import { createCommunicationsService } from './communications-service.js';
import { createModerationRepository } from '../../database/moderation-repository.js';
import { createCommunicationsRepository } from '../../database/communications-repository.js';
import { createPremiumService } from './premium-service.js';
import { createPremiumRepository } from '../../database/premium-repository.js';
import { createOperationalControlRepository } from '../../database/operational-control-repository.js';
import { createOperationalControlService } from './operational-control.js';
import { createOperationalIncidentRepository } from '../../database/operational-incident-repository.js';
import { createOperationalIncidentService } from './operational-incident-service.js';
import { createStaffAccessRepository } from '../../database/staff-access-repository.js';
import { createStaffAccessService } from './staff-access-service.js';
import { createAdultDeclarationRepository } from '../../database/adult-declaration-repository.js';
import { createAdultDeclarationService } from './adult-declaration-service.js';
import { createChildProfileRepository } from '../../database/child-profile-repository.js';
import { createChildProfileService } from './child-profile-service.js';
import { createExchangeRepository } from '../../database/exchange-repository.js';
import { createExchangeService } from './exchange-service.js';
import { createCourierEligibilityRepository } from '../../database/courier-eligibility-repository.js';
import { createCourierEligibilityService } from './courier-eligibility-service.js';
import { createCourierEligibilityMaintenanceWorker } from './courier-eligibility-maintenance.js';
import { createCourierEligibilityMaintenanceLoop } from './courier-eligibility-maintenance-loop.js';
import { createPilotInvitationRepository } from '../../database/pilot-invitation-repository.js';
import { createPilotInvitationService } from './pilot-invitation-service.js';
import { createManufacturerCatalogRepository } from '../../database/manufacturer-catalog-repository.js';
import { createManufacturerCatalogService } from './manufacturer-catalog-service.js';
import { loadLegalTerms } from './legal-terms.js';
import { createPostalCodeService } from './postal-code-service.js';
import { createResponsibleProfileChangeRepository } from '../../database/responsible-profile-change-repository.js';
import { createResponsibleProfileChangeService } from './responsible-profile-change-service.js';
import { createAccountStepUpRepository } from '../../database/account-step-up-repository.js';
import { createAccountStepUpService } from './account-step-up-service.js';
import { createAccountClosureRepository } from '../../database/account-closure-repository.js';
import { createAccountClosureService } from './account-closure-service.js';
import { createDataExportRepository } from '../../database/data-export-repository.js';
import { createDataExportService } from './data-export-service.js';
import { createDataExportCollector } from '../../database/data-export-collector.js';
import { createDataExportArtifactService } from './data-export-artifact-service.js';
import { createDisabledDataExportStorage } from './data-export-storage.js';
import { createAsaasWebhookRepository } from '../../database/asaas-webhook-repository.js';
import { createAsaasWebhookService } from './asaas-webhook-service.js';
import { createAsaasClient } from './asaas-client.js';
import { createPremiumSubscriptionRepository } from '../../database/premium-subscription-repository.js';
import { createPremiumSubscriptionService } from './premium-subscription-service.js';
import { createDeliveryQuoteRepository } from '../../database/delivery-quote-repository.js';
import { createDeliveryQuoteService } from './delivery-quote-service.js';
import {createLalamoveClient} from './lalamove-client.js';
import {createLalamoveQuoteAdapter} from './lalamove-quote-adapter.js';
import {createDeliveryQuoteOrchestrator} from '../../packages/contracts/delivery-quote-orchestrator.js';
import {createRegisteredCourierQuoteAdapter} from './registered-courier-quote-adapter.js';
import {createCourierQuoteRepository} from '../../database/courier-quote-repository.js';
import {createLoggiQuoteClient} from './loggi-quote-client.js';
import {createLoggiQuoteAdapter} from './loggi-quote-adapter.js';
import {createUberDirectQuoteClient} from './uber-direct-quote-client.js';
import {createUberDirectQuoteAdapter} from './uber-direct-quote-adapter.js';
import {createGoogleMapsClient} from './google-maps-client.js';
import {createIncidentRoleRepository} from '../../database/incident-role-repository.js';
import {createIncidentRoleService} from './incident-role-service.js';

export async function startRuntime(config = null) {
  if (!config) config = loadConfig(await resolveRuntimeEnv());
  const database = createDatabase(config);
  await migrate(database);
  const legalTerms = await loadLegalTerms();
  const addressGeocoder=config.googleMapsGeocodingEnabled?createGoogleMapsClient({apiKey:config.googleMapsApiKey}):null;
  if (config.responsibleRegistrationEnabled && legalTerms.status !== 'active') {
    await database.close();
    throw new Error('Responsible registration requires active, professionally approved Terms of Use');
  }
  const authService = createAuthService(createAuthRepository(database), {
    sessionTtlSeconds: config.sessionTtlSeconds,
    pilotBh: config.pilotBh,
    responsibleRegistration: {
      enabled: config.responsibleRegistrationEnabled,
      cpfHmacSecret: config.responsibleCpfHmacSecret,
      terms: legalTerms,
      postalCodeService: createPostalCodeService(),
      addressGeocoder,
    },
  });
  const moderationRepository = createModerationRepository(database);
  const donationService = createDonationService(createDonationRepository(database,{pilotBh:config.pilotBh}));
  const institutionAccessService = createInstitutionAccessService(createInstitutionAccessRepository(database));
  const reviewModerationService = createReviewModerationService(createReviewModerationRepository(database),moderationRepository);
  const moderationService = createModerationService(moderationRepository);
  const communicationsService = createCommunicationsService(createCommunicationsRepository(database),moderationRepository);
  const marketplaceProviders = createMarketplaceProviders(config);
  const marketplaceService = createMarketplaceService(createMarketplaceRepository(database),moderationRepository,marketplaceProviders,
    {pilotBh:config.pilotBh,cursorSecret:config.sessionSecret});
  const premiumService = createPremiumService(createPremiumRepository(database));
  const accountConsentService = createAccountConsentService(createAccountConsentRepository(database));
  const institutionService = createInstitutionService(createInstitutionRepository(database),{pilotBh:config.pilotBh});
  const adminService = createAdminService(createAdminRepository(database),marketplaceProviders, { reviewSecret: config.sessionSecret });
  const accountStepUpRepository = createAccountStepUpRepository(database);
  const operationalControlService = createOperationalControlService(createOperationalControlRepository(database,{stepUpRepository:accountStepUpRepository}));
  const operationalIncidentService = createOperationalIncidentService(createOperationalIncidentRepository(database));
  const incidentRoleService=createIncidentRoleService(createIncidentRoleRepository(database,{stepUpRepository:accountStepUpRepository}));
  const adultDeclarationService = createAdultDeclarationService(createAdultDeclarationRepository(database));
  const childProfileService = createChildProfileService(createChildProfileRepository(database), { featureEnabled: config.childProfilesEnabled });
  const pilotInvitationService = createPilotInvitationService(createPilotInvitationRepository(database));
  const manufacturerCatalogService = createManufacturerCatalogService(createManufacturerCatalogRepository(database));
  const responsibleProfileChangeService = createResponsibleProfileChangeService(
    createResponsibleProfileChangeRepository(database),
  );
  const accountStepUpService = createAccountStepUpService(accountStepUpRepository);
  const staffAccessService=createStaffAccessService(createStaffAccessRepository(database,{stepUpRepository:accountStepUpRepository}));
  const accountClosureService = createAccountClosureService(
    createAccountClosureRepository(database,{stepUpRepository:accountStepUpRepository}),
  );
  const dataExportRepository = createDataExportRepository(database,{stepUpRepository:accountStepUpRepository});
  const dataExportStorage = createDisabledDataExportStorage();
  const dataExportService = createDataExportService(dataExportRepository,{artifactService:createDataExportArtifactService({
    repository:dataExportRepository,collector:createDataExportCollector(database),storage:dataExportStorage,
  })});
  const asaasWebhookService=config.asaasEnabled?createAsaasWebhookService(createAsaasWebhookRepository(database),{accessToken:config.asaasWebhookAccessToken}):null;
  const asaasClient=createAsaasClient({enabled:config.asaasEnabled,apiKey:config.asaasApiKey,environment:config.asaasEnvironment});
  const premiumSubscriptionService=config.asaasEnabled?createPremiumSubscriptionService(
    createPremiumSubscriptionRepository(database),asaasClient,{cpfHmacSecret:config.responsibleCpfHmacSecret},
  ):null;
  const lalamoveClient=config.lalamoveQuotingEnabled?createLalamoveClient({key:config.lalamoveApiKey,secret:config.lalamoveApiSecret,environment:config.lalamoveEnvironment}):null;
  const loggiQuoteClient=config.loggiQuotingEnabled?createLoggiQuoteClient({endpoint:config.loggiQuoteProviderUrl,secret:config.loggiQuoteProviderSecret}):null;
  const uberDirectQuoteClient=config.uberDirectQuotingEnabled?createUberDirectQuoteClient({endpoint:config.uberDirectQuoteProviderUrl,secret:config.uberDirectQuoteProviderSecret}):null;
  const deliveryQuoteOrchestrator=createDeliveryQuoteOrchestrator({quoters:{
    lalamove:createLalamoveQuoteAdapter({client:lalamoveClient,enabled:config.lalamoveQuotingEnabled}),
    fraldacycle_courier:createRegisteredCourierQuoteAdapter({repository:createCourierQuoteRepository(database),enabled:config.registeredCourierQuotingEnabled}),
    loggi_express:createLoggiQuoteAdapter({client:loggiQuoteClient,enabled:config.loggiQuotingEnabled}),
    uber_direct:createUberDirectQuoteAdapter({client:uberDirectQuoteClient,enabled:config.uberDirectQuotingEnabled}),
  }});
  const deliveryQuoteService=createDeliveryQuoteService(createDeliveryQuoteRepository(database),{orchestrator:deliveryQuoteOrchestrator,checkoutEnabled:config.deliveryQuoteCheckoutEnabled,routeClient:addressGeocoder});
  const exchangeService = createExchangeService(createExchangeRepository(database,{pilotBh:config.pilotBh}));
  const courierEligibilityRepository = createCourierEligibilityRepository(database);
  const courierEligibilityService = createCourierEligibilityService(
    courierEligibilityRepository, {
      featureEnabled: config.courierEligibilityEnabled,
      retentionPolicy: config.courierEligibilityEnabled ? {
        status: 'approved',
        version: config.courierClearanceRetentionPolicyVersion,
        legalApproverId: config.courierClearanceRetentionLegalApproverId,
      } : null,
    },
  );
  const courierEligibilityMaintenance = config.courierEligibilityEnabled
    ? createCourierEligibilityMaintenanceLoop({
      repository: courierEligibilityRepository,
      worker: createCourierEligibilityMaintenanceWorker(courierEligibilityRepository),
      intervalMs: config.courierEligibilityMaintenanceSeconds * 1000,
      onError(error) { console.error('Courier eligibility maintenance failed', error); },
    })
    : null;
  const paymentProvider = createPaymentProvider(config);
  const paymentService = createPaymentService(createPaymentRepository(database,{stepUpRepository:accountStepUpRepository}), paymentProvider, {
    cpfHmacSecret: config.responsibleCpfHmacSecret,
  });
  const logisticsProvider = createLogisticsProvider(config);
  const logisticsRepository = createLogisticsRepository(database,{pilotBh:config.pilotBh});
  const logisticsService = createLogisticsService(logisticsRepository, logisticsProvider, marketplaceProviders,{pilotBh:config.pilotBh,courierOffersRequired:config.courierEligibilityEnabled,addressGeocoder});
  const privacyRequestService = createPrivacyRequestService(createPrivacyRequestRepository(database));
  const addressChangeService = createAddressChangeService(logisticsRepository.addressChanges);
  const realtimeService = createRealtimeService(createRealtimeRepository(database));
  const telemetry = createTelemetry(config);
  const server = createApiServer({
    config,
    readiness: () => database.readiness(),
    authService,
    marketplaceService,
    premiumService,
    premiumSubscriptionService,
    moderationService,
    communicationsService,
    accountConsentService,
    marketplaceProviders,
    institutionService,
    paymentService,
    paymentProvider,
    logisticsService,
    addressChangeService,
    privacyRequestService,
    reviewModerationService,
    institutionAccessService,
    donationService,
    logisticsProvider,
    adminService,
    realtimeService,
    operationalControlService,
    operationalIncidentService,
    incidentRoleService,
    staffAccessService,
    adultDeclarationService,
    childProfileService,
    exchangeService,
    courierEligibilityService,
    pilotInvitationService,
    manufacturerCatalogService,
    responsibleProfileChangeService,
    accountStepUpService,
    accountClosureService,
    dataExportService,
    asaasWebhookService,
    deliveryQuoteService,
    telemetry,
  });

  server.listen(config.port, config.host, () => {
    console.log(`FraldaCycle API: http://${config.host}:${config.port}`);
    courierEligibilityMaintenance?.start();
  });

  async function shutdown(signal) {
    console.log(`Stopping FraldaCycle API after ${signal}`);
    courierEligibilityMaintenance?.stop();
    server.close(async () => {
      await database.close();
      process.exitCode = 0;
    });
  }
  process.once("SIGTERM", () => shutdown("SIGTERM"));
  process.once("SIGINT", () => shutdown("SIGINT"));
  return { server, database, courierEligibilityMaintenance };
}

if (isMainModule(import.meta.url)) {
  startRuntime().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
