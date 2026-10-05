import { loadConfig } from "./config.js";
import { isMainModule } from "../../packages/contracts/main-module.js";
import { createApiServer } from "./server.js";
import { createDatabase } from "../../database/client.js";
import { createAuthRepository } from "../../database/auth-repository.js";
import { createNotificationRepository } from "../../database/notification-repository.js";
import { createMarketplaceRepository } from "../../database/marketplace-repository.js";
import { createInstitutionRepository } from "../../database/institution-repository.js";
import { createAdminRepository } from "../../database/admin-repository.js";
import { createPaymentRepository } from "../../database/payment-repository.js";
import { createLogisticsRepository } from "../../database/logistics-repository.js";
import { createRealtimeRepository } from "../../database/realtime-repository.js";
import { createAuthService } from "./auth-service.js";
import { createNotificationService } from "./notifications.js";
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

export async function startRuntime(config = null) {
  if (!config) config = loadConfig(await resolveRuntimeEnv());
  const database = createDatabase(config);
  await migrate(database);
  const notificationService = createNotificationService(createNotificationRepository(database));
  const authService = createAuthService(createAuthRepository(database), {
    sessionTtlSeconds: config.sessionTtlSeconds,
    notificationService,
  });
  const moderationRepository = createModerationRepository(database);
  const donationService = createDonationService(createDonationRepository(database));
  const institutionAccessService = createInstitutionAccessService(createInstitutionAccessRepository(database));
  const reviewModerationService = createReviewModerationService(createReviewModerationRepository(database),moderationRepository);
  const moderationService = createModerationService(moderationRepository);
  const communicationsService = createCommunicationsService(createCommunicationsRepository(database),moderationRepository);
  const marketplaceService = createMarketplaceService(createMarketplaceRepository(database),moderationRepository);
  const premiumService = createPremiumService(createPremiumRepository(database));
  const accountConsentService = createAccountConsentService(createAccountConsentRepository(database));
  const institutionService = createInstitutionService(createInstitutionRepository(database));
  const marketplaceProviders = createMarketplaceProviders(config);
  const adminService = createAdminService(createAdminRepository(database));
  const paymentProvider = createPaymentProvider(config);
  const paymentService = createPaymentService(createPaymentRepository(database), paymentProvider);
  const logisticsProvider = createLogisticsProvider(config);
  const logisticsRepository = createLogisticsRepository(database);
  const logisticsService = createLogisticsService(logisticsRepository, logisticsProvider, marketplaceProviders);
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
    telemetry,
  });

  server.listen(config.port, config.host, () => {
    console.log(`FraldaCycle API: http://${config.host}:${config.port}`);
  });

  async function shutdown(signal) {
    console.log(`Stopping FraldaCycle API after ${signal}`);
    server.close(async () => {
      await database.close();
      process.exitCode = 0;
    });
  }
  process.once("SIGTERM", () => shutdown("SIGTERM"));
  process.once("SIGINT", () => shutdown("SIGINT"));
  return { server, database };
}

if (isMainModule(import.meta.url)) {
  startRuntime().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
