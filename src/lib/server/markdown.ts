import rehypeShiki from '@shikijs/rehype';
import { transformerMetaHighlight, transformerNotationDiff, transformerNotationHighlight } from '@shikijs/transformers';
import type { Element, Root } from 'hast';
import { toString } from 'hast-util-to-string';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import rehypeKatex from 'rehype-katex';
import rehypeSlug from 'rehype-slug';
import rehypeStringify from 'rehype-stringify';
import remarkGfm from 'remark-gfm';
import { remarkAlert } from 'remark-github-blockquote-alert';
import remarkMath from 'remark-math';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { createCssVariablesTheme } from 'shiki';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';
import type { VFile } from 'vfile';

export type TocLink = {
  id: string;
  title: string;
};

export type TocEntry = TocLink & {
  children: Array<TocLink>;
};

export type RenderedMarkdown = {
  toc: Array<TocEntry>;
  html: string;
  hasMath: boolean;
  hasMermaid: boolean;
};

const grayscaleTheme = createCssVariablesTheme({ name: 'grayscale' });

function isMermaidCode(node: Element): boolean {
  const className = node.properties.className;

  return node.tagName === 'code' && Array.isArray(className) && className.includes('language-mermaid');
}

function rehypeMermaidPassthrough() {
  return (tree: Root): void => {
    visit(tree, 'element', (node) => {
      const code = node.children[0];
      if (node.tagName !== 'pre' || code === undefined || code.type !== 'element' || !isMermaidCode(code)) return;

      node.properties = { className: ['mermaid'] };
      node.children = [{ type: 'text', value: toString(code) }];
    });
  };
}

function rehypeTableOfContents() {
  return (tree: Root, file: VFile): void => {
    const toc: Array<TocEntry> = [];
    let parent: TocEntry | undefined;

    visit(tree, 'element', (node) => {
      if (node.tagName !== 'h2' && node.tagName !== 'h3') return;
      const id = node.properties.id;
      const title = toString(node).trim();
      if (typeof id !== 'string' || id === '' || title === '') return;

      if (node.tagName === 'h3' && parent !== undefined) {
        parent.children.push({ id, title });
      } else {
        const entry = { id, title, children: [] };
        toc.push(entry);
        parent = node.tagName === 'h2' ? entry : undefined;
      }
    });

    file.data.toc = toc;
  };
}

function parseCodeMeta(meta: string): Record<string, string> {
  const attributes: Record<string, string> = {};

  const title = meta.match(/title="([^"]*)"/);
  if (title !== null) attributes['data-title'] = title[1];
  if (/\bshowLineNumbers\b/.test(meta)) attributes['data-line-numbers'] = '';

  return attributes;
}

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkAlert)
  .use(remarkMath)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeMermaidPassthrough)
  .use(rehypeKatex)
  .use(rehypeSlug)
  .use(rehypeTableOfContents)
  .use(rehypeAutolinkHeadings, {
    behavior: 'append',
    properties: { className: ['heading-anchor'], ariaLabel: '이 제목으로 링크' },
  })
  .use(rehypeShiki, {
    theme: grayscaleTheme,
    langs: [],
    lazy: true,
    fallbackLanguage: 'text',
    defaultLanguage: 'text',
    parseMetaString: parseCodeMeta,
    transformers: [transformerNotationDiff(), transformerNotationHighlight(), transformerMetaHighlight()],
  })
  .use(rehypeStringify, { allowDangerousHtml: true });

export async function renderMarkdown(markdown: string): Promise<RenderedMarkdown> {
  const result = await processor.process(markdown);
  const html = String(result);

  return {
    toc: (result.data.toc as Array<TocEntry>) ?? [],
    html,
    hasMath: html.includes('class="katex"'),
    hasMermaid: html.includes('<pre class="mermaid">'),
  };
}
