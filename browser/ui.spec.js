import { test, expect } from '@playwright/test';
import { transform } from '../src/core.js';

const script = `
'use strict';
const state = { count: 0 };
const button = document.querySelector('#increment');
const render = () => {
  document.querySelector('#count').textContent = state.count;
  document.querySelector('#count').dataset.parity = state.count % 2 ? 'odd' : 'even';
};
button.addEventListener('click', () => { state.count += 1; render(); });
document.querySelector('form').addEventListener('submit', event => {
  event.preventDefault();
  const input = document.querySelector('input').value;
  document.querySelector('#greeting').textContent = 'Hello, ' + input + '!';
  localStorage.setItem('name', input);
});
const theme = document.querySelector('#theme');
theme.addEventListener('click', () => document.body.classList.toggle('dark'));
window.fixture = { state, render, named: function NamedHandler() {}, arrow: () => 42 };
render();
`;
const html = module => `<!doctype html><html><head><meta charset="utf-8"><style>
body { font: 18px sans-serif; margin:40px; background:white; color:#182030; }
body.dark { background:#182030; color:white; } button,input { font:inherit; padding:12px; }
[data-parity="odd"] { color:#aa3377; } section { padding:24px; border:2px solid #728095; }
</style></head><body><section><h1>Release compatibility fixture</h1>
<button id="increment">Increment</button><output id="count">0</output>
<form><label>Name <input name="name" required></label><button>Greet</button></form>
<p id="greeting">Ready</p><button id="theme">Toggle theme</button></section>
<script ${module ? 'type="module"' : ''} src="/app.js"></script></body></html>`;

for (const module of [false, true]) for (const mangle of [false, true]) {
  test(`UI parity: module=${module}, mangle=${mangle}, 64 decoys`, async ({ browser }) => {
    const { code } = await transform(script, { module, mangle, decoys: 64 });
    const snapshots = [];
    for (const source of [script, code]) {
      const context = await browser.newContext({ viewport: { width: 900, height: 650 } });
      try {
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.route('https://fixture.test/**', route => route.fulfill({
          contentType: route.request().url().endsWith('app.js') ? 'application/javascript' : 'text/html',
          body: route.request().url().endsWith('app.js') ? source : html(module)
        }));
        await page.goto('https://fixture.test/');
        await expect(page.locator('#count')).toHaveText('0');
        const initial = await page.screenshot();
        await page.getByRole('button', { name: 'Increment' }).click();
        await page.getByRole('button', { name: 'Increment' }).press('Enter');
        await expect(page.locator('#count')).toHaveText('2');
        await page.getByRole('textbox', { name: 'Name' }).fill('Ada <&> 🚀');
        await page.getByRole('button', { name: 'Greet', exact: true }).click();
        await expect(page.locator('#greeting')).toHaveText('Hello, Ada <&> 🚀!');
        await page.getByRole('button', { name: 'Toggle theme' }).click();
        await page.getByRole('heading').click();
        expect(errors).toEqual([]);
        snapshots.push({ initial, final: await page.screenshot(), state: await page.evaluate(() => ({
          dom: document.body.querySelector('section').outerHTML,
          color: getComputedStyle(document.body).backgroundColor,
          stored: localStorage.getItem('name'), count: window.fixture.state.count,
          named: window.fixture.named.name, arrow: window.fixture.arrow.name
        })) });
      } finally { await context.close(); }
    }
    expect(snapshots[1].state).toEqual(snapshots[0].state);
    expect(snapshots[1].initial.equals(snapshots[0].initial)).toBe(true);
    expect(snapshots[1].final.equals(snapshots[0].final)).toBe(true);
  });
}
