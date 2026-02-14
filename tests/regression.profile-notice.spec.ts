import { expect, test } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

type NoticeResponseItem = {
  title: string;
  content?: string | null;
};

test.describe('Profile + Notice Regression', () => {
  test('profile API save should succeed', async ({ request }) => {
    const getRes = await request.get(`${BASE_URL}/api/user/profile`);
    expect(getRes.ok()).toBeTruthy();
    const getJson = await getRes.json();
    expect(getJson.success).toBeTruthy();

    const postRes = await request.post(`${BASE_URL}/api/user/profile`, {
      data: {
        grade: 3,
        income: 7,
        gpa: 3.8,
        trackId: null,
      },
    });
    expect(postRes.ok()).toBeTruthy();
    const postJson = await postRes.json();
    expect(postJson.success).toBeTruthy();
    expect(postJson.profile.grade).toBe(3);
    expect(postJson.profile.income).toBe(7);
  });

  test('settings page should save profile and return to dashboard', async ({ page }) => {
    await page.goto(`${BASE_URL}/settings`);
    await expect(page.getByRole('heading', { name: '내 정보 설정 ⚙️' })).toBeVisible();

    await page.locator('select').first().selectOption('3');
    await page.locator('select').nth(1).selectOption('7');
    await page.getByPlaceholder('Ex: 3.5').fill('3.9');

    await page.getByRole('button', { name: '저장하기' }).click();
    await page.waitForURL((url) => url.pathname === '/', { timeout: 15000 });
    await expect(page.getByText('내 학교 생활 🎓')).toBeVisible();
  });

  test('notice dialog should render markdown table when notice contains table markdown', async ({ page, request }) => {
    const noticesRes = await request.get(`${BASE_URL}/api/notices?autoCrawl=0`);
    expect(noticesRes.ok()).toBeTruthy();
    const noticesJson = await noticesRes.json();
    expect(noticesJson.success).toBeTruthy();

    const notices: NoticeResponseItem[] = Array.isArray(noticesJson.notices) ? noticesJson.notices : [];
    const tableNotice = notices.find((notice) =>
      typeof notice.content === 'string' && /\|\s*---/.test(notice.content)
    );

    if (!tableNotice) {
      test.skip(true, 'No notice with markdown table in current dataset.');
      return;
    }

    const title = tableNotice.title;
    const keyword = title.slice(0, Math.min(12, title.length));

    await page.goto(BASE_URL);
    await expect(page.getByRole('heading', { name: '공지사항' })).toBeVisible();

    await page.getByPlaceholder('공지 검색...').fill(keyword);
    await page.getByText(title, { exact: false }).first().click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    const table = dialog.locator('table').first();
    await expect(table).toBeVisible();
    await expect(table.locator('tr').first()).toBeVisible();
    await expect(table.locator('th, td').first()).toBeVisible();
  });
});
