import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { renderSafeErrorState } from '../packages/contracts/safe-error-state.js';
import { renderListingCard } from '../packages/contracts/marketplace-ui.js';

class FakeElement {
  constructor(document, tag) {
    this.ownerDocument = document;
    this.tagName = tag.toUpperCase();
    this.attributes = {};
    this.children = [];
    this.listeners = {};
    this.textContent = '';
  }
  set innerHTML(_) { throw new Error('Unsafe HTML insertion on API error surface'); }
  setAttribute(key, value) { this.attributes[key] = value; }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; }
  addEventListener(type, callback, options) { this.listeners[type] = { callback, options }; }
}

function target() {
  const document = { createElement(tag) { return new FakeElement(document, tag); } };
  return new FakeElement(document, 'section');
}

test('FC-357: untrusted API error content is displayed as plain text with a screen-reader alert', () => {
  const root = target();
  const malicious = '<img src=x onerror="alert(1)"><script>attack()</script>';
  let retryCalls = 0;
  const panel = renderSafeErrorState(root, {
    heading: 'Não foi possível buscar',
    message: malicious,
    onRetry() { retryCalls += 1; },
  });
  assert.equal(root.children.length, 1);
  assert.equal(root.children[0], panel);
  assert.equal(panel.className, 'ui-state error-state');
  assert.equal(panel.attributes.role, 'alert');
  assert.equal(panel.children.length, 3);
  assert.equal(panel.children[0].tagName, 'H2');
  assert.equal(panel.children[0].textContent, 'Não foi possível buscar');
  assert.equal(panel.children[1].tagName, 'P');
  assert.equal(panel.children[1].textContent, malicious);
  assert.equal(panel.children[2].tagName, 'BUTTON');
  assert.equal(panel.children[2].type, 'button');
  assert.equal(panel.children[2].listeners.click.options.once, true);
  panel.children[2].listeners.click.callback();
  assert.equal(retryCalls, 1);
});

test('FC-357: malformed/oversize errors fail safe and never inject markup', () => {
  for (const value of [undefined, null, {}, 42, '']) {
    const root = target();
    const panel = renderSafeErrorState(root, { message: value });
    assert.equal(panel.children[1].textContent, 'Tente novamente em instantes.');
    assert.equal(panel.children.length, 2);
  }
  const root = target();
  const message = '<svg/onload=alert(1)>'.repeat(100);
  const panel = renderSafeErrorState(root, { message });
  assert.equal(panel.children[1].textContent, message.slice(0, 320));
  assert.equal(panel.attributes.role, 'alert');
});

test('FC-357: listing attributes escape API-controlled identifiers before writing markup', () => {
  const id = 'synthetic" onpointerenter="alert(1)';
  const listing = {
    id, title: '<img src=x onerror=alert(1)>', brand: 'generic',
    kind: 'sale', status: 'published', package_condition: 'sealed',
    size: 'M', quantity: 30, price_cents: 3790,
  };
  for (const surface of ['site','app']) {
    const html = renderListingCard(listing, surface);
    assert.match(html, /data-live-listing="synthetic&quot; onpointerenter=&quot;alert\(1\)"/);
    assert.doesNotMatch(html, /data-live-listing="synthetic" onpointerenter="/);
    assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
    assert.doesNotMatch(html, /<img src=x onerror=alert\(1\)>/);
    if (surface === 'app') {
      assert.match(html, /data-live-favorite="synthetic&quot; onpointerenter=&quot;alert\(1\)"/);
    }
  }
});

test('FC-357: both home and app search use safe error state rather than error HTML interpolation', async () => {
  const [home, marketplace] = await Promise.all([
    readFile(new URL('../apps/app/home.js', import.meta.url), 'utf8'),
    readFile(new URL('../packages/contracts/marketplace-ui.js', import.meta.url), 'utf8'),
  ]);
  assert.match(home, /renderSafeErrorState\(target/);
  assert.match(marketplace, /renderSafeErrorState\(results/);
  assert.doesNotMatch(home, /innerHTML\s*=\s*[^\n]*\$\{error\??\.message\}/);
  assert.doesNotMatch(marketplace, /innerHTML\s*=\s*[^\n]*\$\{error\??\.message\}/);
});
