import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse } from 'yaml';
import { initWasm, Resvg } from '@resvg/resvg-wasm';

const family = 'LINE Seed Sans KR';
const graphemes = new Intl.Segmenter('ko', { granularity: 'grapheme' });
const escapeXml = (value) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');

async function createRenderer(root, site) {
  await initWasm(await fs.readFile(new URL(import.meta.resolve('@resvg/resvg-wasm/index_bg.wasm'))));
  const fontBuffers = await Promise.all(
    ['Rg', 'Bd'].map((weight) => fs.readFile(path.join(root, `static/fonts/LINESeedKR-${weight}.woff2`))),
  );
  const options = { font: { fontBuffers, defaultFontFamily: family }, languages: ['ko', 'en'] };
  const widths = new Map();
  const measure = (text, size, weight = 400) => {
    if (text === '') return 0;
    const key = `${size}:${weight}:${text}`;
    if (widths.has(key)) return widths.get(key);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="20000" height="256"><text x="0" y="180" font-family="${family}" font-size="${size}" font-weight="${weight}">${escapeXml(text)}</text></svg>`;
    const renderer = new Resvg(svg, options);
    const box = renderer.innerBBox();
    const width = box === undefined ? 0 : box.x + box.width;
    box?.free();
    renderer.free();
    if (width === 0 && text.trim() !== '') throw new Error('OG font could not render text');
    widths.set(key, width);

    return width;
  };

  const wrap = (text, width, size, weight, maxLines) => {
    const lines = [];
    let line = '';
    outer: for (const word of text.trim().replace(/\s+/g, ' ').split(' ')) {
      const candidate = line === '' ? word : `${line} ${word}`;
      if (measure(candidate, size, weight) <= width) {
        line = candidate;
        continue;
      }
      if (line !== '') lines.push(line);
      line = '';
      if (lines.length >= maxLines) break;
      for (const { segment } of graphemes.segment(word)) {
        if (line !== '' && measure(line + segment, size, weight) > width) {
          lines.push(line);
          line = '';
          if (lines.length >= maxLines) break outer;
        }
        line += segment;
      }
    }
    if (line !== '') lines.push(line);
    const normalized = text.trim().replace(/\s+/g, '');
    const included = lines.join('').replace(/\s+/g, '');
    const truncated = included !== normalized;
    if (truncated && lines.length > 0) {
      let last = Array.from(graphemes.segment(lines.at(-1)), (part) => part.segment);
      while (last.length > 0 && measure(last.join('') + '…', size, weight) > width) last.pop();
      lines[lines.length - 1] = last.join('') + '…';
    }

    return { lines, truncated };
  };

  const titleLayout = (title) => {
    let size = 62;
    let layout = wrap(title, 1056, size, 700, 3);
    while (layout.truncated && size > 44) {
      size -= 2;
      layout = wrap(title, 1056, size, 700, 3);
    }
    if (!layout.truncated && layout.lines.length > 1) {
      let score = Infinity;
      for (let width = 1056; width >= 560; width -= 16) {
        const candidate = wrap(title, width, size, 700, layout.lines.length);
        if (candidate.truncated || candidate.lines.length !== layout.lines.length) continue;
        const lengths = candidate.lines.map((line) => measure(line, size, 700));
        const difference = Math.max(...lengths) - Math.min(...lengths);
        if (difference < score) {
          score = difference;
          layout = candidate;
        }
      }
    }

    return { size, lines: layout.lines };
  };

  const text = (value, x, y, size, color = '#f2f2f2', weight = 400, anchor = 'start') =>
    `<text x="${x}" y="${y}" font-family="${family}" font-size="${size}" font-weight="${weight}" fill="${color}" text-anchor="${anchor}">${escapeXml(value)}</text>`;

  return ({ title, description, date, tags = [] }) => {
    const article = date !== undefined;
    const heading = article ? titleLayout(title) : { size: 76, lines: [title] };
    const firstBaseline = article ? 226 : 280;
    const leading = heading.size * 1.28;
    const descriptionY = article ? firstBaseline + (heading.lines.length - 1) * leading + 58 : 346;
    const descriptionSize = article ? 27 : 32;
    const descriptionLines = wrap(description, 1056, descriptionSize, 400, 2).lines;
    const tagLine = wrap(tags.map((tag) => `#${tag}`).join('   '), 760, 21, 400, 1).lines[0] ?? '';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
      <rect width="1200" height="630" fill="#111111"/>
      ${text(article ? site.title : '개발 블로그', 72, 91, 25)}
      ${heading.lines.map((line, index) => text(line, 72, firstBaseline + index * leading, heading.size, '#f2f2f2', 700)).join('')}
      ${descriptionLines.map((line, index) => text(line, 72, descriptionY + index * 38, descriptionSize, '#b5b5b5')).join('')}
      ${article ? text(date.replaceAll('-', '.'), 72, 568, 23, '#b5b5b5') : ''}
      ${text(tagLine, 1128, 568, 21, '#b5b5b5', 400, 'end')}
    </svg>`;
    const renderer = new Resvg(svg, options);
    const rendered = renderer.render();
    const png = Buffer.from(rendered.asPng());
    rendered.free();
    renderer.free();

    return png;
  };
}

export async function generateOg(root) {
  const site = JSON.parse(await fs.readFile(path.join(root, 'src/lib/site.json'), 'utf8'));
  const renderCard = await createRenderer(root, site);
  const posts = [];
  for (const file of (await fs.readdir(path.join(root, 'src/posts'))).sort()) {
    if (!file.endsWith('.md')) continue;
    const source = await fs.readFile(path.join(root, 'src/posts', file), 'utf8');
    const frontmatter = source.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (frontmatter === null) throw new Error(`${file}: missing frontmatter`);
    const meta = parse(frontmatter[1]);
    if (meta?.draft === true) continue;
    if (typeof meta?.title !== 'string' || meta.title.trim() === '') throw new Error(`${file}: missing title`);
    const date = new Date(meta.date);
    if (Number.isNaN(date.getTime())) throw new Error(`${file}: invalid date`);
    if (meta.tags !== undefined && (!Array.isArray(meta.tags) || meta.tags.some((tag) => typeof tag !== 'string'))) {
      throw new Error(`${file}: invalid tags`);
    }
    posts.push({
      slug: file.slice(0, -3),
      title: meta.title,
      description: typeof meta.description === 'string' ? meta.description : '',
      date: date.toISOString().slice(0, 10),
      tags: [...new Set((meta.tags ?? []).map((tag) => tag.trim()).filter(Boolean))],
    });
  }
  const output = path.join(root, 'static/og');
  await fs.rm(output, { recursive: true, force: true });
  await fs.mkdir(output, { recursive: true });
  await fs.writeFile(
    path.join(root, 'static/og.png'),
    renderCard({ title: site.title, description: site.description }),
  );
  for (const post of posts) await fs.writeFile(path.join(output, post.slug + '.png'), renderCard(post));
  console.log(`Generated site OG card and ${posts.length} published post card(s).`);
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await generateOg(path.resolve(process.argv[2] ?? fileURLToPath(new URL('../', import.meta.url))));
}
