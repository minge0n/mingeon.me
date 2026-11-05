import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer } from 'vite';

/** @type {import('vite').ViteDevServer | undefined} */
let server;
let html = '';
let head = '';

before(async () => {
  server = await createServer({
    server: { middlewareMode: true },
    appType: 'custom',
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  const { default: Layout } = await server.ssrLoadModule('/src/routes/+layout.svelte');
  const { render } = await server.ssrLoadModule('svelte/server');
  const rendered = render(Layout, { props: { children: () => '' } });
  html = rendered.body;
  head = rendered.head;
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

test('global styles use a build-specific URL so cached pages receive new CSS', () => {
  assert.match(head, /<link\b[^>]*href="\/global\.css\?v=[^"\s]+"[^>]*>/);
});

test('table of contents follows actual heading IDs, nesting and duplicate slugs', async () => {
  assert.ok(server);
  const { renderMarkdown } = await server.ssrLoadModule('/src/lib/server/markdown.ts');
  const result = await renderMarkdown(
    '# Title\n\n## Setup `init_boot`\n\n### **Key** check\n\n#### Hidden detail\n\n## Setup `init_boot`\n\n```md\n## Not a heading\n```',
  );
  assert.deepEqual(result.toc, [
    { id: 'setup-init_boot', title: 'Setup init_boot', children: [{ id: 'key-check', title: 'Key check' }] },
    { id: 'setup-init_boot-1', title: 'Setup init_boot', children: [] },
  ]);
  assert.match(result.html, /id="setup-init_boot-1"/);
});

test('posts without section headings have no table of contents', async () => {
  assert.ok(server);
  const { renderMarkdown } = await server.ssrLoadModule('/src/lib/server/markdown.ts');
  assert.deepEqual((await renderMarkdown('A short post.')).toc, []);
});

test('concurrent Markdown renders do not share table of contents entries', async () => {
  assert.ok(server);
  const { renderMarkdown } = await server.ssrLoadModule('/src/lib/server/markdown.ts');
  const [first, second] = await Promise.all([renderMarkdown('## First'), renderMarkdown('## Second')]);
  assert.deepEqual(first.toc, [{ id: 'first', title: 'First', children: [] }]);
  assert.deepEqual(second.toc, [{ id: 'second', title: 'Second', children: [] }]);
});

test('post pages render section navigation with the mobile disclosure initially closed', async () => {
  assert.ok(server);
  const { renderMarkdown } = await server.ssrLoadModule('/src/lib/server/markdown.ts');
  const { default: PostPage } = await server.ssrLoadModule('/src/routes/[slug]/+page.svelte');
  const { render } = await server.ssrLoadModule('svelte/server');
  const data = {
    post: { title: 'Post', slug: 'post', date: '2026-11-05', description: '', tags: [] },
    ...(await renderMarkdown('## Setup\n\n### Verify')),
  };
  const rendered = render(PostPage, { props: { data } }).body;
  assert.match(rendered, /<nav\b[^>]*aria-label="글 목차"/);
  assert.match(rendered, /href="#setup"/);
  assert.match(rendered, /href="#verify"/);
  const disclosure = rendered.match(/<details\b[^>]*>/)?.[0];
  assert.ok(disclosure);
  assert.doesNotMatch(disclosure, /\bopen(?:[\s=>])/);
});

test('article sharing metadata uses the post image and complete image information', async () => {
  assert.ok(server);
  const { default: Meta } = await server.ssrLoadModule('/src/lib/components/Meta.svelte');
  const { render } = await server.ssrLoadModule('svelte/server');
  const rendered = render(Meta, {
    props: {
      title: '안드로이드 설치 기록',
      description: '서명과 부팅을 확인한 기록.',
      path: '/android',
      type: 'article',
      imagePath: '/og/android.png',
      publishedTime: '2026-11-05',
      tags: ['Android', '개발'],
    },
  }).head;
  assert.match(rendered, /property="og:image" content="https:\/\/mingeon\.me\/og\/android\.png\?v=[^"]+"/);
  assert.match(rendered, /property="og:image:width" content="1200"/);
  assert.match(rendered, /property="og:image:height" content="630"/);
  assert.match(rendered, /property="og:image:type" content="image\/png"/);
  assert.match(rendered, /property="og:site_name" content="Mingeon Kim"/);
  assert.match(rendered, /property="og:locale" content="ko_KR"/);
  assert.match(rendered, /property="article:published_time" content="2026-11-05"/);
  assert.match(rendered, /property="article:tag" content="Android"/);
  assert.match(rendered, /name="twitter:image:alt" content="안드로이드 설치 기록"/);
});

test('homepage sharing retains a site card and does not invent article dates', async () => {
  assert.ok(server);
  const { default: Meta } = await server.ssrLoadModule('/src/lib/components/Meta.svelte');
  const { render } = await server.ssrLoadModule('svelte/server');
  const rendered = render(Meta, { props: { path: '/' } }).head;
  assert.match(rendered, /property="og:image" content="https:\/\/mingeon\.me\/og\.png\?v=[^"]+"/);
  assert.doesNotMatch(rendered, /article:published_time/);
});

test('draft cards use the public site fallback rather than an unpublished image URL', async () => {
  assert.ok(server);
  const { findPost } = await server.ssrLoadModule('/src/lib/server/posts.ts');
  assert.equal(findPost('markdown-guide').ogImage, '/og.png');
  assert.equal(findPost('toss-front2-android').ogImage, '/og/toss-front2-android.png');
});
