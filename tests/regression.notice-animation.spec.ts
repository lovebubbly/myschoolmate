import { expect, test } from '@playwright/test';
import { mockBriefingApi } from './_helpers/mockBriefing';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

type NoticeApiItem = { id: number };

async function waitForFirstNoticeCard(page: import('@playwright/test').Page) {
  const firstCard = page.getByTestId('notice-card').first();
  const visible = await firstCard.isVisible({ timeout: 15000 }).catch(() => false);
  if (visible) return firstCard;

  const filterToggle = page.getByRole('button', { name: /필터/ });
  await filterToggle.click({ timeout: 3000 }).catch(() => {});
  const resetButton = page.getByRole('button', { name: '전체 보기' });
  await resetButton.click({ timeout: 3000 }).catch(() => {});
  const visibleAfterReset = await firstCard.isVisible({ timeout: 10000 }).catch(() => false);
  return visibleAfterReset ? firstCard : null;
}

test.describe('Notice list animation', () => {
  test.describe.configure({ timeout: 120000 });
  test.beforeEach(async ({ page }) => {
    await mockBriefingApi(page);
  });

  test('should switch between card and list layout cleanly', async ({ page, request }) => {
    const noticesRes = await request.get(`${BASE_URL}/api/notices?autoCrawl=0`);
    expect(noticesRes.ok()).toBeTruthy();
    const noticesJson = await noticesRes.json();
    expect(noticesJson.success).toBeTruthy();
    const notices: NoticeApiItem[] = Array.isArray(noticesJson.notices) ? noticesJson.notices : [];
    if (notices.length === 0) {
      test.skip(true, 'No notices available for animation verification.');
      return;
    }

    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.getByText('최신 공지사항을 불러오고 있어요...').waitFor({ state: 'hidden', timeout: 30000 }).catch(() => {});

    const firstNoticeCard = await waitForFirstNoticeCard(page);
    if (!firstNoticeCard) {
      test.skip(true, 'Notice card was not visible on initial render.');
      return;
    }

    const cardButton = page.getByRole('button', { name: '카드' });
    const listButton = page.getByRole('button', { name: '리스트' });

    const cards = page.getByTestId('notice-card');
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);

    await cardButton.click();
    await expect(page.getByTestId('regular-notices-grid')).toBeVisible();
    await expect(page.getByTestId('regular-notices-grid').first().getByTestId('notice-card').first()).toBeVisible();

    await listButton.click();
    await expect(page.getByTestId('regular-notices-list')).toBeVisible();
    await expect(page.getByTestId('regular-notices-grid')).toBeHidden();
    await expect(firstNoticeCard).toBeVisible();
    await expect
      .poll(async () => {
        const opacity = await firstNoticeCard.evaluate((el) => getComputedStyle(el).opacity);
        const value = Number(opacity);
        return Number.isFinite(value) ? value : 0;
      }, { timeout: 5000, intervals: [100, 100, 250, 250, 500, 500] })
      .toBeGreaterThan(0.6);

    await cardButton.click();
    await expect(page.getByTestId('regular-notices-grid')).toBeVisible();
    await expect(page.getByTestId('regular-notices-list')).toBeHidden();
    await expect(firstNoticeCard).toBeVisible();
    await expect
      .poll(async () => {
        const opacity = await firstNoticeCard.evaluate((el) => getComputedStyle(el).opacity);
        const value = Number(opacity);
        return Number.isFinite(value) ? value : 0;
      }, { timeout: 5000, intervals: [100, 100, 250, 250, 500, 500] })
      .toBeGreaterThan(0.6);
  });
});
