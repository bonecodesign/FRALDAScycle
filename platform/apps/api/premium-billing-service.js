import { validatePremiumBillingEvent } from '../../packages/contracts/premium-billing-event.js';
export function createPremiumBillingService(repository,{clock=Date.now}={}){return Object.freeze({applyReconciled(input){return repository.apply(validatePremiumBillingEvent(input,{now:clock()}));}});}
