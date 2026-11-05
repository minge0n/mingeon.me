import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer } from 'vite';

/** @type {import('vite').ViteDevServer | undefined} */
let server;
let html = '';

before(async () => {
  server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
  const { default: Layout } = await server.ssrLoadModule('/src/routes/+layout.svelte');
  const { render } = await server.ssrLoadModule('svelte/server');
  html = render(Layout, { props: { children: () => '' } }).body;
});

after(async () => {
  await server?.close();
});

test('RSS uses a document navigation instead of the catch-all post route', () => {
  const rssLink = html.match(/<a\b[^>]*href="\/rss\.xml"[^>]*>/)?.[0];
  assert.ok(rssLink);
  assert.match(rssLink, /\bdata-sveltekit-reload(?:[\s=>])/);
});

test('normal blog pages retain client-side navigation', () => {
  const tagsLink = html.match(/<a\b[^>]*href="\/tags"[^>]*>/)?.[0];
  assert.ok(tagsLink);
  assert.doesNotMatch(tagsLink, /\bdata-sveltekit-reload/);
});
