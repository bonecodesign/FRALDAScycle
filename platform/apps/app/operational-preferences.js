import { apiRequest } from '/packages/contracts/api-client.js';

const form = document.getElementById('operational-preferences-form');
const fields = form.querySelector('fieldset');
const schedule = document.getElementById('quiet-hours-schedule');
const status = document.getElementById('operational-feedback');
const refresh = document.getElementById('operational-refresh');
let version = null;
const channels = ['email', 'sms', 'push'];
function toggleSchedule() { schedule.disabled = !form.elements.quietEnabled.checked; }
async function load() {
  fields.disabled = true;
  refresh.disabled = true;
  version = null;
  try {
    const { preferences } = await apiRequest('/v1/account/operational-preferences');
    version = preferences.version;
    for (const channel of channels) form.elements[channel].checked = preferences.channels?.[channel] === true;
    form.elements.quietEnabled.checked = preferences.quietHours?.enabled === true;
    form.elements.start.value = preferences.quietHours?.start ?? '';
    form.elements.end.value = preferences.quietHours?.end ?? '';
    form.elements.timeZone.value = preferences.quietHours?.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
    toggleSchedule();
    fields.disabled = false;
    status.textContent = preferences.configured ? 'Preferências operacionais carregadas.' : 'Nenhuma preferência operacional registrada. Escolha os canais antes de salvar.';
  } catch (error) { status.textContent = error.message || 'Não foi possível carregar as preferências.'; }
  finally { refresh.disabled = false; }
}
form.elements.quietEnabled.addEventListener('change', toggleSchedule);
refresh.addEventListener('click', () => { void load(); });
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (version === null) return;
  const enabled = form.elements.quietEnabled.checked;
  const input = {
    expectedVersion: version,
    channels: Object.fromEntries(channels.map(channel => [channel, form.elements[channel].checked])),
    quietHours: { enabled, start: enabled ? form.elements.start.value : null, end: enabled ? form.elements.end.value : null, timeZone: form.elements.timeZone.value.trim() },
  };
  fields.disabled = true;
  refresh.disabled = true;
  try {
    const { preferences } = await apiRequest('/v1/account/operational-preferences', { method: 'PUT', body: input });
    version = preferences.version;
    form.elements.timeZone.value = preferences.quietHours.timeZone;
    fields.disabled = false;
    status.textContent = 'Preferências registradas. O envio externo continua indisponível; avisos necessários não são cancelados por estas escolhas.';
  } catch (error) {
    version = null;
    status.textContent = (error.message || 'Não foi possível salvar.') + ' Carregue novamente para conferir o estado registrado.';
  } finally { refresh.disabled = false; }
});
void load();
