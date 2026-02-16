import type { Page } from '@playwright/test';

const MOCK_BRIEFING_TEXT = '테스트 브리핑(모킹 응답)';

export async function mockBriefingApi(page: Page) {
  await page.route('**/api/briefing**', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        briefing: MOCK_BRIEFING_TEXT,
        cached: true,
        options: {
          tone: null,
          length: null,
          focusCategories: [],
        },
      }),
    });
  });
}
