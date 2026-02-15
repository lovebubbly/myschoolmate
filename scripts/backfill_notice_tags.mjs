import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TAGS = [
  { slug: 'scholarship', name: '장학', keywords: ['장학', '장학생', '근로장학', '국가장학', /장학\s*금/] },
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

const NAME_BY_SLUG = Object.fromEntries(TAGS.map((t) => [t.slug, t.name]));

function matchKeyword(haystack, keyword) {
  if (typeof keyword === 'string') return haystack.includes(keyword);
  return keyword.test(haystack);
}

function extractTagSlugs({ title, body, category }) {
  const text = `${title || ''}\n${category || ''}\n${body || ''}`.replace(/\s+/g, ' ').trim();
  if (!text) return [];
  const slugs = [];
  for (const def of TAGS) {
    if (def.keywords.some((kw) => matchKeyword(text, kw))) {
      slugs.push(def.slug);
    }
  }
  return Array.from(new Set(slugs));
}

async function main() {
  const notices = await prisma.notice.findMany({
    select: { id: true, title: true, content: true, category: true },
    orderBy: { id: 'asc' },
  });

  let updated = 0;

  for (const notice of notices) {
    const slugs = extractTagSlugs({
      title: notice.title,
      body: notice.content,
      category: notice.category,
    });

    await prisma.notice.update({
      where: { id: notice.id },
      data: {
        tags: {
          deleteMany: {},
          create: slugs.map((slug) => ({
            tag: {
              connectOrCreate: {
                where: { slug },
                create: { slug, name: NAME_BY_SLUG[slug] || slug },
              },
            },
          })),
        },
      },
    });

    updated += 1;
    if (updated % 50 === 0) {
      console.log(`updated ${updated}/${notices.length}`);
    }
  }

  console.log(`done. updated ${updated} notices`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
