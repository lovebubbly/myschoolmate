import { expect, test } from '@playwright/test';
import { mockBriefingApi } from './_helpers/mockBriefing';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

type NoticeApiItem = {
  title: string;
  isPinned?: boolean;
  content?: string | null;
};

async function ensureNoticeCardVisible(page: import('@playwright/test').Page) {
  const firstCard = page.getByTestId('notice-card').first();
  const isInitiallyVisible = await firstCard.isVisible({ timeout: 6000 }).catch(() => false);
  if (isInitiallyVisible) return firstCard;

  const filterToggle = page.getByRole('button', { name: /필터/ });
  if (await filterToggle.isVisible().catch(() => false)) {
    await filterToggle.click();
    const resetButton = page.getByRole('button', { name: '전체 보기' });
    if (await resetButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await resetButton.click();
    }
  }

  await expect(firstCard).toBeVisible({ timeout: 12000 });
  return firstCard;
}

test.describe('User Experience Regressions', () => {
  test.beforeEach(async ({ page }) => {
    await mockBriefingApi(page);
  });

  test('theme toggle should switch with transition markers', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

    const root = page.locator('html');
    const toggle = page.getByRole('button', { name: '테마 전환' });
    await expect(toggle).toBeVisible();

    const wasDark = await root.evaluate((el) => el.classList.contains('dark'));

    await toggle.click();

    const sawTransitionMarker = await page.evaluate(() => {
      return new Promise<boolean>((resolve) => {
        const start = Date.now();
        const root = document.documentElement;
        const timer = setInterval(() => {
          if (root.classList.contains('theme-transition')) {
            clearInterval(timer);
            resolve(true);
          } else if (Date.now() - start > 1500) {
            clearInterval(timer);
            resolve(false);
          }
        }, 20);
      });
    });

    expect(sawTransitionMarker).toBeTruthy();

    await expect.poll(
      async () => root.evaluate((el) => el.classList.contains('theme-transition')),
      { timeout: 3500 }
    ).toBeFalsy();

    const isDark = await root.evaluate((el) => el.classList.contains('dark'));
    expect(isDark).toBe(!wasDark);
  });

  test('pinned notice CTA should remain visible when pinned notices exist', async ({ page, request }) => {
    const noticesRes = await request.get(`${BASE_URL}/api/notices?autoCrawl=0`);
    expect(noticesRes.ok()).toBeTruthy();
    const noticesJson = await noticesRes.json();
    expect(noticesJson.success).toBeTruthy();

    const notices: NoticeApiItem[] = Array.isArray(noticesJson.notices) ? noticesJson.notices : [];
    const pinnedCount = notices.filter((n) => n.isPinned).length;

    if (pinnedCount === 0) {
      test.skip(true, 'No pinned notices in current dataset.');
      return;
    }

    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    const pinnedButton = page.getByRole('button', { name: /고정 공지/ });
    await expect(pinnedButton).toBeVisible();

    const styles = await pinnedButton.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return {
        backgroundColor: style.backgroundColor,
        color: style.color,
        borderTopColor: style.borderTopColor,
      };
    });

    expect(styles.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
    expect(styles.backgroundColor).not.toBe('transparent');
    expect(styles.color).not.toBe('rgba(0, 0, 0, 0)');
    expect(styles.borderTopColor).not.toBe('rgb(0, 0, 0)');
    expect(styles.borderTopColor).not.toBe('transparent');
  });

  test('notice dialog should keep scrollbar inside the content area', async ({ page, request }) => {
    const noticesRes = await request.get(`${BASE_URL}/api/notices?autoCrawl=0`);
    expect(noticesRes.ok()).toBeTruthy();
    const noticesJson = await noticesRes.json();
    expect(noticesJson.success).toBeTruthy();

    const notices: NoticeApiItem[] = Array.isArray(noticesJson.notices) ? noticesJson.notices : [];
    if (notices.length === 0) {
      test.skip(true, 'No notices available to validate dialog rendering.');
      return;
    }

    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    const firstCard = await ensureNoticeCardVisible(page);
    await firstCard.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    const scrollArea = dialog.locator('.notice-dialog-scroll');
    await expect(scrollArea).toBeVisible();

    const overflowStates = await scrollArea.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return {
        parentOverflowY: window.getComputedStyle(el.parentElement as HTMLElement).overflowY,
        parentOverflow: window.getComputedStyle(el.parentElement as HTMLElement).overflow,
        overflowY: style.overflowY,
        overflowX: style.overflowX,
        horizontalOverflow: el.scrollWidth > el.clientWidth,
      };
    });

    expect(overflowStates.overflowY).toBe('auto');
    expect(overflowStates.overflowX).toBe('hidden');
    expect(overflowStates.parentOverflowY).toBe('hidden');
    expect(overflowStates.parentOverflow).toBe('hidden');
    expect(overflowStates.horizontalOverflow).toBeFalsy();
  });

  test('search should show suggestions and apply selected suggestion', async ({ page, request }, testInfo) => {
    if (testInfo.project.name.includes('Mobile')) {
      test.skip(true, 'Search suggestion popup behavior is verified on desktop browsers.');
      return;
    }

    const noticesRes = await request.get(`${BASE_URL}/api/notices?autoCrawl=0`);
    expect(noticesRes.ok()).toBeTruthy();
    const noticesJson = await noticesRes.json();
    expect(noticesJson.success).toBeTruthy();
    const notices: NoticeApiItem[] = Array.isArray(noticesJson.notices) ? noticesJson.notices : [];
    if (notices.length === 0) {
      test.skip(true, 'No notices available to validate search suggestions.');
      return;
    }

    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    const firstCard = await ensureNoticeCardVisible(page);
    const sourceTitle = String(await firstCard.locator('h3').first().textContent() || '').trim();
    const compact = sourceTitle.replace(/\s+/g, '').trim();
    const keyword = compact.length >= 2 ? compact.slice(0, 2) : sourceTitle.slice(0, 1);
    if (!keyword) {
      test.skip(true, 'Title was empty, cannot build a search keyword.');
      return;
    }

    const searchInput = page.getByPlaceholder('공지 검색...');
    await expect(searchInput).toBeVisible();
    await searchInput.fill(keyword);

    const suggestionList = page.getByTestId('search-suggestion-list');
    await expect(suggestionList).toBeVisible();

    const firstSuggestion = page.getByTestId('search-suggestion-item').first();
    await expect(firstSuggestion).toBeVisible();
    const suggestionText = String(await firstSuggestion.textContent() || '').trim();
    await firstSuggestion.click();

    const expectedValue = suggestionText.startsWith('#') ? suggestionText.slice(1) : suggestionText;
    await expect(searchInput).toHaveValue(expectedValue);
  });

  test('notice detail should render full content and action checklist without summary mode switch', async ({ page, request }) => {
    const noticesRes = await request.get(`${BASE_URL}/api/notices?autoCrawl=0`);
    expect(noticesRes.ok()).toBeTruthy();
    const noticesJson = await noticesRes.json();
    expect(noticesJson.success).toBeTruthy();
    const notices: NoticeApiItem[] = Array.isArray(noticesJson.notices) ? noticesJson.notices : [];
    if (notices.length === 0) {
      test.skip(true, 'No notices available to validate summary mode UI.');
      return;
    }

    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    const firstCard = await ensureNoticeCardVisible(page);
    await firstCard.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(page.getByTestId('notice-detail-content')).toBeVisible();
    await expect(page.getByTestId('notice-summary-mode-switch')).toHaveCount(0);
    await expect(dialog.getByRole('button', { name: '검토 예정' })).toHaveCount(1);
    await expect(dialog.getByRole('button', { name: '준비중' })).toHaveCount(1);
    await expect(dialog.getByRole('button', { name: '완료' })).toHaveCount(1);
    await expect(dialog.getByRole('button', { name: '관심 없음' })).toHaveCount(1);
  });
});
