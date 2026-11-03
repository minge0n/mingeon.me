import { error } from '@sveltejs/kit';
import { listPostsByTag, listTags } from '$lib/server/posts';
import type { EntryGenerator, PageServerLoad } from './$types';

export const entries: EntryGenerator = () => listTags().map(({ slug }) => ({ tag: slug }));

export const load: PageServerLoad = ({ params }) => {
  const tag = listTags().find(({ slug }) => slug === params.tag);
  if (tag === undefined) error(404, '태그를 찾을 수 없습니다.');

  return { tag, posts: listPostsByTag(tag.slug) };
};
