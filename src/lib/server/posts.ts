import { parse as parseYaml } from 'yaml';

export type TagRef = {
  name: string;
  slug: string;
};

export type PostMeta = {
  slug: string;
  title: string;
  date: string;
  description: string;
  tags: Array<TagRef>;
};

export type Post = PostMeta & {
  body: string;
};

export type Tag = TagRef & {
  count: number;
};

const reservedSlugs = new Set([
  'tags',
  'rss.xml',
  'sitemap.xml',
  'favicon.ico',
  'fonts',
  'og.png',
  'icon.svg',
  'global.css',
]);

const frontmatterPattern = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(frontmatter: Record<string, unknown>, key: string, file: string): string {
  const value = frontmatter[key];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${file}: frontmatter "${key}" must be a non-empty string`);
  }

  return value;
}

function readDate(frontmatter: Record<string, unknown>, file: string): string {
  const value = frontmatter.date;
  const date = value instanceof Date ? value : typeof value === 'string' ? new Date(value) : undefined;
  if (date === undefined || Number.isNaN(date.getTime())) {
    throw new Error(`${file}: frontmatter "date" must be a date like 2026-11-03`);
  }

  return date.toISOString().slice(0, 10);
}

function readTags(frontmatter: Record<string, unknown>, file: string): Array<TagRef> {
  const value = frontmatter.tags;
  if (value === undefined) return [];
  if (!Array.isArray(value) || !value.every((tag) => typeof tag === 'string')) {
    throw new Error(`${file}: frontmatter "tags" must be a list of strings`);
  }

  const tags = new Map<string, TagRef>();
  for (const name of value) {
    const trimmed = name.trim();
    const slug = trimmed.toLowerCase().replace(/\s+/g, '-');
    if (slug !== '' && !tags.has(slug)) tags.set(slug, { name: trimmed, slug });
  }

  return [...tags.values()];
}

function parsePost(file: string, source: string): Post & { draft: boolean } {
  const slug = file.replace(/^.*\/(.+)\.md$/, '$1');
  if (reservedSlugs.has(slug)) {
    throw new Error(`${file}: "${slug}" is reserved by a site route and cannot be a post slug`);
  }

  const match = source.match(frontmatterPattern);
  if (match === null) throw new Error(`${file}: missing frontmatter block`);

  const frontmatter: unknown = parseYaml(match[1]);
  if (!isRecord(frontmatter)) throw new Error(`${file}: frontmatter must be a YAML mapping`);

  return {
    slug,
    title: readString(frontmatter, 'title', file),
    date: readDate(frontmatter, file),
    description: typeof frontmatter.description === 'string' ? frontmatter.description : '',
    tags: readTags(frontmatter, file),
    draft: frontmatter.draft === true,
    body: source.slice(match[0].length),
  };
}

const sources = import.meta.glob<string>('/src/posts/*.md', { query: '?raw', import: 'default', eager: true });

const posts: Array<Post> = Object.entries(sources)
  .flatMap(([file, source]) => {
    const { draft, ...post } = parsePost(file, source);

    return draft && !import.meta.env.DEV ? [] : [post];
  })
  .sort((a, b) => b.date.localeCompare(a.date));

function toMeta({ slug, title, date, description, tags }: Post): PostMeta {
  return { slug, title, date, description, tags };
}

export function listPosts(): Array<PostMeta> {
  return posts.map(toMeta);
}

export function findPost(slug: string): Post | undefined {
  return posts.find((post) => post.slug === slug);
}

export function listTags(): Array<Tag> {
  const tags = new Map<string, Tag>();
  for (const post of posts) {
    for (const { name, slug } of post.tags) {
      const tag = tags.get(slug);
      if (tag === undefined) tags.set(slug, { name, slug, count: 1 });
      else tag.count += 1;
    }
  }

  return [...tags.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export function listPostsByTag(tagSlug: string): Array<PostMeta> {
  return listPosts().filter((post) => post.tags.some((tag) => tag.slug === tagSlug));
}
