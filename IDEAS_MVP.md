# MySchoolMate — New Feature Ideas (MVP-lean)

Scale: **Impact / Effort / Risk = 1 (low) → 5 (high)**. Lower Effort/Risk is better.

| # | Idea | What it does | Impact | Effort | Risk | Notes / Dependencies |
|---|------|--------------|:------:|:------:|:----:|----------------------|
| 1 | **Watchlist Keywords/Tags** | Save keywords/tags to auto-highlight & filter notices; optional in-app alert badge | 5 | 2 | 2 | Uses existing tags + notice search; small UI in Settings |
| 2 | **Eligibility Gap Explanation** | Show “eligible / not eligible / unknown” with reasons (grade, GPA, income) | 4 | 2 | 1 | Pure logic; no DB change required |
| 3 | **Notice Update Tracking** | Detect content changes; “Updated” badge + small diff summary | 4 | 3 | 2 | Needs content hash or revision field |
| 4 | **AI Requirements Checklist** | Extract required docs/steps/links into a checklist per notice | 5 | 4 | 3 | Gemini extraction + new JSON field |
| 5 | **Related Notices** | Show 3 similar notices (tags/title overlap/scholarship type) | 3 | 2 | 1 | Simple similarity heuristic |
| 6 | **Bulk Actions + Compare Mode** | Multi-select to mark done/dismissed or compare key fields | 3 | 2 | 1 | UI-only + existing actions API |
| 7 | **Search Intent Chips** | Auto-suggest filter chips (deadline≤7d, eligible-only, scholarship) | 3 | 2 | 1 | Light UI + query params |
| 8 | **Snooze / Remind Me Later** | Hide notice until a chosen date; resurfaced in queue | 4 | 3 | 2 | Needs per-user snooze metadata |
| 9 | **Planner Bridge** | Add notice deadline as planner milestone/task | 4 | 3 | 2 | Small planner integration |
|10 | **Quick Q&A Prompts** | Pre-made Q&A buttons (eligibility, docs, deadline) | 3 | 3 | 2 | Cache chat responses per notice |

---

## ✅ Top 2 MVP Candidates (1-day builds)

### 1) Watchlist Keywords/Tags
**Why:** Highest personalization impact with minimal changes; fits crawl/search/reco pipeline.

**1‑day implementation outline**
- **Data**: Add `watchlistKeywords` (JSON string) to `UserProfile` **or** create `UserWatchlist` table (keyword/tag). Keep it simple (JSON array).
- **API**:
  - `GET/POST /api/user/profile` include `watchlistKeywords`.
  - `GET /api/notices` add `matchesWatchlist` boolean; add `watchlistOnly=1` filter.
- **UI**:
  - Settings: chip input for keywords/tags.
  - Notice card: small “watchlist” badge; filter toggle in list.
- **Feature flag**: `FEATURE_WATCHLIST` (guard UI + API output).
- **Quick validation**: add keyword, verify highlight/filter in list.

### 2) Eligibility Gap Explanation
**Why:** Immediate clarity for users; leverages existing minGrade/minGpa/maxIncome + profile.

**1‑day implementation outline**
- **Logic**: Add `computeEligibility()` in `src/lib/noticePersonalization.ts` returning `status` + `reasons`.
- **API**: `GET /api/notices` attach `eligibilityStatus`, `eligibilityReasons`; optional `eligibleOnly=1` filter.
- **UI**:
  - Notice card: pill “조건 충족/불충족/정보부족”.
  - Tooltip or detail section showing reasons.
- **Feature flag**: `FEATURE_ELIGIBILITY_EXPLAIN`.
- **Quick validation**: change profile (grade/GPA/income) and confirm status updates.
