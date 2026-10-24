import { apiRequest } from "/packages/contracts/api-client.js";
import { notify } from "/packages/ui/notify.js";

const host = document.querySelector('#main .phone-content');
const profileEmojis = ['🍼', '🧸', '⭐', '🌙', '🌈'];
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

async function adultPanel() {
  if (!host) return false;
  try {
    const { declaration } = await apiRequest('/v1/account/adult-declaration');
    const section = document.createElement('section');
    section.className = 'panel';
    section.dataset.adultDeclaration = 'true';
    if (declaration.declared) {
      section.innerHTML = '<h2>Maioridade confirmada</h2><p class="notice success-notice">Declaração FC-AGE-1 registrada para esta conta.</p>';
      host.append(section);
      return true;
    }
    section.innerHTML = '<h2>Confirmar maioridade</h2><p>Esta confirmação é necessária para publicar, iniciar transações, confirmar doações ou alterar o Premium.</p><form id="adult-declaration-form"><label class="terms"><input name="confirmed" type="checkbox" required> Confirmo que tenho 18 anos ou mais.</label><button class="button primary block" type="submit">Registrar confirmação</button><small class="field-error" role="alert"></small></form>';
    host.append(section);
    section.querySelector('form').addEventListener('submit', async event => {
      event.preventDefault();
      const button = event.currentTarget.querySelector('button'); button.disabled = true;
      try {
        await apiRequest('/v1/account/adult-declaration', { method: 'PUT', body: { confirmed: true, version: 'FC-AGE-1' } });
        section.innerHTML = '<h2>Maioridade confirmada</h2><p class="notice success-notice">Declaração registrada e auditada.</p>';
        notify('Declaração de maioridade registrada');
        await childProfilesPanel();
      } catch (error) { button.disabled = false; event.currentTarget.querySelector('.field-error').textContent = error.message; }
    });
    return false;
  } catch { return false; }
}

function emojiOptions(selected, items) {
  const used = new Set(items.map(item => item.emoji));
  return profileEmojis.filter(emoji => emoji === selected || !used.has(emoji))
    .map(emoji => `<option value="${emoji}"${emoji === selected ? ' selected' : ''}>${emoji}</option>`).join('');
}

function profileRows(items, list, reload) {
  list.innerHTML = items.map((item, index) => `<article class="phone-card" data-child-profile="${item.id}"><div><strong>Perfil ${index + 1} ${escape(item.emoji)}</strong><p>Idade atual: ${escape(item.ageDisplay)} · versão ${item.version}</p><label>Emoji<select class="input" name="emoji" required>${emojiOptions(item.emoji, items)}</select></label><label>Data de nascimento<input class="input" name="birthDate" type="date" value="${escape(item.birthDate)}"></label><div class="action-pair"><button class="button secondary" type="button" data-correct>Salvar</button><button class="button text" type="button" data-remove${items.length === 1 ? ' disabled' : ''}>Excluir perfil</button></div></div></article>`).join('');
  list.querySelectorAll('[data-child-profile]').forEach(article => {
    const item = items.find(value => value.id === article.dataset.childProfile);
    article.querySelector('[data-correct]').addEventListener('click', async event => {
      event.currentTarget.disabled = true;
      try { await apiRequest(`/v1/account/child-profiles/${item.id}`, { method: 'PUT', body: { birthDate: article.querySelector('[name="birthDate"]').value, emoji: article.querySelector('[name="emoji"]').value, expectedVersion: item.version } }); await reload(); notify('Perfil infantil atualizado'); }
      catch (error) { event.currentTarget.disabled = false; notify(error.message); }
    });
    article.querySelector('[data-remove]').addEventListener('click', async event => {
      event.currentTarget.disabled = true;
      try { await apiRequest(`/v1/account/child-profiles/${item.id}`, { method: 'DELETE', body: { confirmed: true, expectedVersion: item.version } }); await reload(); notify('Perfil e data removidos do banco ativo'); }
      catch (error) { event.currentTarget.disabled = false; notify(error.message); }
    });
  });
}

async function childProfilesPanel() {
  if (!host || document.querySelector('[data-child-profiles]')) return;
  let initial;
  try { initial = await apiRequest('/v1/account/child-profiles'); }
  catch (error) { if (error.status === 404) return; return; }
  const section = document.createElement('section');
  section.className = 'panel'; section.dataset.childProfiles = 'true';
  section.innerHTML = '<h2>Perfis da família</h2><div data-child-profile-notices></div><p>Adicione de 1 a 5 perfis. Coletamos somente a data de nascimento e o emoji obrigatório. A idade ajuda a ordenar o Marketplace, sem esconder outros produtos.</p><form id="child-profile-create"><label>Emoji<select class="input" name="emoji" required><option value="">Escolha um emoji</option></select></label><label>Data de nascimento<input class="input" name="birthDate" type="date" required></label><label class="terms"><input name="consent" type="checkbox" required> Autorizo o uso da data para calcular a faixa etária.</label><label class="terms"><input name="personalization" type="checkbox" required> Autorizo a ordenação do Marketplace pela faixa etária.</label><button class="button primary block" type="submit">Adicionar perfil</button><small class="field-error" role="alert"></small></form><div data-child-profile-list></div>';
  host.append(section);
  const notices = await apiRequest('/v1/account/child-profile-notices').catch(() => ({ items: [] }));
  section.querySelector('[data-child-profile-notices]').innerHTML = notices.items.map(item => `<p class="notice">${escape(item.message)}</p>`).join('');
  const list = section.querySelector('[data-child-profile-list]');
  const form = section.querySelector('form');
  const render = items => {
    profileRows(items, list, reload);
    const used = new Set(items.map(item => item.emoji));
    form.elements.emoji.innerHTML = '<option value="">Escolha um emoji</option>' + profileEmojis.filter(emoji => !used.has(emoji)).map(emoji => `<option value="${emoji}">${emoji}</option>`).join('');
    form.querySelector('button').disabled = items.length >= 5;
  };
  const reload = async () => { const { items } = await apiRequest('/v1/account/child-profiles'); render(items); };
  render(initial.items);
  form.addEventListener('submit', async event => {
    event.preventDefault(); const form = event.currentTarget; const button = form.querySelector('button'); button.disabled = true;
    try {
      await apiRequest('/v1/account/child-profiles', { method: 'POST', body: { birthDate: form.elements.birthDate.value, emoji: form.elements.emoji.value, consentConfirmed: form.elements.consent.checked, consentVersion: 'FC-CHILD-PROFILE-1', personalizationEnabled: form.elements.personalization.checked } });
      form.reset(); await reload(); notify('Perfil infantil adicionado com consentimento');
    } catch (error) { button.disabled = false; form.querySelector('.field-error').textContent = error.message; }
  });
}

adultPanel().then(declared => { if (declared) return childProfilesPanel(); });
