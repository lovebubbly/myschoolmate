const FULL_DATE_SOURCE = '20[2-3][0-9][.\\-/]\\s*[0-1]?[0-9][.\\-/]\\s*[0-3]?[0-9]';
const MONTH_DAY_SOURCE = '[0-1]?[0-9][.\\-/]\\s*[0-3]?[0-9]';
const FULL_DATE_REGEX = new RegExp(FULL_DATE_SOURCE, 'g');

const FULL_TO_FULL_RANGE_REGEX = new RegExp(
  `(${FULL_DATE_SOURCE})[^\\n]{0,40}?(?:~|～|〜|\\-|–|—|부터)[^\\n]{0,40}?(${FULL_DATE_SOURCE})`
);
const FULL_TO_MD_RANGE_REGEX = new RegExp(
  `(${FULL_DATE_SOURCE})[^\\n]{0,40}?(?:~|～|〜|\\-|–|—|부터)[^\\n]{0,20}?(${MONTH_DAY_SOURCE})`
);
const UNTIL_FULL_REGEX = new RegExp(`(${FULL_DATE_SOURCE})[^\\n]{0,20}?까지`);

const KEYWORDS = ['신청', '접수', '마감', '제출', '등록', '납부'];
const EXCLUDE_KEYWORDS = ['수업기간', '수업 기간'];
const CONTEXT_LINE_WINDOW = 5;

type ParsedFullDate = { year: number; month: number; day: number };
type ParsedMonthDay = { month: number; day: number };

function parseFullDate(raw: string): ParsedFullDate | null {
  const m = raw.match(/(20[2-3][0-9])[.\-/]\s*([0-1]?[0-9])[.\-/]\s*([0-3]?[0-9])/);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

function parseMonthDay(raw: string): ParsedMonthDay | null {
  const m = raw.match(/([0-1]?[0-9])[.\-/]\s*([0-3]?[0-9])/);
  if (!m) return null;
  const month = Number(m[1]);
  const day = Number(m[2]);
  if (!Number.isFinite(month) || !Number.isFinite(day)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { month, day };
}

function formatDate(year: number, month: number, day: number) {
  return `${year}.${String(month).padStart(2, '0')}.${String(day).padStart(2, '0')}`;
}

function normalizeFullDate(raw: string): string | null {
  const parsed = parseFullDate(raw);
  if (!parsed) return null;
  return formatDate(parsed.year, parsed.month, parsed.day);
}

function inferYearFromStart(start: ParsedFullDate, end: ParsedMonthDay) {
  let year = start.year;
  if (end.month < start.month || (end.month === start.month && end.day < start.day)) {
    year += 1;
  }
  return year;
}

function toDateValue(dateText: string) {
  return Number(dateText.replace(/\./g, ''));
}

function extractDeadlineFromLine(line: string): string | null {
  const fullRange = line.match(FULL_TO_FULL_RANGE_REGEX);
  if (fullRange) {
    const end = normalizeFullDate(fullRange[2] || '');
    if (end) return end;
  }

  const mixedRange = line.match(FULL_TO_MD_RANGE_REGEX);
  if (mixedRange) {
    const start = parseFullDate(mixedRange[1] || '');
    const endMd = parseMonthDay(mixedRange[2] || '');
    if (start && endMd) {
      return formatDate(inferYearFromStart(start, endMd), endMd.month, endMd.day);
    }
  }

  const until = line.match(UNTIL_FULL_REGEX);
  if (until) {
    const untilDate = normalizeFullDate(until[1] || '');
    if (untilDate) return untilDate;
  }

  return null;
}

export function extractApplicationDeadlineFromText(rawText: string): string | null {
  const cleaned = rawText
    .replace(/\([월화수목금토일]\)/g, '')
    .replace(/\u00A0/g, ' ');

  const lines = cleaned
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const hasKeyword = (line: string) => KEYWORDS.some((keyword) => line.includes(keyword));
  const isExcluded = (line: string) => EXCLUDE_KEYWORDS.some((keyword) => line.includes(keyword));

  const keywordCandidates: string[] = [];
  lines.forEach((line, idx) => {
    if (isExcluded(line)) return;
    const contextualKeyword =
      hasKeyword(line) ||
      Array.from({ length: CONTEXT_LINE_WINDOW }).some((_, offset) => {
        const prevIdx = idx - (offset + 1);
        return prevIdx >= 0 && hasKeyword(lines[prevIdx]);
      });
    if (!contextualKeyword) return;
    const extracted = extractDeadlineFromLine(line);
    if (extracted) keywordCandidates.push(extracted);
  });

  if (keywordCandidates.length > 0) {
    keywordCandidates.sort((a, b) => toDateValue(a) - toDateValue(b));
    return keywordCandidates[0];
  }

  for (const line of lines) {
    const extracted = extractDeadlineFromLine(line);
    if (extracted) return extracted;
  }

  const allDates = Array.from(cleaned.matchAll(FULL_DATE_REGEX))
    .map((m) => normalizeFullDate(m[0] || ''))
    .filter((v): v is string => Boolean(v));

  if (allDates.length === 0) return null;
  allDates.sort((a, b) => toDateValue(a) - toDateValue(b));
  return allDates[allDates.length - 1];
}
