import { expect, test, type APIRequestContext } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

type TrackApiCourse = {
  id: string;
};

type TrackApiItem = {
  id: number;
  name: string;
  courses: TrackApiCourse[];
};

async function selectActiveTrackAndResetProgress(request: APIRequestContext, baseUrl: string): Promise<TrackApiItem> {
  const curriculumRes = await request.get(`${baseUrl}/api/curriculum`);
  expect(curriculumRes.ok()).toBeTruthy();

  const curriculumJson = await curriculumRes.json();
  expect(curriculumJson.success).toBeTruthy();
  const tracks: TrackApiItem[] = Array.isArray(curriculumJson.tracks) ? curriculumJson.tracks : [];
  expect(tracks.length).toBeGreaterThan(0);

  const tracksWithCourses = tracks.filter((track) => Array.isArray(track.courses) && track.courses.length > 0);
  expect(tracksWithCourses.length).toBeGreaterThan(0);

  const targetTrack = tracksWithCourses[0];
  expect(targetTrack?.courses).toBeDefined();

  const profileRes = await request.post(`${baseUrl}/api/user/profile`, {
    data: {
      grade: 3,
      income: 7,
      gpa: 3.8,
      trackId: targetTrack.id,
    },
  });
  expect(profileRes.ok()).toBeTruthy();
  const profileJson = await profileRes.json();
  expect(profileJson.success).toBeTruthy();

  const progressReset = await request.post(`${baseUrl}/api/planning/progress`, {
    data: {
      trackId: targetTrack.id,
      completedCourseIds: [],
    },
  });
  expect(progressReset.ok()).toBeTruthy();
  const progressResetJson = await progressReset.json();
  expect(progressResetJson.success).toBeTruthy();

  return targetTrack;
}

test.describe('Planning Progress', () => {
  test('planning progress API should save and load per user account', async ({ request }) => {
    const targetTrack = await selectActiveTrackAndResetProgress(request, BASE_URL);
    if (!targetTrack.courses || targetTrack.courses.length === 0) {
      test.skip(true, 'No courses in selected planning track for API-only persistence test.');
      return;
    }

    const sampleCourseId = targetTrack.courses[0].id;
    const saveRes = await request.post(`${BASE_URL}/api/planning/progress`, {
      data: {
        trackId: targetTrack.id,
        completedCourseIds: [sampleCourseId],
      },
    });
    expect(saveRes.ok()).toBeTruthy();
    const saveJson = await saveRes.json();
    expect(saveJson.success).toBeTruthy();

    const lookupRes = await request.get(`${BASE_URL}/api/planning/progress`);
    expect(lookupRes.ok()).toBeTruthy();
    const lookupJson = await lookupRes.json();
    const trackKey = String(targetTrack.id);
    const savedIds = Array.isArray(lookupJson?.completionByTrack?.[trackKey])
      ? lookupJson.completionByTrack[trackKey]
      : [];

    expect(savedIds).toContain(sampleCourseId);
  });

  test('planning page should toggle completion and persist across reload', async ({ page }) => {
    const targetTrack = await selectActiveTrackAndResetProgress(page.request, BASE_URL);
    if (!targetTrack.courses || targetTrack.courses.length === 0) {
      test.skip(true, 'No courses available on selected planning track.');
      return;
    }

    await page.goto(`${BASE_URL}/planning`);
    await expect(page.getByRole('heading', { name: '커리큘럼 플래너' })).toBeVisible();

    const checkbox = page.getByRole('checkbox').first();
    await expect(checkbox).toBeVisible();

    const progressSummary = page
      .locator('p')
      .filter({ hasText: /필수 과목 \d+개 \/ 매핑 \d+개 \/ 완료 \d+개/ })
      .first();

    const parseCompleted = async (): Promise<number> => {
      const text = await progressSummary.innerText();
      const match = text.match(/완료\s+(\d+)개/);
      return match ? Number(match[1]) : 0;
    };

    const before = await parseCompleted();
    await checkbox.click();

    await expect.poll(async () => {
      const next = await parseCompleted();
      return next;
    }, { timeout: 8000 }).toBeGreaterThan(before);

    await page.reload();
    const checked = page.getByRole('checkbox').first();
    await expect(checked).toHaveAttribute('data-state', 'checked');

    await page.getByRole('button', { name: '체크 초기화' }).click();
    await expect.poll(async () => {
      const after = await parseCompleted();
      return after;
    }, { timeout: 8000 }).toBe(0);

    const resetCheckState = await page.request.get(`${BASE_URL}/api/planning/progress`);
    expect(resetCheckState.ok()).toBeTruthy();
    const resetCheckJson = await resetCheckState.json();
    const trackKey = String(targetTrack.id);
    const savedIds = Array.isArray(resetCheckJson?.completionByTrack?.[trackKey])
      ? resetCheckJson.completionByTrack[trackKey]
      : [];

    expect(savedIds.length).toBe(0);
  });

  test('planning page should be usable on mobile width with touch checkbox', async ({ page }) => {
    const targetTrack = await selectActiveTrackAndResetProgress(page.request, BASE_URL);
    if (!targetTrack.courses || targetTrack.courses.length === 0) {
      test.skip(true, 'No courses available on selected planning track.');
      return;
    }

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE_URL}/planning`);
    await expect(page.getByRole('checkbox').first()).toBeVisible();

    const checkbox = page.getByRole('checkbox').first();
    await checkbox.click();

    await expect.poll(async () => {
      const state = await checkbox.getAttribute('data-state');
      return state === 'checked';
    }).toBeTruthy();
  });
});
