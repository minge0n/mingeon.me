import { listPosts, listTags } from '$lib/server/posts';
import { site } from '$lib/site';
import type { RequestHandler } from './$types';

export const prerender = true;

export const GET: RequestHandler = () => {
  const paths = [
    '/',
    '/tags',
    ...listPosts().map((post) => `/${post.slug}`),
    ...listTags().map((tag) => `/tags/${tag.slug}`),
  ];
  const urls = paths.map((path) => `<url><loc>${new URL(path, site.url).href}</loc></url>`).join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`;

  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
