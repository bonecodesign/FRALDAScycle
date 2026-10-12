import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { bindResponsiveSiteNavigation } from '../packages/contracts/site-navigation.js';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

class FakeElement {
  attributes = new Map();
  dataset = {};
  listeners = new Map();
  constructor(documentObject, { visible = true } = {}) {
    this.documentObject = documentObject;
    this.visible = visible;
  }
  addEventListener(name, listener) { this.listeners.set(name, listener); }
  removeEventListener(name) { this.listeners.delete(name); }
  setAttribute(name, value) { this.attributes.set(name, value); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  getClientRects() { return this.visible ? [{}] : []; }
  focus() { this.documentObject.activeElement = this; }
  dispatch(name, event = {}) { this.listeners.get(name)?.(event); }
}

function fixture() {
  const documentObject = {
    activeElement: null,
    listeners: new Map(),
    addEventListener(name, listener) { this.listeners.set(name, listener); },
    removeEventListener(name) { this.listeners.delete(name); },
    dispatch(name, event) { this.listeners.get(name)?.(event); },
  };
  const button = new FakeElement(documentObject);
  const links = Array.from({ length: 3 }, () => new FakeElement(documentObject));
  const navigation = new FakeElement(documentObject);
  navigation.querySelector = () => links[0];
  navigation.querySelectorAll = () => links;
  const theme = new FakeElement(documentObject);
  const primaryAction = new FakeElement(documentObject);
  const media = {
    matches: true,
    listeners: new Map(),
    addEventListener(name, listener) { this.listeners.set(name, listener); },
    removeEventListener(name) { this.listeners.delete(name); },
    change(matches) { this.matches = matches; this.listeners.get('change')?.({ matches }); },
  };
  const windowObject = { matchMedia: () => media };
  const cleanup = bindResponsiveSiteNavigation({
    button,
    navigation,
    getFocusables: () => [button, ...links, theme, primaryAction],
    windowObject,
    documentObject,
  });
  return { button, links, navigation, theme, primaryAction, media, documentObject, cleanup };
}

test('Site home offers a responsive accessible menu and donation deep link', async () => {
  const [home, css, search, marketplace, runtime, help] = await Promise.all([
    read('../apps/site/index.html'),
    read('../apps/site/home.css'),
    read('../apps/site/search.html'),
    read('../packages/contracts/marketplace-ui.js'),
    read('../apps/site/home.js'),
    read('../apps/site/help.html'),
  ]);
  assert.match(home, /id="site-menu-toggle"[^>]*aria-controls="site-navigation"[^>]*aria-expanded="false"/);
  assert.match(home, /id="site-navigation"[^>]*aria-label="Navegação principal"/);
  const navigation = home.match(/<nav class="site-navigation"[^>]*>(.*?)<\/nav>/)?.[1] ?? '';
  assert.deepEqual([...navigation.matchAll(/<a href="[^"]+">([^<]+)<\/a>/g)].map(([, label]) => label), [
    'Como funciona', 'Categorias', 'Anunciar', 'Doações', 'Ajuda',
  ]);
  assert.match(home, /href="\/site\/search\?kind=donation">Doações<\/a>/);
  const footer = home.match(/<div class="site-footer-groups">([\s\S]*?)<\/div><small>/)?.[1] ?? '';
  assert.deepEqual([...footer.matchAll(/<nav class="site-footer-group" aria-label="([^"]+)"/g)].map(([, label]) => label), [
    'Plataforma', 'Institucional', 'Suporte', 'Conta',
  ]);
  for (const href of ['/site/home#categorias', '/site/search?kind=donation', '/site/help#canais', '/site/help#politicas', '/app/privacy', '/app/register']) {
    assert.ok(footer.includes(`href="${href}"`), `Home footer link missing: ${href}`);
  }
  assert.match(help, /id="politicas"/);
  assert.match(help, /Termos e privacidade em revisão/);
  assert.match(help, /id="canais"/);
  assert.match(help, /canais oficiais e prazos de resposta ainda não foram definidos/);
  assert.match(home, /class="button primary site-mobile-publish" href="\/site\/publish">Publicar<\/a>/);
  assert.match(css, /@media \(max-width: 991px\)/);
  assert.match(css, /\.site-navigation\[data-open="true"\]/);
  assert.match(css, /min-height: 44px/);
  assert.match(runtime, /bindResponsiveSiteNavigation/);
  assert.match(search, /id="site-filter-kind"/);
  assert.match(search, /id="site-filter-category"/);
  assert.match(search, /id="site-filter-size"/);
  assert.match(marketplace, /requested\.get\('category'\)/);
  assert.match(marketplace, /requested\.get\('kind'\)/);
  assert.match(marketplace, /kind: kindFilter\?\.value/);
  assert.match(marketplace, /category: categoryFilter\?\.value/);
  assert.match(marketplace, /size: sizeFilter\?\.value/);
});

