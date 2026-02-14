import { expect, test, type Locator } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

type NoticeCardState = {
  opacity: number;
  translateY: number;
};

async function getNoticeCardState(locator: Locator) {
  return locator.evaluate((el: Element) => {
    const style = getComputedStyle(el);
    const opacity = Number(style.opacity ?? 0);
    const matrix = style.transform;
    let translateY = 0;

    if (matrix && matrix !== 'none') {
      const values = matrix.match(/matrix\\((.*)\\)/)?.[1].split(',').map((n) => Number(n.trim()));
      if (values && values.length === 6) {
        translateY = values[5];
      }
      const values3d = matrix.match(/matrix3d\\((.*)\\)/)?.[1].split(',').map((n) => Number(n.trim()));
      if (values3d && values3d.length === 16) {
        translateY = values3d[13];
      }
    }

    return { opacity, translateY };
  });
}

test.describe('Notice list animation', () => {
  test('should animate card entry when switching list layout', async ({ page }) => {
    await page.goto(BASE_URL);
    const firstNoticeCard = () => page.getByTestId('notice-card').first();
    await expect(firstNoticeCard()).toBeVisible();

    const cardButton = page.getByRole('button', { name: '카드' });
    const listButton = page.getByRole('button', { name: '리스트' });

    // Force a known baseline layout to avoid test-order side effects.
    await cardButton.click();
    await page.waitForTimeout(100);

    const cards = page.getByTestId('notice-card');
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);

    await listButton.click();
    await page.waitForTimeout(80);

    const listState = await getNoticeCardState(firstNoticeCard());
    expect(listState.opacity < 1 || Math.abs(listState.translateY) > 0.5).toBeTruthy();

    await expect.poll(async () => {
      const state = await getNoticeCardState(firstNoticeCard());
      return state.opacity > 0.97 && Math.abs(state.translateY) < 2;
    }, { timeout: 4000 }).toBeTruthy();

    await cardButton.click();
    await page.waitForTimeout(80);

    const gridState = await getNoticeCardState(firstNoticeCard());
    expect(gridState.opacity < 1 || Math.abs(gridState.translateY) > 0.5).toBeTruthy();

    await expect.poll(async () => {
      const state = await getNoticeCardState(firstNoticeCard());
      return state.opacity > 0.97 && Math.abs(state.translateY) < 2;
    }, { timeout: 2000 }).toBeTruthy();
  });
});
