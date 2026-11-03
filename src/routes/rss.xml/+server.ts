import { listPosts } from '$lib/server/posts';
import { site } from '$lib/site';
import type { RequestHandler } from './$types';

export const prerender = true;

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

export const GET: RequestHandler = () => {
  const items = listPosts()
    .map((post) => {
      const url = new URL(`/${post.slug}`, site.url).href;
      const categories = post.tags.map((tag) => `<category>${escapeXml(tag.name)}</category>`).join('');

      return `<item><title>${escapeXml(post.title)}</title><link>${url}</link><guid>${url}</guid><pubDate>${new Date(post.date).toUTCString()}</pubDate><description>${escapeXml(post.description)}</description>${categories}</item>`;
    })
    .join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>${escapeXml(site.title)}</title><link>${site.url}</link><description>${escapeXml(site.description)}</description><language>ko</language><atom:link href="${site.url}/rss.xml" rel="self" type="application/rss+xml"/>${items}</channel></rss>`;

  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
};
