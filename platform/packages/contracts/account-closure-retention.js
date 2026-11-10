export const ACCOUNT_CLOSURE_RETENTION_VERSION = "FC-CLOSURE-RETENTION-1";

function count(value) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error("invalid_account_closure_inventory");
  return value;
}

export function buildAccountClosureRetentionPlan(inventory) {
  if (inventory?.classification !== "awaiting_legal_review") throw new Error("invalid_account_closure_inventory");
  return Object.freeze({
    version: ACCOUNT_CLOSURE_RETENTION_VERSION,
    policyStatus: "pending_professional_review",
    executionAllowed: false,
    automaticErasureAllowed: false,
    categories: [
      { category: "sessions", records: count(inventory.identityAndAccess?.sessions), action: "erase_after_approval", retentionDays: 0 },
      { category: "addresses", records: count(inventory.identityAndAccess?.addresses), action: "erase_after_approval", retentionDays: 0 },
      { category: "child_profiles", records: count(inventory.family?.childProfiles), action: "separate_child_policy", operationalErasure: "immediate_after_approval", backupExpiryDays: 30 },
      { category: "terms_acceptances", records: count(inventory.consents?.termsAcceptances), action: "retain_then_erase", retentionDays: 1825 },
      { category: "marketing_events", records: count(inventory.consents?.marketingEvents), action: "retain_then_erase", retentionDays: 30 },
      { category: "transactions", records: count(inventory.legalAndFinancial?.transactions), action: "retain_then_anonymize", retentionDays: 1825 },
      { category: "support_tickets", records: count(inventory.legalAndFinancial?.supportTickets), action: "classify_before_execution", commonRetentionDays: 365, financialOrLegalRetentionDays: 1825 },
      { category: "listings", records: count(inventory.marketplaceContent?.listings), action: "erase_after_holds_and_approval", retentionDays: 0 },
      { category: "listing_media", records: count(inventory.marketplaceContent?.media), action: "purge_storage_after_holds_and_approval", backupExpiryDays: 30 }
    ],
    approvedGeneralRules: {
      securityEventsRetentionDays: 365,
      navigationRetentionDays: 90,
      technicalLogsRetentionDays: 30,
      fullIpRetentionDays: 7,
      anonymousStatisticsMayRemain: true
    },
    externalDeletionReceiptsRequired: true
  });
}
