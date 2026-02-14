import { expect, test } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

test.describe('Notice list animation', () => {
  test('should switch between card and list layout cleanly', async ({ page }) => {
    await page.goto(BASE_URL);

    const firstNoticeCard = () => page.getByTestId('notice-card').first();
    await expect(firstNoticeCard()).toBeVisible();

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
    await expect(firstNoticeCard()).toBeVisible();
    await expect
      .poll(async () => {
        const opacity = await firstNoticeCard().evaluate((el) => getComputedStyle(el).opacity);
        const value = Number(opacity);
        return Number.isFinite(value) ? value : 0;
      }, { timeout: 2500, intervals: [100, 100, 250, 250, 500, 500] })
      .toBeGreaterThan(0.9);

    await cardButton.click();
    await expect(page.getByTestId('regular-notices-grid')).toBeVisible();
    await expect(page.getByTestId('regular-notices-list')).toBeHidden();
    await expect(firstNoticeCard()).toBeVisible();
    await expect
      .poll(async () => {
        const opacity = await firstNoticeCard().evaluate((el) => getComputedStyle(el).opacity);
        const value = Number(opacity);
        return Number.isFinite(value) ? value : 0;
      }, { timeout: 2500, intervals: [100, 100, 250, 250, 500, 500] })
      .toBeGreaterThan(0.9);
  });
});
