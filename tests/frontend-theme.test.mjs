import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const html = readFileSync(new URL('../public/route2own.html', import.meta.url), 'utf8');

test('gateway uses the light visual theme and the supplied hero artwork', () => {
  assert.match(html, /ROUTE2OWN LIGHT HERO THEME/);
  assert.match(html, /--theme-navy:#071A33/);
  assert.match(html, /--theme-cyan:#22C7E6/);
  assert.match(html, /--theme-teal:#19C5B5/);
  assert.match(html, /\.main-gateway\{[^}]*linear-gradient\([^}]*#f7fbff/is);
  assert.match(html, /class="gateway-hero-visual"/);
  assert.ok(existsSync(new URL('../public/assets/route2own-gateway-hero.jpeg', import.meta.url)));
});

test('risk semantics remain mapped to green, amber and red', () => {
  assert.match(html, /--green:#0f8a5f/);
  assert.match(html, /--amber:#b7791f/);
  assert.match(html, /--red:#c83b3b/);
});

test('official TCG logo is used in the header, certificate and PDF report', () => {
  assert.ok(existsSync(new URL('../public/assets/tcg-logo.png', import.meta.url)));
  assert.match(html, /class="brand-logo"[^>]+src="\/assets\/tcg-logo\.png"/);
  assert.match(html, /class="cert-brand-logo"[^>]+src="\/assets\/tcg-logo\.png"/);
  assert.match(html, /class="report-brand-logo"[^>]+src="\/assets\/tcg-logo\.png"/);
  assert.match(html, /\.brand-logo\{[^}]*object-fit:contain/is);
});
