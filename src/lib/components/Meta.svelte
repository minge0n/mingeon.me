<script lang="ts">
  import { site } from '$lib/site';

  type Props = {
    title?: string;
    description?: string;
    path: string;
    type?: 'website' | 'article';
  };

  let { title, description = site.description, path, type = 'website' }: Props = $props();

  let fullTitle = $derived(title === undefined ? site.title : `${title} | ${site.title}`);
  let url = $derived(new URL(path, site.url).href);
  let image = new URL('/og.png', site.url).href;
</script>

<svelte:head>
  <title>{fullTitle}</title>
  <meta name="description" content={description} />
  <link rel="canonical" href={url} />

  <meta property="og:url" content={url} />
  <meta property="og:type" content={type} />
  <meta property="og:title" content={title ?? site.title} />
  <meta property="og:description" content={description} />
  <meta property="og:image" content={image} />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content={title ?? site.title} />
  <meta name="twitter:description" content={description} />
  <meta name="twitter:image" content={image} />
</svelte:head>
