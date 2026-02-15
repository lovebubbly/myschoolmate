import { chromium } from 'playwright';
import { prisma } from '@/lib/prisma';

const CURRICULUM_URL = 'https://inform.chungbuk.ac.kr/cisub2_2'; // Courses (Corrected from inspection)
const TRACK_URL = 'https://inform.chungbuk.ac.kr/cisub2_3'; // Tracks

type RawCourse = {
    id: string;
    name: string;
    credit: string;
    category: string;
    grade: number;
    semester: number;
};

export async function crawlCurriculum() {
    console.log('Starting Curriculum Crawl...');
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
        // 1. Crawl Courses (cisub2_1)
        console.log(`Navigating to ${CURRICULUM_URL}`);
        await page.goto(CURRICULUM_URL, { waitUntil: 'domcontentloaded' });

        // Wait for the table to appear - usually the latest year is selected by default
        await page.waitForSelector('table.metable');

        const courses = await page.evaluate<RawCourse[]>(() => {
            const splitCellValues = (cell: Element | null): string[] => {
                if (!cell) return [];
                return cell.innerHTML
                    .replace(/<br\s*\/?>/gi, '\n')
                    .split('\n')
                    .map((value) => value.replace(/<[^>]*>/g, '').trim())
                    .filter((value) => value.length > 0);
            };

            const rows = Array.from(document.querySelectorAll('table.metable tbody tr'));
            const extracted: RawCourse[] = [];

            rows.forEach((row) => {
                const tdNodes = Array.from(row.querySelectorAll<HTMLTableCellElement>('td'));
                if (tdNodes.length === 0) return;

                let codeCell: HTMLTableCellElement | null = null;
                let nameCell: HTMLTableCellElement | null = null;
                let creditCell: HTMLTableCellElement | null = null;
                let categoryCell: HTMLTableCellElement | null = null;

                tdNodes.forEach((cell) => {
                    const text = cell.textContent?.trim() || '';

                    if (!codeCell && /^\d{7,8}$/.test(text.replace(/[^0-9]/g, ''))) {
                        codeCell = cell;
                    }

                    if (!nameCell && cell.classList.contains('tl')) {
                        nameCell = cell;
                    }

                    if (!creditCell && /^\d-[0-9]-[0-9]$/.test(text)) {
                        creditCell = cell;
                    }

                    if (!categoryCell && (text.includes('전공') || text.includes('교양'))) {
                        categoryCell = cell;
                    }
                });

                if (!codeCell || !nameCell) return;

                const rawCodes = splitCellValues(codeCell);
                const names = splitCellValues(nameCell);
                const credit = (creditCell as HTMLTableCellElement | null)?.textContent?.trim() || '3-0-0';
                const category = (categoryCell as HTMLTableCellElement | null)?.textContent?.trim() || '전공 선택';

                rawCodes.forEach((code, index) => {
                    const name = names[index] || names[0];
                    if (!code || !name) return;

                    extracted.push({
                        id: code,
                        name: name.replace(/\s+/g, ' '),
                        credit,
                        category,
                        grade: 0,
                        semester: 0
                    });
                });
            });

            return extracted;
        });

        console.log(`Found ${courses.length} courses.`);

        // Upsert Courses
        for (const c of courses) {
            if (!c.id || c.id.length < 4) continue;
            await prisma.course.upsert({
                where: { id: c.id },
                update: { name: c.name, credit: c.credit, category: c.category },
                create: {
                    id: c.id,
                    name: c.name,
                    credit: c.credit,
                    category: c.category,
                    grade: c.grade,
                    semester: c.semester
                }
            });
        }
        console.log('Courses saved.');


        // 2. Crawl Tracks (cisub2_3)
        console.log(`Navigating to ${TRACK_URL}`);
        await page.goto(TRACK_URL, { waitUntil: 'domcontentloaded' });

        // Tracks: "정보통신 및 네트워크", "빅데이터 및 인공지능", "반도체 및 시스템"
        const tracks = ["정보통신 및 네트워크", "빅데이터 및 인공지능", "반도체 및 시스템"];

        for (let i = 0; i < tracks.length; i++) {
            const trackName = tracks[i];

            // Create Track in DB
            const trackRecord = await prisma.track.upsert({
                where: { id: i + 1 }, // Hardcoded ID for simplicity
                update: { name: trackName },
                create: { id: i + 1, name: trackName }
            });

            // Click the tab for this track
            const tabIndex = i + 2;
            await page.click(`ul.ciitab3 li:nth-child(${tabIndex})`);
            await page.waitForTimeout(500); // Wait for UI update

            const trackCourseNames = await page.evaluate<string[]>(() => {
                const visibleTab = document.querySelector('ul.ciitab3 li.on') || document.querySelector('li[style*="list-item"]');
                const sourceTables = visibleTab?.querySelectorAll('table.citable') ?? document.querySelectorAll('table.citable');

                const tableList = Array.from(sourceTables);
                const courseNames = tableList.flatMap((table) => {
                    return Array.from(table.querySelectorAll('p'))
                        .map((paragraph) => paragraph.textContent?.trim() || '')
                        .filter(Boolean);
                });

                return courseNames;
            });

            console.log(`Track ${trackName} has ${trackCourseNames.length} courses identified by name.`);

            // Link to DB
            for (const courseName of trackCourseNames) {
                const matchName = courseName.replace(/\s/g, '');
                const course = await prisma.course.findFirst({
                    where: { name: { contains: matchName } } // Remove spaces for fuzzy match?
                });

                if (course) {
                    await prisma.course.update({
                        where: { id: course.id },
                        data: {
                            tracks: {
                                connect: { id: trackRecord.id }
                            }
                        }
                    });
                }
            }
        }
        console.log('Tracks mapped.');

    } catch (error) {
        console.error('Curriculum Crawl Error', error);
    } finally {
        await browser.close();
    }
}
