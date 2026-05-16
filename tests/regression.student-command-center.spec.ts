import { expect, test } from '@playwright/test';
import { mockBriefingApi } from './_helpers/mockBriefing';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

test.describe('Student command center', () => {
  test.beforeEach(async ({ page }) => {
    await mockBriefingApi(page);
  });

  test('should expose five public-launch dashboard features', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

    await expect(page.getByTestId('student-command-center')).toBeVisible();
    await expect(page.getByTestId('today-action-plan')).toBeVisible();
    await expect(page.getByTestId('deadline-radar')).toBeVisible();
    await expect(page.getByTestId('scholarship-fit-meter')).toBeVisible();
    await expect(page.getByTestId('career-opportunity-radar')).toBeVisible();
    await expect(page.getByTestId('progress-snapshot')).toBeVisible();

    await expect(page.getByText('오늘 할 일 3개')).toBeVisible();
    await expect(page.getByText('7일 마감 레이더')).toBeVisible();
    await expect(page.getByText('장학 적합도')).toBeVisible();
    await expect(page.getByText('취업/인턴 레이더')).toBeVisible();
    await expect(page.getByText('처리 진행률')).toBeVisible();

    const todayActionPlan = page.getByTestId('today-action-plan');
    await expect(todayActionPlan).not.toContainText('2011학년도');
    await expect(todayActionPlan).not.toContainText('마감 지남');
    await expect(todayActionPlan).not.toContainText('교수 임용');
  });

  test('should keep notice cards stable during rapid category switches', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

    const noticeSection = page.getByTestId('regular-notices-grid');
    await expect(noticeSection).toBeVisible();

    await page.getByRole('button', { name: '뉴스' }).click();
    await page.getByRole('button', { name: '전체' }).click();
    await page.getByRole('button', { name: '뉴스' }).click();

    await expect(page.getByTestId('regular-notices-grid')).toBeVisible();
    await expect
      .poll(async () => {
        const overlapCount = await page.evaluate(() => {
          const cards = Array.from(document.querySelectorAll('[data-testid="notice-card"]'))
            .map((element) => element.getBoundingClientRect())
            .filter((rect) => rect.width > 0 && rect.height > 0);

          let overlaps = 0;
          for (let i = 0; i < cards.length; i += 1) {
            for (let j = i + 1; j < cards.length; j += 1) {
              const a = cards[i];
              const b = cards[j];
              const xOverlap = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
              const yOverlap = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
              if (xOverlap * yOverlap > 1000) overlaps += 1;
            }
          }
          return overlaps;
        });

        return overlapCount;
      }, { timeout: 3000, intervals: [100, 150, 250, 500] })
      .toBe(0);
  });

  test('should move dashboard inbox into the nav bell drawer', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

    await expect(page.locator('main').getByRole('heading', { name: '알림함' })).toHaveCount(0);

    await page.getByTestId('nav-inbox-toggle').click();
    const drawer = page.getByTestId('nav-inbox-drawer');
    await expect(drawer).toBeVisible();
    await expect(drawer.getByText(/새 공지|마감 임박|새로운 알림이 없습니다/).first()).toBeVisible();
  });
});
