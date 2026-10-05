import { ServiceError } from './service-error.js';
import { loadLegalTerms } from './legal-terms.js';
import { validateOperationalPreferences } from './operational-preferences.js';
export function createAccountConsentService(repository,termsLoader=loadLegalTerms) {
  return Object.freeze({
    operationalPreferences(userId){return repository.operationalPreferences(userId);},
    saveOperationalPreferences(userId,input){return repository.saveOperationalPreferences(userId,validateOperationalPreferences(input));},
    marketingPreferences(userId){return repository.marketingPreferences(userId);},
    async saveMarketingPreferences(userId,input){
      if(!input||['email','sms','push'].some(key=>typeof input[key]!=='boolean')||Object.keys(input).some(key=>!['email','sms','push'].includes(key))) {
        throw new ServiceError('invalid_marketing_preferences',422,'Informe escolhas separadas para e-mail, SMS e notificações.');
      }
      return repository.saveMarketingPreferences(userId,input);
    },
    terms(){return termsLoader();},
    termsHistory(userId){return repository.termsHistory(userId);},
    async acceptTerms(userId,input){
      const terms=await termsLoader();
      if(terms.status!=='active')throw new ServiceError('terms_not_active',409,'Termos pré-operacionais ainda aguardam revisão e ativação.');
      if(input?.accepted!==true||input?.version!==terms.version||input?.contentHash!==terms.contentHash) {
        throw new ServiceError('terms_acceptance_mismatch',422,'Consulte a versão atual e confirme explicitamente o aceite.');
      }
      return repository.acceptTerms(userId,terms);
    },
  });
}
