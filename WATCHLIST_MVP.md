# Watchlist MVP (Keywords/Tags)

## Storage
- Uses `UserProfile.dashboardState.watchlist`.
- Shape:
  - `keywords?: string[]`
  - `tags?: string[]`
- Validation/sanitization:
  - trim, dedupe
  - max 30 items each
  - max 40 chars per item

## API Behavior
- `POST /api/user/profile` accepts `dashboardState.watchlist` and persists via existing JSON string.
- `GET /api/user/profile` returns parsed `dashboardState` (including watchlist).

## Notices
- `GET /api/notices` (when watchlist feature is enabled):
  - Adds `matchesWatchlist: boolean` per notice.
  - `matchesWatchlist` is true when:
    - any keyword appears in `title`, `summary`, or `content` (case-insensitive), **or**
    - any notice tag matches a watchlist tag (by tag `name`/`slug`).
  - `watchlistOnly=1` filters to only matched notices.

## Feature Flag
- `FEATURE_WATCHLIST`:
  - **ON** by default in non-production.
  - **ON** in production only when `FEATURE_WATCHLIST=1`.
  - When **OFF**: `matchesWatchlist` is omitted and `watchlistOnly` is ignored.
