# OPS / Reliability Audit — `autonomy/ops-loop-20260223`

## Scope
- Commits: `8bb6aee`, `9ef70cf`
- Focus: ops/reliability changes (auto-crawl/locks, dom fingerprint, ops snapshot, search index/FTS, rate limiting)

---

## Findings (Risk / Edge cases)

### 1) `/api/notices` auto-crawl is request-blocking and can 500 on crawler failure
**Evidence**: `src/app/api/notices/route.ts` L264–267
```ts
if (autoCrawl) {
  startNoticeAutoCrawler();
  await ensureFreshNotices('api:notices');
}
```
**Risk**:
- `ensureFreshNotices()` can execute Playwright-based crawling and throw → the entire API request returns 500.
- In serverless (Vercel) or read-only DB environments, crawler/lock errors can spike 500s or timeouts even when cached notices exist.

**Impact**: “read notices” endpoint becomes coupled to crawler availability.

---

### 2) SQLite FTS/DDL creation can fail and break chat search (Vercel/read‑only/FTS5 missing)
**Evidence**: `src/lib/noticeSearch.ts` L558–635 (FTS table + triggers + ensure)
```ts
await prisma.$executeRawUnsafe(`CREATE VIRTUAL TABLE IF NOT EXISTS notice_search USING fts5(...)`);
...
await ensureSearchIndexPromise; // throws if any DDL fails
```
**Risk**:
- Some SQLite builds (or Vercel/readonly FS) don’t support FTS5 or DDL at runtime → `ensureNoticeSearchIndex()` throws, and `searchNotices()` rejects.
- Chat route (`/api/chat`) wraps the whole logic in a try/catch and returns 500 on this error, even though LIKE fallback exists below.

**Impact**: Chat/notice search becomes unavailable when FTS isn’t supported or when DB is read-only.

---

### 3) Dom fingerprint capture can leave locks on Playwright launch failure
**Evidence**: `src/lib/noticeDomFingerprint.ts` L240–263
```ts
const acquired = await tryAcquireSystemLock(...);
const browser = await chromium.launch({ headless: true }); // outside try
...
finally {
  await page.close();
  await context.close();
  await browser.close();
  await releaseSystemLock(LOCK_NAME);
}
```
**Risk**:
- If `chromium.launch()` or `newContext()` fails after lock acquisition, the `finally` block never runs → lock can remain until TTL expires; browser process may leak.
- In Vercel/serverless, Playwright often fails without `--no-sandbox` or missing browser binaries → admin endpoint returns 500 and lock may remain.

**Impact**: Admin ops tooling can self‑lock; repeated failures require waiting for TTL.

---

### Minor: CLI ops snapshot script leaves Prisma connections open
**Evidence**: `scripts/ops_snapshot.ts` L13–16
```ts
const { getOpsSnapshot } = await import('@/lib/opsSnapshot');
const snapshot = await getOpsSnapshot();
```
**Risk**: no `prisma.$disconnect()` → CLI can hang in some environments (Node keeps engine alive).

---

## Missing awaits
- No clear missing `await` in the new runtime paths. Fire‑and‑forget (`broadcastNewNoticePush`) is intentional.
- Only missing cleanup: `scripts/ops_snapshot.ts` should `await prisma.$disconnect()` to avoid CLI hangs.

---

## 3 Quick Hardening Patches

### Patch 1) Fail‑soft auto‑crawl in `/api/notices` (don’t block request)
**Goal**: avoid 500s/timeouts when crawler fails or Playwright is unavailable.
```ts
if (autoCrawl) {
  startNoticeAutoCrawler();
  void ensureFreshNotices('api:notices').catch((err) => {
    console.warn('[api:notices] autoCrawl failed:', err);
  });
}
```
*Optional*: add query flag `autoCrawl=0` defaulting to off in serverless.

---

### Patch 2) FTS/DDL failure fallback for SQLite/readonly DB
**Goal**: if FTS is unavailable, use LIKE fallback without breaking chat.
```ts
let ftsEnabled = true; // module-level

async function safeEnsureIndex() {
  if (!ftsEnabled) return;
  try {
    await ensureNoticeSearchIndex();
  } catch (e) {
    ftsEnabled = false;
    console.warn('[noticeSearch] FTS disabled:', e);
  }
}

// in searchNotices():
await safeEnsureIndex();
// in queryCandidates(): skip FTS block when !ftsEnabled
```
This prevents 500s in Vercel or any SQLite build without FTS5.

---

### Patch 3) Guard Playwright capture + always release lock
**Goal**: avoid leaked locks and handle missing Playwright runtime.
```ts
export async function runDomFingerprintCapture() {
  const acquired = await tryAcquireSystemLock(LOCK_NAME, LOCK_TTL_MS);
  if (!acquired) return getDomFingerprintStatus();

  let browser: Browser | null = null;
  let context: BrowserContext | null = null;
  let page: Page | null = null;

  try {
    browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
    context = await browser.newContext();
    page = await context.newPage();
    ...
  } catch (e) {
    console.error('[dom-fingerprint] launch failed:', e);
    return getDomFingerprintStatus();
  } finally {
    await page?.close().catch(() => {});
    await context?.close().catch(() => {});
    await browser?.close().catch(() => {});
    await releaseSystemLock(LOCK_NAME);
  }
}
```

---

### (Optional) Small cleanup
Add `await prisma.$disconnect()` to `scripts/ops_snapshot.ts` after `getOpsSnapshot()`.
