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

export type RenderedMarkdown = {
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
  const html = String(await processor.process(markdown));

  return {
    html,
    hasMath: html.includes('class="katex"'),
    hasMermaid: html.includes('<pre class="mermaid">'),
  };
}
