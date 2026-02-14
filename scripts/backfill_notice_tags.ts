import 'dotenv/config';
import { prisma } from '@/lib/prisma';
import { extractNoticeTagSlugs, getDefaultTagDefinitions } from '@/lib/noticeTags';

const nameBySlug = Object.fromEntries(getDefaultTagDefinitions().map((d) => [d.slug, d.name]));

async function main() {
  const notices = await prisma.notice.findMany({
    select: { id: true, title: true, content: true, category: true },
    orderBy: { id: 'asc' },
  });

  let updated = 0;

  for (const notice of notices) {
    const slugs = extractNoticeTagSlugs({ title: notice.title, body: notice.content, category: notice.category });

    await prisma.notice.update({
      where: { id: notice.id },
      data: {
        tags: {
          deleteMany: {},
          create: slugs.map((slug) => ({
            tag: {
              connectOrCreate: {
                where: { slug },
                create: { slug, name: nameBySlug[slug] || slug },
              },
            },
          })),
        },
      },
    });

    updated += 1;
    if (updated % 50 == 0) {
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
