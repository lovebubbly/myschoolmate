import { expect, test } from '@playwright/test';
import { extractApplicationDeadlineFromText } from '../src/lib/deadlineExtractor';

test.describe('Deadline Extraction Regression', () => {
  test('should pick end date for date range with tilde', () => {
    const text = '(1) 신청 기간: 2025. 1. 29.(목) ~ 2026. 2. 5.(목) 까지';
    expect(extractApplicationDeadlineFromText(text)).toBe('2026.02.05');
  });

  test('should pick end date for from-to range', () => {
    const text = '접수기간: 2026-03-01부터 2026-03-15까지';
    expect(extractApplicationDeadlineFromText(text)).toBe('2026.03.15');
  });

  test('should parse single until date', () => {
    const text = '서류 제출 마감일은 2026/04/09까지 입니다.';
    expect(extractApplicationDeadlineFromText(text)).toBe('2026.04.09');
  });

  test('should infer year when range end omits year', () => {
    const text = '1차(정기) 수강신청: 2026. 2. 2. ~ 2. 6.';
    expect(extractApplicationDeadlineFromText(text)).toBe('2026.02.06');
  });

  test('should infer next year for cross-year range without end year', () => {
    const text = '수업기간: 2025. 12. 23. ~ 1. 11.';
    expect(extractApplicationDeadlineFromText(text)).toBe('2026.01.11');
  });

  test('should prioritize application line over class period line', () => {
    const text = `
수업기간: 2026. 3. 2. ~ 6. 14.
수강신청 기간: 1차(정기) 2026. 2. 2. ~ 2. 6.
`;
    expect(extractApplicationDeadlineFromText(text)).toBe('2026.02.06');
  });

  test('should use nearby keyword context for markdown table rows', () => {
    const text = `
다. 수강신청 기간
| 구 분 | 일 시 |
| --- | --- |
| 1차 (정기) | 2026. 2. 2. 09:00 ~ 2. 6. 23:59 |
| 3차 (변경) | 2026. 3. 3. 09:00 ~ 3. 9. 23:59 |
`;
    expect(extractApplicationDeadlineFromText(text)).toBe('2026.02.06');
  });

  test('should not pick class-period end date when application table exists', () => {
    const text = `
가. 수업기간
- 일반 교과목: 2026. 3. 2. ~ 6. 14.

다. 수강신청 기간
| 구 분 | 일 시 |
| --- | --- |
| 1차 (정기) | 2026. 2. 2. 09:00 ~ 2. 6. 23:59 |
| 3차 (변경) | 2026. 3. 3. 09:00 ~ 3. 9. 23:59 |
`;
    expect(extractApplicationDeadlineFromText(text)).toBe('2026.02.06');
  });

  test('should fallback to latest date when context is ambiguous', () => {
    const text = '행사 일정: 2026.05.01 안내, 2026.05.10 최종 공지';
    expect(extractApplicationDeadlineFromText(text)).toBe('2026.05.10');
  });
});
