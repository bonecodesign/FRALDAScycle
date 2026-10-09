import { apiRequest } from "/packages/contracts/api-client.js";
import { notify } from "/packages/ui/notify.js";

const host = document.querySelector('#main .phone-content');
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

function profileRows(items, list, reload) {
  list.innerHTML = items.map(item => `<article class="phone-card" data-child-profile="${item.id}"><div><strong>${escape(item.label || 'Perfil infantil')}</strong><p>Data privada: ${escape(item.birthDate)} · faixa: ${escape(item.ageBand)} · versão ${item.version}</p><label>Apelido<input class="input" name="label" maxlength="50" value="${escape(item.label || '')}"></label><label>Data de nascimento<input class="input" name="birthDate" type="date" value="${escape(item.birthDate)}"></label><div class="action-pair"><button class="button secondary" type="button" data-correct>Corrigir</button><button class="button text" type="button" data-remove>Remover e parar personalização</button></div></div></article>`).join('');
  list.querySelectorAll('[data-child-profile]').forEach(article => {
    const item = items.find(value => value.id === article.dataset.childProfile);
    article.querySelector('[data-correct]').addEventListener('click', async event => {
      event.currentTarget.disabled = true;
      try { await apiRequest(`/v1/account/child-profiles/${item.id}`, { method: 'PUT', body: { label: article.querySelector('[name="label"]').value.trim() || null, birthDate: article.querySelector('[name="birthDate"]').value, expectedVersion: item.version } }); await reload(); notify('Perfil infantil corrigido'); }
      catch (error) { event.currentTarget.disabled = false; notify(error.message); }
    });
    article.querySelector('[data-remove]').addEventListener('click', async event => {
      event.currentTarget.disabled = true;
      try { await apiRequest(`/v1/account/child-profiles/${item.id}`, { method: 'DELETE', body: { confirmed: true, expectedVersion: item.version } }); await reload(); notify('Perfil removido e personalização interrompida'); }
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
  section.innerHTML = '<h2>Perfis infantis e ofertas por idade</h2><p>A data fica privada. A personalização recebe somente a faixa etária derivada.</p><form id="child-profile-create"><label>Apelido opcional<input class="input" name="label" maxlength="50"></label><label>Data de nascimento<input class="input" name="birthDate" type="date" required></label><label class="terms"><input name="consent" type="checkbox" required> Autorizo o uso da data para calcular a faixa etária.</label><label class="terms"><input name="personalization" type="checkbox" required> Quero receber ofertas adequadas à faixa etária dentro da plataforma.</label><button class="button primary block" type="submit">Adicionar perfil</button><small class="field-error" role="alert"></small></form><div data-child-profile-list></div>';
  host.append(section);
  const list = section.querySelector('[data-child-profile-list]');
  const reload = async () => { const { items } = await apiRequest('/v1/account/child-profiles'); profileRows(items, list, reload); };
  profileRows(initial.items, list, reload);
  section.querySelector('form').addEventListener('submit', async event => {
    event.preventDefault(); const form = event.currentTarget; const button = form.querySelector('button'); button.disabled = true;
    try {
      await apiRequest('/v1/account/child-profiles', { method: 'POST', body: { label: form.elements.label.value.trim() || null, birthDate: form.elements.birthDate.value, consentConfirmed: form.elements.consent.checked, consentVersion: 'FC-CHILD-PROFILE-1', personalizationEnabled: form.elements.personalization.checked } });
      form.reset(); await reload(); notify('Perfil infantil adicionado com consentimento');
    } catch (error) { button.disabled = false; form.querySelector('.field-error').textContent = error.message; }
  });
}

adultPanel().then(declared => { if (declared) return childProfilesPanel(); });
