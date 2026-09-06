import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { trackKeyboardViewport } from '../public/viewport.js';

const publicFile = (name) => new URL(`../public/${name}`, import.meta.url);

test('home-screen configuration covers all app routes and supplies valid PNG icons', async () => {
  const html = await readFile(publicFile('index.html'), 'utf8');
  const manifest = JSON.parse(await readFile(publicFile('manifest.webmanifest'), 'utf8'));
  assert.match(html, /rel="manifest" href="\/manifest.webmanifest"/);
  assert.match(html, /viewport-fit=cover/);
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.id, '/');
  assert.equal(manifest.start_url, '/');
  assert.equal(manifest.scope, '/');
  for (const icon of [...manifest.icons, { src: '/icons/apple-touch-icon.png', sizes: '180x180' }]) {
    const png = await readFile(publicFile(icon.src.slice(1)));
    assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`, icon.sizes);
  }
});

test('keyboard resize keeps the edited field above the footer and releases sizing on blur or zoom', () => {
  const handlers = {};
  const values = new Map();
  const main = { scrollTop: 0, getBoundingClientRect: () => ({ top: 56, bottom: 260 }) };
  const field = { matches: () => true, closest: () => main, getBoundingClientRect: () => ({ top: 250, bottom: 294 }) };
  const win = {
    visualViewport: { height: 430, scale: 1, addEventListener: (name, fn) => { handlers[name] = fn; } },
    document: {
      activeElement: field,
      documentElement: { style: { setProperty: (name, value) => values.set(name, value), removeProperty: (name) => values.delete(name) } },
      addEventListener: (name, fn) => { handlers[name] = fn; },
    },
    requestAnimationFrame: (fn) => { fn(); return 1; },
    cancelAnimationFrame: () => {},
  };
  trackKeyboardViewport(win);
  handlers.resize();
  assert.equal(values.get('--editing-height'), '430px');
  assert.equal(main.scrollTop, 52);
  win.visualViewport.scale = 2;
  handlers.resize();
  assert.equal(values.has('--editing-height'), false);
  win.visualViewport.scale = 1;
  handlers.focusin();
  win.document.activeElement = null;
  handlers.focusout();
  assert.equal(values.has('--editing-height'), false);
  assert.doesNotThrow(() => trackKeyboardViewport({}));
});
