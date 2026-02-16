import { expect, test } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

test.describe('Notice chatbot UI', () => {
  test('floating chatbot should open on toggle click', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

    const toggle = page.getByTestId('notice-chat-toggle');
    await expect(toggle).toBeVisible();

    await toggle.click();
    await expect(page.getByTestId('notice-chat-popover')).toBeVisible();
    await expect(page.getByTestId('notice-chat-input')).toBeVisible();

    await page.getByRole('button', { name: '공지 챗봇 닫기' }).click();
    await expect(page.getByTestId('notice-chat-popover')).toBeHidden();
  });

  test('suggested question button should fill chat input', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

    await page.getByTestId('notice-chat-toggle').click();
    const input = page.getByTestId('notice-chat-input');
    await expect(input).toBeVisible();

    const suggestionButtons = page.locator('[data-testid^="notice-chat-suggestion-"]');
    await expect(suggestionButtons.first()).toBeVisible();

    const initialInputValue = await input.inputValue();
    await suggestionButtons.first().click();
    await expect(input).not.toHaveValue(initialInputValue);
    await expect(input).toHaveValue(/.{4,}/);
  });
});
