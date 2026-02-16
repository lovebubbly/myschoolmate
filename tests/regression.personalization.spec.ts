import { expect, test } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

type NoticeApiItem = {
  id: number;
  relevanceScore?: number;
  relevanceReasons?: string[];
  actionState?: string | null;
  isFavorite?: boolean;
  isUrgent?: boolean;
  favoriteCount?: number;
  isEasyToMiss?: boolean;
};

test.describe('Personalization APIs', () => {
  test('notices API should return personalization fields in relevance mode', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/api/notices?autoCrawl=0&sort=relevance&limit=20`);
    expect(res.ok()).toBeTruthy();
    const json = await res.json();
    expect(json.success).toBeTruthy();
    expect(Array.isArray(json.notices)).toBeTruthy();

    const notices: NoticeApiItem[] = json.notices;
    if (notices.length === 0) {
      test.skip(true, 'No notices available.');
      return;
    }

    const first = notices[0];
    expect(typeof first.relevanceScore).toBe('number');
    expect(Array.isArray(first.relevanceReasons)).toBeTruthy();
    expect(typeof first.isUrgent).toBe('boolean');
    expect(typeof first.favoriteCount).toBe('number');
    expect(typeof first.isEasyToMiss).toBe('boolean');
  });

  test('notice action API should update actionState reflected in notices list', async ({ request }) => {
    const listRes = await request.get(`${BASE_URL}/api/notices?autoCrawl=0&sort=relevance&limit=10`);
    expect(listRes.ok()).toBeTruthy();
    const listJson = await listRes.json();
    expect(listJson.success).toBeTruthy();
    const notices: NoticeApiItem[] = Array.isArray(listJson.notices) ? listJson.notices : [];
    if (notices.length === 0) {
      test.skip(true, 'No notices available.');
      return;
    }

    const targetNotice = notices[0];
    const actionRes = await request.post(`${BASE_URL}/api/notices/actions`, {
      data: {
        noticeId: targetNotice.id,
        state: 'done',
      },
    });
    expect(actionRes.ok()).toBeTruthy();
    const actionJson = await actionRes.json();
    expect(actionJson.success).toBeTruthy();
    expect(actionJson.action?.state).toBe('done');

    const verifyRes = await request.get(`${BASE_URL}/api/notices?autoCrawl=0&sort=relevance&limit=10`);
    expect(verifyRes.ok()).toBeTruthy();
    const verifyJson = await verifyRes.json();
    const updated = (verifyJson.notices as NoticeApiItem[]).find((notice) => notice.id === targetNotice.id);
    expect(updated).toBeTruthy();
    expect(updated?.actionState).toBe('done');
  });

  test('preset API and deadlines API should work', async ({ request }) => {
    const saveRes = await request.post(`${BASE_URL}/api/user/presets`, {
      data: {
        name: 'e2e-추천',
        categories: ['Employment'],
        tags: ['취업'],
        profileOverrides: { grade: 3, income: 10, gpa: 3.0 },
      },
    });
    expect(saveRes.ok()).toBeTruthy();
    const saveJson = await saveRes.json();
    expect(saveJson.success).toBeTruthy();
    const presetId = Number(saveJson.preset?.id);
    expect(Number.isInteger(presetId)).toBeTruthy();

    const presetListRes = await request.get(`${BASE_URL}/api/user/presets`);
    expect(presetListRes.ok()).toBeTruthy();
    const presetListJson = await presetListRes.json();
    expect(presetListJson.success).toBeTruthy();
    expect(Array.isArray(presetListJson.presets)).toBeTruthy();

    const noticesByPreset = await request.get(`${BASE_URL}/api/notices?autoCrawl=0&sort=relevance&presetId=${presetId}&limit=10`);
    expect(noticesByPreset.ok()).toBeTruthy();
    const noticesByPresetJson = await noticesByPreset.json();
    expect(noticesByPresetJson.success).toBeTruthy();

    const deadlinesRes = await request.get(`${BASE_URL}/api/deadlines?withinDays=14&limit=5`);
    expect(deadlinesRes.ok()).toBeTruthy();
    const deadlinesJson = await deadlinesRes.json();
    expect(deadlinesJson.success).toBeTruthy();
    expect(Array.isArray(deadlinesJson.deadlines)).toBeTruthy();

    const deleteRes = await request.delete(`${BASE_URL}/api/user/presets?id=${presetId}`);
    expect(deleteRes.ok()).toBeTruthy();
    const deleteJson = await deleteRes.json();
    expect(deleteJson.success).toBeTruthy();
  });

  test('favorite API should support favoriteOnly filter and calendar ICS export', async ({ request }) => {
    const listRes = await request.get(`${BASE_URL}/api/notices?autoCrawl=0&sort=latest&limit=20`);
    expect(listRes.ok()).toBeTruthy();
    const listJson = await listRes.json();
    expect(listJson.success).toBeTruthy();

    const notices: NoticeApiItem[] = Array.isArray(listJson.notices) ? listJson.notices : [];
    if (notices.length === 0) {
      test.skip(true, 'No notices available.');
      return;
    }

    const targetNotice = notices[0];
    const favoriteRes = await request.post(`${BASE_URL}/api/notices/favorites`, {
      data: {
        noticeId: targetNotice.id,
        isFavorite: true,
      },
    });
    expect(favoriteRes.ok()).toBeTruthy();
    const favoriteJson = await favoriteRes.json();
    expect(favoriteJson.success).toBeTruthy();
    expect(favoriteJson.isFavorite).toBe(true);

    const favoriteOnlyRes = await request.get(`${BASE_URL}/api/notices?autoCrawl=0&favoriteOnly=1&limit=50`);
    expect(favoriteOnlyRes.ok()).toBeTruthy();
    const favoriteOnlyJson = await favoriteOnlyRes.json();
    expect(favoriteOnlyJson.success).toBeTruthy();
    expect(Array.isArray(favoriteOnlyJson.notices)).toBeTruthy();
    const foundInFavoriteOnly = (favoriteOnlyJson.notices as NoticeApiItem[]).some((notice) => notice.id === targetNotice.id);
    expect(foundInFavoriteOnly).toBe(true);

    const unfavoriteRes = await request.post(`${BASE_URL}/api/notices/favorites`, {
      data: {
        noticeId: targetNotice.id,
        isFavorite: false,
      },
    });
    expect(unfavoriteRes.ok()).toBeTruthy();
    const unfavoriteJson = await unfavoriteRes.json();
    expect(unfavoriteJson.success).toBeTruthy();
    expect(unfavoriteJson.isFavorite).toBe(false);

    const deadlinesRes = await request.get(`${BASE_URL}/api/deadlines?withinDays=60&limit=1`);
    expect(deadlinesRes.ok()).toBeTruthy();
    const deadlinesJson = await deadlinesRes.json();
    expect(deadlinesJson.success).toBeTruthy();
    const firstDeadlineNoticeId = Array.isArray(deadlinesJson.deadlines) && deadlinesJson.deadlines.length > 0
      ? Number(deadlinesJson.deadlines[0]?.id)
      : null;
    if (!firstDeadlineNoticeId || !Number.isInteger(firstDeadlineNoticeId)) {
      test.skip(true, 'No notice with parsed deadline available for ICS export.');
      return;
    }

    const icsRes = await request.get(`${BASE_URL}/api/notices/${firstDeadlineNoticeId}/calendar.ics`);
    expect(icsRes.ok()).toBeTruthy();
    const contentType = icsRes.headers()['content-type'] || '';
    expect(contentType).toContain('text/calendar');
    const icsText = await icsRes.text();
    expect(icsText).toContain('BEGIN:VCALENDAR');
    expect(icsText).toContain('BEGIN:VEVENT');
  });

  test('push public key endpoint should return push capability metadata', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/api/alerts/push/public-key`);
    expect(res.ok()).toBeTruthy();
    const json = await res.json();
    expect(json.success).toBeTruthy();
    expect(typeof json.enabled).toBe('boolean');
    if (json.enabled) {
      expect(typeof json.publicKey).toBe('string');
      expect(json.publicKey.length).toBeGreaterThan(0);
    } else {
      expect(json.publicKey === null || typeof json.publicKey === 'string').toBeTruthy();
    }
  });

  test('deadline calendar feed should return ICS format', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/api/deadlines/calendar.ics?withinDays=60&limit=50`);
    expect(res.ok()).toBeTruthy();
    const contentType = res.headers()['content-type'] || '';
    expect(contentType).toContain('text/calendar');
    const icsText = await res.text();
    expect(icsText).toContain('BEGIN:VCALENDAR');
    expect(icsText).toContain('END:VCALENDAR');
  });
});
