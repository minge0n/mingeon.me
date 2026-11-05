<script lang="ts">
  import { version } from '$app/environment';
  import { site } from '$lib/site';

  type Props = {
    title?: string;
    description?: string;
    path: string;
    type?: 'website' | 'article';
    imagePath?: string;
    imageAlt?: string;
    publishedTime?: string;
    tags?: Array<string>;
  };

  let {
    title,
    description = site.description,
    path,
    type = 'website',
    imagePath = '/og.png',
    imageAlt,
    publishedTime,
    tags = [],
  }: Props = $props();

  let fullTitle = $derived(title === undefined ? site.title : `${title} | ${site.title}`);
  let url = $derived(new URL(path, site.url).href);
  let alt = $derived(imageAlt ?? title ?? site.title);
  let image = $derived.by(() => {
    const imageUrl = new URL(imagePath, site.url);
    imageUrl.searchParams.set('v', version);

    return imageUrl.href;
  });
</script>

<svelte:head>
  <title>{fullTitle}</title>
  <meta name="description" content={description} />
  <meta name="author" content={site.title} />
  <link rel="canonical" href={url} />

  <meta property="og:url" content={url} />
  <meta property="og:type" content={type} />
  <meta property="og:site_name" content={site.title} />
  <meta property="og:locale" content="ko_KR" />
  <meta property="og:title" content={title ?? site.title} />
  <meta property="og:description" content={description} />
  <meta property="og:image" content={image} />
  <meta property="og:image:type" content="image/png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content={alt} />

  {#if type === 'article'}
    {#if publishedTime !== undefined}
      <meta property="article:published_time" content={publishedTime} />
    {/if}
    {#each tags as tag (tag)}
      <meta property="article:tag" content={tag} />
    {/each}
  {/if}

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content={title ?? site.title} />
  <meta name="twitter:description" content={description} />
  <meta name="twitter:image" content={image} />
  <meta name="twitter:image:alt" content={alt} />
</svelte:head>
