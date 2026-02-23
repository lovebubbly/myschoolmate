# Eligibility MVP (Backend)

- Added `computeEligibility` helper in `src/lib/noticePersonalization.ts`.
  - Status: `eligible` | `ineligible` | `unknown` (unknown when no criteria present).
  - Reasons (gap codes): `grade_below_min`, `gpa_below_min`, `income_above_max`.
- `GET /api/notices` now (when enabled) attaches `eligibilityStatus` + `eligibilityReasons` and supports `?eligibleOnly=1` filtering.
- Feature flag: `FEATURE_ELIGIBILITY_EXPLAIN=1` enables in production; in dev it defaults ON. When disabled, fields/filter are omitted.
