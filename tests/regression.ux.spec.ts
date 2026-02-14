import { expect, test } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

type NoticeApiItem = {
  title: string;
  isPinned?: boolean;
  content?: string | null;
};

test.describe('User Experience Regressions', () => {
  test('theme toggle should switch with transition markers', async ({ page }) => {
    await page.goto(BASE_URL);

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
      { timeout: 1200 }
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

    await page.goto(BASE_URL);
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

    await page.goto(BASE_URL);
    const firstCard = page.getByTestId('notice-card').first();
    await expect(firstCard).toBeVisible();
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
});
