export const ALLOWED_TAGS = [
  '장학',
  '학사',
  '취업',
  '인턴',
  '행사',
  '공모전',
  '프로그램',
  '연구',
  '해외',
  '기숙사',
  '소식',
  '일반'
] as const;

const TAG_RULES: Array<{ tag: (typeof ALLOWED_TAGS)[number]; pattern: RegExp }> = [
  { tag: '장학', pattern: /장학|장학생|등록금|생활비|지원금|근로장학/ },
  { tag: '학사', pattern: /학사|수강|성적|휴학|복학|졸업|전공|시험|중간|기말|계절학기|재학/ },
  { tag: '취업', pattern: /취업|채용|모집|구인|채용공고|채용설명회|리크루팅/ },
  { tag: '인턴', pattern: /인턴|인턴십|intern/ },
  { tag: '행사', pattern: /행사|세미나|특강|설명회|박람회|워크숍|컨퍼런스|캠프/ },
  { tag: '공모전', pattern: /공모전|경진대회|대회|해커톤|경진/ },
  { tag: '프로그램', pattern: /프로그램|교육|연수|멘토링|캡스톤|워크숍/ },
  { tag: '연구', pattern: /연구|연구실|랩|과제|프로젝트/ },
  { tag: '해외', pattern: /해외|국제|교환학생|어학|유학/ },
  { tag: '기숙사', pattern: /기숙사|생활관/ },
  { tag: '소식', pattern: /소식|뉴스|보도/ },
];

function normalizeTag(tag: string) {
  return tag.trim();
}

export function normalizeTags(tags: string[]): string[] {
  const normalized = tags
    .map((tag) => normalizeTag(tag))
    .filter(Boolean)
    .filter((tag) => ALLOWED_TAGS.includes(tag as (typeof ALLOWED_TAGS)[number]));
  return Array.from(new Set(normalized));
}

export function extractTagsByRegex(input: {
  title: string;
  body?: string | null;
  category?: string | null;
}): string[] {
  const text = `${input.title || ''} ${input.body || ''}`;
  const tags = new Set<string>();

  if (input.category) {
    const lower = input.category.toLowerCase();
    if (lower.includes('academic')) tags.add('학사');
    if (lower.includes('scholarship')) tags.add('장학');
    if (lower.includes('employment')) tags.add('취업');
    if (lower.includes('news')) tags.add('소식');
    if (lower.includes('general')) tags.add('일반');
  }

  for (const rule of TAG_RULES) {
    if (rule.pattern.test(text)) {
      tags.add(rule.tag);
    }
  }

  return normalizeTags(Array.from(tags));
}
