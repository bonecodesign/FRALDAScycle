import "/packages/ui/iconography.js";
import { apiRequest } from "/packages/contracts/api-client.js";
import { money } from "/packages/contracts/marketplace-ui.js";

const target = document.getElementById('app-listing-content');
const listingId = new URL(location.href).searchParams.get('id');
const statusLabels = { published: 'Disponível', unavailable: 'Indisponível', completed: 'Finalizado' };

function element(tag, value, className) {
  const node = document.createElement(tag);
  node.textContent = value;
  if (className) node.className = className;
  return node;
}

function showError(message) {
  target.replaceChildren(element('p', message, 'notice'));
}

async function beginPurchase(listing, button, feedback) {
  button.disabled = true;
  button.textContent = 'Iniciando operação…';
  feedback.textContent = '';
  try {
    const result = await apiRequest(`/v1/listings/${encodeURIComponent(listing.id)}/transactions`, { method: 'POST', body: {} });
    if (!result.transaction?.id || result.transaction.status !== 'initiated') throw new Error('A operação não foi confirmada. Tente carregar o anúncio novamente.');
    sessionStorage.setItem('fc.activeTransactionId', result.transaction.id);
    sessionStorage.removeItem('fc.paymentIntentId');
    window.location.assign('/app/payment');
  } catch (error) {
    if (error.status === 401) {
      window.location.assign('/app/login');
      return;
    }
    feedback.textContent = error.message || 'Não foi possível iniciar esta compra.';
    button.disabled = false;
    button.textContent = 'Continuar para pagamento';
  }
}

async function loadListing() {
  if (!listingId) return showError('Anúncio não selecionado. Volte à busca e escolha um item disponível.');
  try {
    const { listing } = await apiRequest(`/v1/listings/${encodeURIComponent(listingId)}`);
    if (!listing) return showError('Anúncio não encontrado.');
    const article = document.createElement('article');
    article.append(element('span', listing.kind === 'sale' ? 'Venda' : listing.kind === 'exchange' ? 'Troca' : 'Doação', 'badge'));
    article.append(element('h1', listing.title));
    article.append(element('p', statusLabels[listing.status] ?? 'Estado não informado', 'notice'));
    const condition = listing.package_condition === 'sealed'
      ? 'Pacote fechado'
      : listing.kind === 'donation' && listing.package_condition === 'open' ? 'Pacote aberto' : 'Condição não confirmada';
    article.append(element('p', condition + ' · ' + (listing.size ?? 'Tamanho não informado') + ' · ' + Number(listing.quantity) + ' unidades'));
    if (listing.kind === 'donation') {
      article.append(element('p', 'Doações são encaminhadas à instituição indicada. Pacotes abertos só são aceitos quando as unidades estão sem uso e a higiene foi confirmada.', 'notice'));
      if (listing.institution_name) article.append(element('p', 'Instituição destinatária: ' + listing.institution_name));
    } else {
      article.append(element('p', listing.description));
      article.append(element('p', [listing.city, listing.state].filter(Boolean).join(', ') || 'Localização não informada', 'muted'));
      article.append(element('strong', money(listing.price_cents, listing.kind), 'price'));
    }

    const feedback = element('p', '', 'field-error');
    if (listing.status === 'published' && listing.kind === 'sale') {
      const button = element('button', 'Continuar para pagamento', 'button primary block');
      button.type = 'button';
      button.addEventListener('click', () => void beginPurchase(listing, button, feedback));
      article.append(button);
    } else if (listing.status === 'published' && listing.kind === 'exchange') {
      const link = element('a', 'Escolher meu anúncio para propor a troca', 'button primary block');
      link.href = `/app/exchange?requestedListingId=${encodeURIComponent(listing.id)}`;
      article.append(link);
    } else if (listing.kind !== 'donation') {
      article.append(element('p', 'Este anúncio não está disponível para iniciar outra operação.', 'notice'));
    }
    article.append(feedback);
    target.replaceChildren(article);
  } catch (error) {
    showError(error.message || 'Não foi possível carregar o anúncio.');
  }
}

void loadListing();
