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

async function beginPurchase(listing, itemUnits, button, feedback) {
  if (button.disabled) return;
  const availableUnits = availablePackageUnits(listing);
  if (listing.status !== 'published' || listing.kind !== 'sale' ||
      !Number.isInteger(itemUnits) || itemUnits < 1 || itemUnits > availableUnits) {
    feedback.textContent = 'Quantidade indisponível. Atualize o anúncio e tente novamente.';
    return;
  }
  button.disabled = true;
  button.textContent = 'Iniciando operação…';
  feedback.textContent = '';
  try {
    const result = await apiRequest(`/v1/listings/${encodeURIComponent(listing.id)}/transactions`, { method: 'POST', body: { itemUnits } });
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

// The database constrains package stock to 1..5. A malformed or missing
// availability response must never create an unbounded selector or permit a purchase.
function availablePackageUnits(listing) {
  const value = listing.available_units??listing.stock_units;
  return Number.isInteger(value) && value >= 0 && value <= 5 ? value : 0;
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
    article.append(element('p', condition + ' · ' + (listing.size ?? 'Tamanho não informado') + ' · ' + Number(listing.quantity) + ' fraldas por pacote'));
    const availableUnits=availablePackageUnits(listing);
    article.append(element('p',availableUnits===1?'1 pacote disponível':`${availableUnits} pacotes disponíveis`,'muted'));
    if (listing.kind === 'donation') {
      article.append(element('p', 'Doações são encaminhadas à instituição indicada. Pacotes abertos só são aceitos quando as unidades estão sem uso e a higiene foi confirmada.', 'notice'));
      if (listing.institution_name) article.append(element('p', 'Instituição destinatária: ' + listing.institution_name));
    } else {
      article.append(element('p', listing.description));
      article.append(element('p', [listing.city, listing.state].filter(Boolean).join(', ') || 'Localização não informada', 'muted'));
      article.append(element('strong', money(listing.price_cents, listing.kind), 'price'));
    }

    const feedback = element('p', '', 'field-error');
    feedback.setAttribute('role', 'status');
    feedback.setAttribute('aria-live', 'polite');
    if (listing.status === 'published' && listing.kind === 'sale' && availableUnits > 0) {
      const quantityLabel=element('label','Quantidade de pacotes','form-group');
      const selector=document.createElement('select');selector.className='input';selector.setAttribute('aria-label','Quantidade de pacotes');
      for(let units=1;units<=availableUnits;units++){const option=document.createElement('option');option.value=String(units);option.textContent=String(units);selector.append(option)}
      quantityLabel.append(selector);article.append(quantityLabel);
      const button = element('button', 'Continuar para pagamento', 'button primary block');
      button.type = 'button';
      button.addEventListener('click', () => void beginPurchase(listing, Number(selector.value), button, feedback));
      article.append(button);
    } else if (listing.status === 'published' && listing.kind === 'exchange' && availableUnits > 0) {
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
