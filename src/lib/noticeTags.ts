export type NoticeTagSlug = string;

export type TagDefinition = {
  slug: NoticeTagSlug;
  name: string;
  keywords: Array<string | RegExp>;
};

const TAGS: TagDefinition[] = [
  { slug: 'scholarship', name: '장학', keywords: ['장학', '장학생', '근로장학', '국가장학', /장학\s*금/ ] },
  { slug: 'tuition', name: '등록금', keywords: ['등록금', '분납', '고지서'] },
  { slug: 'workstudy', name: '근로', keywords: ['근로', '조교', 'RA', 'TA', '근로장학생'] },
  { slug: 'intern', name: '인턴', keywords: ['인턴', '현장실습', '실습생'] },
  { slug: 'job', name: '취업', keywords: ['채용', '모집', '공고', '정규직', '계약직', '인재', '면접'] },
  { slug: 'graduation', name: '졸업', keywords: ['졸업', '논문', '졸업요건', '졸업 요건'] },
  { slug: 'course', name: '수강', keywords: ['수강', '수강신청', '정정', '철회', '휴복학', '복학', '휴학'] },
  { slug: 'dorm', name: '기숙사', keywords: ['기숙사', '생활관'] },
  { slug: 'contest', name: '대회', keywords: ['대회', '공모', '공모전', '해커톤', '세미나', '특강'] },
  { slug: 'notice', name: '안내', keywords: ['안내', '공지', '알림'] },
];

function matchKeyword(haystack: string, keyword: string | RegExp): boolean {
  if (typeof keyword === 'string') return haystack.includes(keyword);
  return keyword.test(haystack);
}

export function extractNoticeTagSlugs(input: { title: string; body?: string | null; category?: string | null }): string[] {
  const text = `${input.title || ''}\n${input.category || ''}\n${input.body || ''}`
    .replace(/\s+/g, ' ')
    .trim();

  if (!text) return [];

  const slugs: string[] = [];
  for (const def of TAGS) {
    if (def.keywords.some((kw) => matchKeyword(text, kw))) {
      slugs.push(def.slug);
    }
  }
  return Array.from(new Set(slugs));
}

export function getDefaultTagDefinitions(): TagDefinition[] {
  return TAGS;
}
