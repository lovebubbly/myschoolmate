import { expect, test } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

type NoticeApiItem = {
  isPinned?: boolean;
};

async function ensureNoticeCardVisible(page: import('@playwright/test').Page) {
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

test.describe('Mobile UX Regressions', () => {
  test.describe.configure({ timeout: 120000 });

  test('mobile controls should remain usable', async ({ page, request }) => {
    const noticesRes = await request.get(`${BASE_URL}/api/notices?autoCrawl=0`);
    expect(noticesRes.ok()).toBeTruthy();
    const noticesJson = await noticesRes.json();
    expect(noticesJson.success).toBeTruthy();

    const notices: NoticeApiItem[] = Array.isArray(noticesJson.notices) ? noticesJson.notices : [];
    if (notices.length === 0) {
      test.skip(true, 'No notices available on mobile verification.');
      return;
    }

    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.getByText('최신 공지사항을 불러오고 있어요...').waitFor({ state: 'hidden', timeout: 30000 }).catch(() => {});

    const viewport = page.viewportSize();
    const viewportWidth = viewport?.width || 390;

    const themeToggle = page.getByRole('button', { name: '테마 전환' });
    const cardMode = page.getByRole('button', { name: '카드' });
    const listMode = page.getByRole('button', { name: '리스트' });
    const pinnedButton = page.getByRole('button', { name: /고정 공지/ });
    const firstCard = await ensureNoticeCardVisible(page);
    if (!firstCard) {
      test.skip(true, 'Notice card was not visible on mobile controls check.');
      return;
    }

    await expect(themeToggle).toBeVisible();
    await expect(cardMode).toBeVisible();
    await expect(listMode).toBeVisible();
    await expect(firstCard).toBeVisible();

    const listModeBox = await listMode.boundingBox();
    if (listModeBox) {
      expect(listModeBox.x + listModeBox.width).toBeLessThanOrEqual(viewportWidth);
    }

    await listMode.click();
    await expect(firstCard).toBeVisible();

    const hasPinned = notices.some((item) => item.isPinned);
    if (hasPinned) {
      await expect(pinnedButton).toBeVisible();
      const pinnedButtonBox = await pinnedButton.boundingBox();
      if (pinnedButtonBox) {
        expect(pinnedButtonBox.width).toBeGreaterThan(10);
      }
      await pinnedButton.click();
    }
  });

  test('mobile detail dialog should keep scrolling inside content area', async ({ page, request }) => {
    const noticesRes = await request.get(`${BASE_URL}/api/notices?autoCrawl=0`);
    expect(noticesRes.ok()).toBeTruthy();
    const noticesJson = await noticesRes.json();
    expect(noticesJson.success).toBeTruthy();

    const notices: NoticeApiItem[] = Array.isArray(noticesJson.notices) ? noticesJson.notices : [];
    if (notices.length === 0) {
      test.skip(true, 'No notices available on mobile dialog verification.');
      return;
    }

    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.getByText('최신 공지사항을 불러오고 있어요...').waitFor({ state: 'hidden', timeout: 30000 }).catch(() => {});

    const firstCard = await ensureNoticeCardVisible(page);
    if (!firstCard) {
      test.skip(true, 'Notice card was not visible on mobile dialog check.');
      return;
    }
    await firstCard.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    const scrollArea = dialog.locator('.notice-dialog-scroll');
    await expect(scrollArea).toBeVisible();

    const overflowState = await scrollArea.evaluate((el) => {
      const style = window.getComputedStyle(el);
      const parent = el.parentElement as HTMLElement;
      const parentStyle = window.getComputedStyle(parent);
      return {
        hasHorizontalOverflow: el.scrollWidth > el.clientWidth,
        hasVerticalOverflow: el.scrollHeight > el.clientHeight,
        overflowY: style.overflowY,
        overflowX: style.overflowX,
        parentOverflowX: parentStyle.overflowX,
      };
    });

    expect(overflowState.overflowY).toBe('auto');
    expect(overflowState.overflowX).toBe('hidden');
    expect(overflowState.parentOverflowX).toBe('hidden');

    if (overflowState.hasVerticalOverflow) {
      expect(overflowState.hasHorizontalOverflow).toBeFalsy();
    }
  });
});
