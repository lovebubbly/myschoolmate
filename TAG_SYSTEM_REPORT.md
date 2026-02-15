# Tag System Update Report

## Summary
- Added N:M tag models in Prisma (`Tag`, `NoticeTag`) and wired `Notice.tags` relation.
- Implemented regex-first tag extraction with optional LLM fallback when no tags are found.
- `/api/notices` and `/api/notices/crawl` now return tag names; `/api/notices` accepts tag filters with `mode=any|all`.
- Added dashboard tag filter UI + tag chips on notice cards/dialogs.

## What Changed
### Database / Prisma
- `prisma/schema.prisma`
  - Added `Tag` and `NoticeTag` models.
  - Added `Notice.tags` relation.
- `prisma db push` was run to sync the SQLite schema.

### Tagging Logic
- `src/lib/tagging.ts`
  - `ALLOWED_TAGS` and regex patterns for fast tagging.
  - `extractTagsByRegex` + `normalizeTags`.
- `src/lib/gemini.ts`
  - `analyzeNotice(..., category)` now returns `tags`.
  - Regex tags first; if empty, small LLM prompt selects from `ALLOWED_TAGS`.
- `src/lib/crawler.ts`
  - Calls `analyzeNotice` with category.
  - Syncs tags via `syncNoticeTags` (creates/joins tags, clears stale ones).
  - For refreshed notices, tags are updated via regex (no extra LLM call).

### API
- `src/app/api/notices/route.ts`
  - Accepts `tags` (comma-separated or repeated) and `mode=any|all`.
  - Returns `tags: string[]` (tag names) per notice.
- `src/app/api/notices/crawl/route.ts`
  - Returns `tags: string[]` (tag names) per notice.

### UI
- `src/app/page.tsx`
  - Notice type updated to `tags?: string[]`.
  - Tag chips in cards + dialog header.
  - Tag filter UI with mode toggle (any/all).

## How to Use
### API
- Any match (default):
  - `GET /api/notices?tags=장학,취업&mode=any`
- All tags required:
  - `GET /api/notices?tags=장학,취업&mode=all`
- Repeated params also work:
  - `GET /api/notices?tags=장학&tags=취업&mode=all`

### Dashboard
- Open **필터** panel → select tag chips → choose mode ("하나라도 포함" or "모두 포함").

## Lint / Build
- `npm run lint` → fails with existing lint errors (pre-existing warnings/errors in multiple files; see console output).
- `npm run build` → fails due to existing TypeScript error in `src/lib/adminActionGuard.ts` (Object is possibly 'null').

## Notes
- Tags are derived from regex first; LLM tagging only runs when regex yields zero tags.
