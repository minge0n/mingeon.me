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
