import { listPosts } from '$lib/server/posts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
  return { posts: listPosts() };
};
