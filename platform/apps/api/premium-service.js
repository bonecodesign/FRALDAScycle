import { ServiceError } from './service-error.js';
export function createPremiumService(repository) {
  return Object.freeze({
    status(userId) { return repository.status(userId); },
    cancelRenewal(userId, input) {
      if (!input || input.confirmed !== true || Object.keys(input).some(key => key !== 'confirmed')) throw new ServiceError('premium_confirmation_required', 422, 'Confirme o cancelamento da próxima renovação.');
      return repository.cancelRenewal(userId);
    },
    saveChoice(userId, input) {
      if (!input || Object.keys(input).some(key => !['selectedIds','expectedVersion'].includes(key)) ||
        !Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 0 || !Array.isArray(input.selectedIds) ||
        input.selectedIds.length > 3 || new Set(input.selectedIds).size !== input.selectedIds.length ||
        input.selectedIds.some(id => typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))) {
        throw new ServiceError('premium_invalid_choice', 422, 'Escolha até três anúncios e informe a versão atual.');
      }
      return repository.saveChoice(userId, input);
    },
    regularize(userId, input) {
      if (!input || input.confirmed !== true || Object.keys(input).some(key => key !== 'confirmed')) throw new ServiceError('premium_confirmation_required', 422, 'Confirme a aplicação do limite gratuito.');
      return repository.regularize(userId);
    },
    changeListingStatus(userId, input) {
      if (!input || Object.keys(input).some(key => !['listingId','status','expectedStatus'].includes(key)) ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.listingId || '') ||
        !['published','paused'].includes(input.status) || !['published','paused'].includes(input.expectedStatus)) {
        throw new ServiceError('invalid_listing_status', 422, 'Informe anúncio e estado de publicação válidos.');
      }
      return repository.changeListingStatus(userId, input);
    },
  });
}