test('customer Site pages load one shared footer and retain their own status note', async () => {
  const pages = ['index', 'help', 'impact', 'login', 'publish', 'search', 'detail', 'favorites', 'seller'];
  const documents = await Promise.all(pages.map(page => read(`../apps/site/${page}.html`)));
  for (const [index, document] of documents.entries()) {
    assert.match(document, /<footer class="site-footer/);
    assert.match(document, /src="\/apps\/site\/footer\.js"/);
    assert.ok(document.includes('site-footer'), `${pages[index]} has no footer host`);
  }
  const [footer, css] = await Promise.all([
    read('../apps/site/footer.js'),
    read('../apps/site/footer.css'),
  ]);
  for (const label of ['Plataforma', 'Institucional', 'Suporte', 'Conta']) assert.match(footer, new RegExp(`aria-label="${label}"`));
  assert.match(footer, /footer\.querySelector\('small'\)/);
  assert.match(footer, /escapeHtml\(pageNote\)/);
  assert.match(footer, /Termos e privacidade \(em revisão\)/);
  assert.match(documents[1], /canais oficiais e prazos de resposta ainda não foram definidos/);
  assert.match(css, /grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(css, /@media \(max-width: 575px\)/);
});

test('mobile Site navigation opens with focus, traps Tab, closes on link/Escape and restores focus', () => {
  const state = fixture();
  state.button.dispatch('click');
  assert.equal(state.button.getAttribute('aria-expanded'), 'true');
  assert.equal(state.navigation.dataset.open, 'true');
  assert.equal(state.documentObject.activeElement, state.links[0]);

  state.primaryAction.focus();
  let prevented = false;
  state.documentObject.dispatch('keydown', { key: 'Tab', shiftKey: false, preventDefault: () => { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(state.documentObject.activeElement, state.button);

  state.button.focus();
  prevented = false;
  state.documentObject.dispatch('keydown', { key: 'Tab', shiftKey: true, preventDefault: () => { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(state.documentObject.activeElement, state.primaryAction);

  state.documentObject.dispatch('keydown', { key: 'Escape', preventDefault() {} });
  assert.equal(state.button.getAttribute('aria-expanded'), 'false');
  assert.equal(state.navigation.dataset.open, 'false');
  assert.equal(state.documentObject.activeElement, state.button);
  state.cleanup();
});

test('mobile Site navigation closes after choosing a destination or leaving the mobile breakpoint', () => {
  const state = fixture();
  state.button.dispatch('click');
  state.navigation.dispatch('click', { target: { closest: () => state.links[1] } });
  assert.equal(state.button.getAttribute('aria-expanded'), 'false');

  state.button.dispatch('click');
  state.media.change(false);
  assert.equal(state.button.getAttribute('aria-expanded'), 'false');
  assert.equal(state.navigation.dataset.open, 'false');
  state.cleanup();
});
