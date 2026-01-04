
import { prisma } from '@/lib/prisma';

(async () => {
    try {
        const categories = await prisma.notice.groupBy({
            by: ['category'],
            _count: { category: true }
        });
        console.log("Categories in DB:", categories);

        const scholarships = await prisma.notice.findMany({
            where: { title: { contains: '장학' } },
            select: { id: true, title: true, category: true },
            take: 5
        });
        console.log("Sample Scholarships:", scholarships);

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
})();
