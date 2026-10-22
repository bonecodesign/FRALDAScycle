import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('design system exposes the normative typography, geometry, motion and accessibility tokens', async () => {
  const tokens = await read('../packages/ui/tokens.css');
  for (const contract of [
    '--fc-font-interface: Inter',
    '--fc-font-display: Poppins',
    '--fc-space-1: 4px',
    '--fc-radius-md: 8px',
    '--fc-shadow-md:',
    '--fc-focus-ring:',
    '--fc-target-min: 44px',
    '--fc-motion-fast: 150ms',
    '--fc-motion-slow: 300ms',
    'prefers-reduced-motion: reduce',
  ]) assert.match(tokens, new RegExp(contract.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('visual conformity matrix covers every normative requirement and the complete board range', async () => {
  const matrix = await read('../docs/visual-fidelity/MATRIZ_CONFORMIDADE_VISUAL.md');
  for (const prefix of ['DS-01', 'DS-05', 'ST-01', 'ST-05', 'AP-01', 'AP-08', 'AD-01', 'AD-06', 'RG-01', 'RG-02']) {
    assert.match(matrix, new RegExp(`\\| ${prefix} \\|`));
  }
  assert.match(matrix, /Page6\.png` a `FraldaCycle_Acervopng_Page68\.png/);
});

test('design-system laboratories disclose examples and do not claim certification or persistence', async () => {
  const [home, accessibility, advanced, responsive] = await Promise.all([
    read('../apps/site/home.js'),
    read('../apps/site/accessibility-lab.js'),
    read('../apps/site/advanced-components.js'),
    read('../apps/site/responsive-lab.js'),
  ]);
  assert.match(home, /Documentação visual interativa/);
  assert.match(home, /não representam operações realizadas nem certificação/);
  assert.match(accessibility, /Não auditado/);
  assert.match(accessibility, /A verificar/);
  assert.match(accessibility, /requer auditoria independente/);
  assert.match(advanced, /nenhum envio foi realizado/);
  assert.match(advanced, /Ação visual sem persistência/);
  assert.match(responsive, /previsto para verificação/);
});

test('authentication and publishing do not present local bypasses or persisted drafts', async () => {
  const [auth, verify, publish] = await Promise.all([
    read('../apps/app/auth.js'),
    read('../apps/app/verify.html'),
    read('../apps/site/publish.js'),
  ]);
  assert.doesNotMatch(auth, /LOCAL_DEMO/);
  assert.doesNotMatch(verify, /99900-0000|value="[1-6]"/);
  assert.match(publish, /Rascunho apenas nesta sessão/);
  assert.match(publish, /podem ser perdidos ao sair/);
});

test('site follows the normative institutional navigation and hero contract', async () => {
  const [html, script] = await Promise.all([
    read('../apps/site/index.html'),
    read('../apps/site/home.js'),
  ]);
  for (const label of ['Como funciona', 'Categorias', 'Anunciar', 'Impacto', 'Ajuda']) assert.match(html, new RegExp(label));
  assert.doesNotMatch(html, /class="surface-switcher"/);
  assert.match(script, /Conectamos famílias/);
  assert.match(script, /Reduzimos desperdícios/);
  assert.match(script, /Transformamos vidas/);
  assert.match(script, /Começar agora/);
  assert.match(script, /Saiba mais/);
  assert.match(script, /sem uso e com higiene confirmada/);
  assert.match(script, /site-category-section/);
  assert.match(script, /Recém-nascido/);
  assert.match(script, /site-donation/);
  for (const rule of ['Fraldas sem uso', 'Higiene confirmada', 'Embalagem protegida']) assert.match(script, new RegExp(rule));
});

test('project keeps an explicit internal founder and ownership record', async () => {
  const ownership = await read('../../OWNERSHIP.md');
  assert.match(ownership, /Rafael Sérgio Silveira/);
  assert.match(ownership, /bonecodesign/);
  assert.match(ownership, /criador, idealizador, fundador e titular/);
  assert.match(ownership, /não substitui registros públicos, contratos ou aconselhamento jurídico/);
});

test('app preserves five mobile destinations with one SVG icon family', async () => {
  const [appHome, appRuntime] = await Promise.all([
    read('../apps/app/home.html'),
    read('../apps/app/auth.js'),
  ]);
  const phoneNav = appHome.match(/<nav class="phone-nav"[\s\S]*?<\/nav>/)?.[0] ?? '';

  assert.equal((phoneNav.match(/<a /g) ?? []).length, 5);
  for (const label of ['Início', 'Buscar', 'Publicar', 'Chat', 'Perfil']) {
    assert.match(phoneNav, new RegExp(`>${label}<\\/a>`));
  }
  assert.match(appRuntime, /function setupAppIconography\(\)/);
  assert.match(appRuntime, /class="fc-icon"/);
  assert.match(appRuntime, /link\.setAttribute\("aria-current", "page"\)/);
  assert.match(appRuntime, /setupAppIconography\(\);/);
});

test('admin preserves the approved route architecture with one accessible SVG icon family', async () => {
  const [dashboard, adminRuntime, navigation] = await Promise.all([
    read('../apps/admin/index.html'),
    read('../apps/admin/core.js'),
    read('../apps/admin/navigation.js'),
  ]);
  const sidebar = dashboard.match(/<nav class="admin-sidebar"[\s\S]*?<\/nav>/)?.[0] ?? '';

  assert.ok((sidebar.match(/<a /g) ?? []).length >= 8);
  assert.match(adminRuntime, /function setupAdminIconography\(\)/);
  assert.match(adminRuntime, /const adminNavGroups=/);
  for (const group of ['Visão geral', 'Gestão', 'Financeiro', 'Inteligência', 'Estratégia', 'Sistema', 'Atalhos']) {
    assert.match(adminRuntime, new RegExp(group));
  }
  assert.match(adminRuntime, /className='admin-nav-group'/);
  assert.match(adminRuntime, /class="fc-icon admin-nav-icon"/);
  assert.match(adminRuntime, /aria-current/);
  assert.match(adminRuntime, /setupAdminIconography\(\);/);
  assert.match(navigation, /function setupAdminNavigation\(\)/);
  assert.match(navigation, /aria-current/);
  for (const entrypoint of [
    'account-management.js', 'admin-overview.js', 'governance.js', 'growth.js',
    'intelligence.js', 'security-management.js', 'truthful-operations.js',
    'support-management.js', 'moderation-management.js', 'proof-review.js',
  ]) {
    assert.match(await read(`../apps/admin/${entrypoint}`), /import ['"]\/apps\/admin\/navigation\.js['"]/);
  }
});

test('all three navigable surfaces explicitly identify their data maturity', async () => {
  const [site, appRuntime, adminRuntime] = await Promise.all([
    read('../apps/site/index.html'),
    read('../apps/app/auth.js'),
    read('../apps/admin/core.js'),
  ]);

  assert.match(site, /Ambiente pré-operacional; capacidades indisponíveis são identificadas/);
  assert.match(appRuntime, /function setupSyntheticDataDisclosure\(\)/);
  assert.match(appRuntime, /Dados sintéticos · demonstração local/);
  assert.match(appRuntime, /setupSyntheticDataDisclosure\(\);/);
  assert.match(adminRuntime, /function setupAdminSyntheticDataDisclosure\(\)/);
  assert.match(adminRuntime, /Dados sintéticos · ambiente demonstrativo/);
  assert.match(adminRuntime, /setupAdminSyntheticDataDisclosure\(\);/);
});

test('shared SVG iconography reaches every independent platform entrypoint', async () => {
  const runtime = await read('../packages/ui/iconography.js');
  for (const contract of ['function setupAppIcons', 'function setupAdminIcons', 'function setupSiteIcons', 'class="fc-icon']) {
    assert.match(runtime, new RegExp(contract.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }

  const entrypoints = [
    '../apps/admin/auth.js',
    '../apps/app/auth.js', '../apps/app/courier.js', '../apps/app/favorites.js', '../apps/app/finance.js',
    '../apps/app/logistics.js', '../apps/app/negotiation.js', '../apps/app/profile.js', '../apps/app/publish.js', '../apps/app/search.js',
    '../apps/site/home.js', '../apps/site/detail.js', '../apps/site/favorites.js', '../apps/site/publish.js', '../apps/site/search.js',
  ];
  for (const entrypoint of entrypoints) {
    assert.match(await read(entrypoint), /import "\/packages\/ui\/iconography\.js";/, `${entrypoint} must load shared SVG iconography`);
  }
});

test('visual conformity matrix links every normative source inside the repository', async () => {
  const matrix = await read('../docs/visual-fidelity/MATRIZ_CONFORMIDADE_VISUAL.md');
  const sources = [
    'FRALDACYcle_Auditoria_Visual_Final_e_Comando_Codex_v1.md',
    'FRALDACYcle_Design_System_Consolidado_v1.md',
    'FRALDACYcle_Especificacao_Fidelidade_Visual_Site_v1.md',
    'FRALDACYcle_Especificacao_Fidelidade_Visual_App_v1.md',
    'FRALDACYcle_Especificacao_Fidelidade_Visual_Admin_v1.md',
  ];

  for (const source of sources) {
    assert.match(matrix, new RegExp(`sources/${source.replaceAll('.', '\\.')}`));
    const content = await read(`../docs/visual-fidelity/sources/${source}`);
    assert.ok(content.length > 1_000, `${source} must preserve its complete normative content`);
  }
});
