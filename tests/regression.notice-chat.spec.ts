import { expect, test } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

type NoticeItem = {
  id: number;
  title: string;
  url: string;
};

type ChatCitation = {
  id: number;
  title: string;
  url: string;
};

test.describe('Notice Q&A grounded response', () => {
  test('POST /api/chat should return citations with notice links', async ({ request }) => {
    const noticesRes = await request.get(`${BASE_URL}/api/notices?autoCrawl=0&limit=80`);
    expect(noticesRes.ok()).toBeTruthy();
    const noticesJson = await noticesRes.json();
    expect(noticesJson.success).toBeTruthy();

    const notices: NoticeItem[] = Array.isArray(noticesJson.notices) ? noticesJson.notices : [];
    if (notices.length === 0) {
      test.skip(true, 'No notices available to verify grounded chat.');
      return;
    }

    const target = notices[0];
    const question = `${target.title} 핵심만 알려줘`;

    const chatRes = await request.post(`${BASE_URL}/api/chat`, {
      data: { question },
    });
    expect(chatRes.ok()).toBeTruthy();

    const chatJson = await chatRes.json();
    expect(chatJson.success).toBeTruthy();
    expect(chatJson.grounded).toBeTruthy();

    const citations: ChatCitation[] = Array.isArray(chatJson.citations) ? chatJson.citations : [];
    expect(citations.length).toBeGreaterThan(0);

    const knownUrls = new Set(notices.map((notice) => notice.url));
    for (const citation of citations) {
      expect(typeof citation.title).toBe('string');
      expect(citation.title.length).toBeGreaterThan(0);
      expect(typeof citation.url).toBe('string');
      expect(citation.url.length).toBeGreaterThan(0);
      expect(knownUrls.has(citation.url)).toBeTruthy();
    }

    const answer = String(chatJson.answer || '');
    expect(answer).toContain('### 참고한 공지');
    expect(answer).toContain(citations[0].url);
  });
});
