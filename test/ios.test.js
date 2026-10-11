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

// Geometry models a mobile shell with a header and footer. This is a simulated
// visual viewport; it deliberately does not claim to emulate WebKit's keyboard.
function keyboardFixture() {
  const listeners = {};
  const values = new Map();
  const attributes = new Set();
  const frames = new Map();
  let sequence = 0;
  const root = {
    clientHeight: 844,
    style: { setProperty: (name, value) => values.set(name, value), removeProperty: (name) => values.delete(name) },
    setAttribute: name => attributes.add(name),
    removeAttribute: name => attributes.delete(name),
  };
  const viewport = {
    height: 844, offsetTop: 0, scale: 1,
    addEventListener: (name, fn) => { listeners[`viewport:${name}`] = fn; },
  };
  const main = {
    scrollTop: 0,
    getBoundingClientRect: () => {
      const top = Number.parseFloat(values.get('--editing-top') || 0);
      const height = Number.parseFloat(values.get('--editing-height') || root.clientHeight);
      return { top: top + 56, bottom: top + height - 150 };
    },
  };
  const field = {
    contentTop: 44,
    matches: () => true,
    closest: () => main,
    getBoundingClientRect: () => {
      const top = main.getBoundingClientRect().top + field.contentTop - main.scrollTop;
      return { top, bottom: top + 44 };
    },
  };
  const win = {
    mobile: true,
    matchMedia: () => ({ matches: win.mobile }),
    visualViewport: viewport,
    document: {
      activeElement: field, documentElement: root,
      addEventListener: (name, fn) => { listeners[`document:${name}`] = fn; },
    },
    requestAnimationFrame: fn => { frames.set(++sequence, fn); return sequence; },
    cancelAnimationFrame: id => frames.delete(id),
  };
  const flush = () => { const pending = [...frames.values()]; frames.clear(); pending.forEach(fn => fn()); };
  const emit = (event, defer = false) => { listeners[event](); if (!defer) flush(); };
  trackKeyboardViewport(win);
  return { win, root, viewport, main, field, values, attributes, emit, flush };
}

function assertVisible(fixture) {
  const { field, main, viewport } = fixture;
  const rect = field.getBoundingClientRect();
  const bounds = main.getBoundingClientRect();
  assert.ok(rect.top >= Math.max(bounds.top, viewport.offsetTop));
  assert.ok(rect.bottom <= Math.min(bounds.bottom, viewport.offsetTop + viewport.height));
}

test('panned keyboard viewport aligns the shell with the visible top and bottom', () => {
  const f = keyboardFixture();
  f.viewport.height = 430;
  f.viewport.offsetTop = 200;
  // The old handler left this input above offsetTop and a 200px bottom gap.
  f.emit('viewport:resize');
  assert.equal(f.values.get('--editing-top'), '200px');
  assert.equal(f.values.get('--editing-height'), '430px');
  assert.ok(f.attributes.has('data-keyboard-viewport'));
  assert.equal(parseFloat(f.values.get('--editing-top')) + parseFloat(f.values.get('--editing-height')), 630);
  assertVisible(f);
  assert.equal(f.main.scrollTop, 0, 'already-visible field should not jump');
});

test('viewport scroll follows offset changes without undoing manual content scrolling', () => {
  const f = keyboardFixture();
  f.viewport.height = 430;
  f.emit('viewport:resize');
  f.main.scrollTop = 350;
  f.viewport.offsetTop = 180;
  f.emit('viewport:scroll');
  assert.equal(f.values.get('--editing-top'), '180px');
  assert.equal(f.main.scrollTop, 350);
  f.viewport.offsetTop = 0;
  f.emit('viewport:scroll');
  assert.equal(f.values.get('--editing-top'), '0px');
  assert.equal(f.main.scrollTop, 350);
});

test('repeated focus and keyboard resizing reveal top and bottom inputs without repeated jumps', () => {
  const f = keyboardFixture();
  f.viewport.height = 430;
  for (const contentTop of [700, 44, 1900, 44]) {
    f.field.contentTop = contentTop;
    f.emit('document:focusin');
    assertVisible(f);
    const scrollTop = f.main.scrollTop;
    f.emit('document:focusin');
    f.emit('viewport:resize');
    assert.equal(f.main.scrollTop, scrollTop);
  }
  f.field.contentTop = 1900;
  f.emit('document:focusin');
  f.viewport.height = 360;
  f.emit('viewport:resize');
  assertVisible(f);
});

test('keyboard dismissal, blur, zoom, desktop and non-shell fields release overrides', () => {
  for (const release of [
    f => { f.viewport.height = 844; f.viewport.offsetTop = 0; },
    f => { f.win.document.activeElement = null; },
    f => { f.viewport.scale = 2; },
    f => { f.win.mobile = false; },
    f => { f.field.closest = () => null; },
  ]) {
    const f = keyboardFixture();
    f.viewport.height = 430; f.viewport.offsetTop = 200;
    f.emit('document:focusin');
    const scrollTop = f.main.scrollTop;
    release(f);
    f.emit('viewport:resize');
    assert.equal(f.values.size, 0);
    assert.equal(f.attributes.size, 0);
    assert.equal(f.main.scrollTop, scrollTop);
  }
  const normal = keyboardFixture();
  normal.emit('document:focusin');
  assert.equal(normal.values.size, 0, 'normal mobile viewport stays in document flow');
  assert.doesNotThrow(() => trackKeyboardViewport({}));
});

test('coalesced viewport scroll cannot cancel a pending focus reveal', () => {
  const f = keyboardFixture();
  f.viewport.height = 430;
  f.field.contentTop = 1900;
  f.emit('document:focusin', true);
  f.viewport.offsetTop = 200;
  f.emit('viewport:scroll', true);
  f.flush();
  assertVisible(f);
});

test('blur releases the fixed shell without changing the content scroll position', () => {
  const f = keyboardFixture();
  f.viewport.height = 430;
  f.field.contentTop = 700;
  f.emit('document:focusin');
  const scrollTop = f.main.scrollTop;
  f.win.document.activeElement = null;
  f.emit('document:focusout');
  assert.equal(f.attributes.size, 0);
  assert.equal(f.values.size, 0);
  assert.equal(f.main.scrollTop, scrollTop);
});
