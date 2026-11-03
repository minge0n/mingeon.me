import { error } from '@sveltejs/kit';
import { renderMarkdown } from '$lib/server/markdown';
import { findPost, listPosts } from '$lib/server/posts';
import type { EntryGenerator, PageServerLoad } from './$types';

export const entries: EntryGenerator = () => listPosts().map(({ slug }) => ({ slug }));

export const load: PageServerLoad = async ({ params }) => {
  const post = findPost(params.slug);
  if (post === undefined) error(404, '글을 찾을 수 없습니다.');

  const { body, ...meta } = post;

  return { post: meta, ...(await renderMarkdown(body)) };
};
