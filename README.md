# mingeon.me

Personal website

## Open Graph images

`bun run dev` and `bun run build` generate 1200×630 PNG sharing cards before starting Vite. Run `bun run generate:og` to regenerate them separately.

- Site information comes from `src/lib/site.json`.
- Published Markdown posts receive cards at `/og/<slug>.png`; drafts are excluded.
- Generated post cards are not committed. The build recreates them from frontmatter and the existing LINE Seed KR fonts.
- Rendering runs locally through WebAssembly. It does not need a browser, native image tools, or external font requests.
- OG and Twitter image URLs include the build version to avoid reusing stale image URLs.
