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
  const [home, css, search, marketplace, runtime] = await Promise.all([
    read('../apps/site/index.html'),
    read('../apps/site/home.css'),
    read('../apps/site/search.html'),
    read('../packages/contracts/marketplace-ui.js'),
    read('../apps/site/home.js'),
  ]);
  assert.match(home, /id="site-menu-toggle"[^>]*aria-controls="site-navigation"[^>]*aria-expanded="false"/);
  assert.match(home, /id="site-navigation"[^>]*aria-label="Navegação principal"/);
  const navigation = home.match(/<nav class="site-navigation"[^>]*>(.*?)<\/nav>/)?.[1] ?? '';
  assert.deepEqual([...navigation.matchAll(/<a href="[^"]+">([^<]+)<\/a>/g)].map(([, label]) => label), [
    'Como funciona', 'Categorias', 'Anunciar', 'Doações', 'Ajuda',
  ]);
  assert.match(home, /href="\/site\/search\?kind=donation">Doações<\/a>/);
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
