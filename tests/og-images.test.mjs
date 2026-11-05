import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readdir, symlink, copyFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

const root = fileURLToPath(new URL('../', import.meta.url));

test('OG build creates real post-specific PNGs, excludes drafts and removes stale cards', async () => {
  const fixture = await mkdtemp(path.join(os.tmpdir(), 'blog-og-'));
  try {
    await mkdir(path.join(fixture, 'src/posts'), { recursive: true });
    await mkdir(path.join(fixture, 'src/lib'), { recursive: true });
    await mkdir(path.join(fixture, 'static/og'), { recursive: true });
    await symlink(path.join(root, 'static/fonts'), path.join(fixture, 'static/fonts'));
    await copyFile(path.join(root, 'static/icon.svg'), path.join(fixture, 'static/icon.svg'));
    await copyFile(path.join(root, 'src/lib/site.json'), path.join(fixture, 'src/lib/site.json'));
    const post = (title) =>
      `---\ntitle: '${title}'\ndescription: '서명 & <부팅> 확인 기록.'\ndate: 2026-11-05\ntags: [Android, 개발]\ndraft: false\n---\n본문\n`;
    await writeFile(path.join(fixture, 'src/posts/public.md'), post('한글 제목 & <실험>'));
    await writeFile(path.join(fixture, 'src/posts/private.md'), '---\ntitle: 비공개 글\ndraft: true\n---\n');
    await writeFile(path.join(fixture, 'static/og/private.png'), 'stale private card');
    const run = () => {
      const result = spawnSync(process.execPath, [path.join(root, 'scripts/generate-og.mjs'), fixture], {
        encoding: 'utf8',
        timeout: 30000,
      });
      assert.equal(result.status, 0, result.stderr || result.stdout);
    };
    run();
    assert.deepEqual(await readdir(path.join(fixture, 'static/og')), ['public.png']);
    const first = await readFile(path.join(fixture, 'static/og/public.png'));
    const siteCard = await readFile(path.join(fixture, 'static/og.png'));
    for (const png of [first, siteCard]) {
      assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
      assert.equal(png.readUInt32BE(16), 1200);
      assert.equal(png.readUInt32BE(20), 630);
    }
    assert.notDeepEqual(first, siteCard);
    await writeFile(path.join(fixture, 'src/posts/public.md'), post('새로 바뀐 글 제목'));
    run();
    assert.notDeepEqual(await readFile(path.join(fixture, 'static/og/public.png')), first);
    assert.deepEqual(await readFile(path.join(fixture, 'static/og.png')), siteCard);
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});

test('OG headers need no favicon file and leave the upper-right area empty', async () => {
  const fixture = await mkdtemp(path.join(os.tmpdir(), 'blog-og-minimal-'));
  try {
    await mkdir(path.join(fixture, 'src/posts'), { recursive: true });
    await mkdir(path.join(fixture, 'src/lib'), { recursive: true });
    await mkdir(path.join(fixture, 'static'), { recursive: true });
    await symlink(path.join(root, 'static/fonts'), path.join(fixture, 'static/fonts'));
    await copyFile(path.join(root, 'src/lib/site.json'), path.join(fixture, 'src/lib/site.json'));
    await writeFile(path.join(fixture, 'src/posts/post.md'), '---\ntitle: 한글 글 제목\ndate: 2026-11-05\n---\n');
    const result = spawnSync(process.execPath, [path.join(root, 'scripts/generate-og.mjs'), fixture], {
      encoding: 'utf8',
      timeout: 30000,
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const { initWasm, Resvg } = await import('@resvg/resvg-wasm');
    await initWasm(await readFile(new URL(import.meta.resolve('@resvg/resvg-wasm/index_bg.wasm'))));
    for (const file of ['static/og.png', 'static/og/post.png']) {
      const png = await readFile(path.join(fixture, file));
      const renderer = new Resvg(
        `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><image width="1200" height="630" href="data:image/png;base64,${png.toString('base64')}"/></svg>`,
      );
      const image = renderer.render();
      const pixels = image.pixels;
      let empty = true;
      for (let y = 50; y < 120; y++) {
        for (let x = 850; x < 1140; x++) {
          const at = (y * 1200 + x) * 4;
          if (pixels[at] !== 17 || pixels[at + 1] !== 17 || pixels[at + 2] !== 17 || pixels[at + 3] !== 255)
            empty = false;
        }
      }
      image.free();
      renderer.free();
      assert.ok(empty, `${file}: the upper-right area must contain only the background`);
    }
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});
