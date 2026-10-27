import { ServiceError } from './service-error.js';
import { loadLegalTerms } from './legal-terms.js';
import { validateOperationalPreferences } from './operational-preferences.js';
import { normalizeCookieConsent, normalizeMarketingConsent } from '../../packages/contracts/account-consent-policy.js';
export function createAccountConsentService(repository,termsLoader=loadLegalTerms) {
  return Object.freeze({
    operationalPreferences(userId){return repository.operationalPreferences(userId);},
    saveOperationalPreferences(userId,input){return repository.saveOperationalPreferences(userId,validateOperationalPreferences(input));},
    marketingPreferences(userId){return repository.marketingPreferences(userId);},
    async saveMarketingPreferences(userId,input){
      let consent;try{consent=normalizeMarketingConsent(input);}catch{
        throw new ServiceError('invalid_marketing_preferences',422,'Ative ou desative todas as promoções e confirme a versão do aviso.');
      }return repository.saveMarketingPreferences(userId,consent);
    },
    cookiePreferences(userId){return repository.cookiePreferences(userId);},
    async saveCookiePreferences(userId,input){let consent;try{consent=normalizeCookieConsent(input);}catch{
      throw new ServiceError('invalid_cookie_preferences',422,'Escolha análise e marketing e confirme a versão da política.');
    }return repository.saveCookiePreferences(userId,consent);},
    terms(){return termsLoader();},
    termsHistory(userId){return repository.termsHistory(userId);},
    async assertOperationalTerms(userId){const terms=await termsLoader();if(terms.status!=='active')return Object.freeze({enforced:false});if(!await repository.hasTermsAcceptance(userId,terms))throw new ServiceError('current_terms_acceptance_required',428,'Leia e aceite a versão atual dos Termos de Uso para iniciar uma nova operação.');return Object.freeze({enforced:true,accepted:true,version:terms.version});},
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
