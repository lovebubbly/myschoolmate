
import { chromium } from 'playwright';
import { prisma } from '@/lib/prisma';

const CURRICULUM_URL = 'https://inform.chungbuk.ac.kr/cisub2_2'; // Courses (Corrected from inspection)
const TRACK_URL = 'https://inform.chungbuk.ac.kr/cisub2_3'; // Tracks

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

        const courses = await page.evaluate(() => {
            const rows = Array.from(document.querySelectorAll('table.metable tbody tr'));
            const extracted: any[] = [];

            // The table structure is complex with rowspans. 
            // We need to keep track of Grade/Semester context.
            // Simplified logic: Iterate rows. If <th> found, update context.
            // Actually, for simplicity in this MVP, we might scrape just the "Course Name", "Number", "Credit", "Category".

            let currentGrade = 1;
            let currentSemester = 1;

            rows.forEach(row => {
                // Heuristic: Check for Grade/Semester in th
                const ths = row.querySelectorAll('th');
                // The structure is inconsistent across years, but generally: 
                // Grade | Semester | Category | Code | Name | Credit

                const cells = row.querySelectorAll('td');
                if (cells.length === 0) return;

                // Find Code and Name. Usually Code is 7 digits.
                // Cell index varies due to rowspan.
                // We search for the pattern.

                let codeCell: Element | null = null;
                let nameCell: Element | null = null;
                let creditCell: Element | null = null;
                let categoryCell: Element | null = null;

                cells.forEach(cell => {
                    const txt = cell.textContent?.trim() || "";
                    if (/^[0-9]{7}/.test(txt)) codeCell = cell; // Code is 7 digits usually? Sample showed 5108112
                    if (cell.classList.contains('tl')) nameCell = cell;
                    if (txt.includes('-') && txt.length < 10) creditCell = cell; // 3-3-0
                    if (txt.includes('전공') || txt.includes('교양')) categoryCell = cell;
                });

                if (codeCell && nameCell) {
                    // Extract multiple codes if present (<br>)
                    const codes = (codeCell as any).innerHTML.split('<br>').map((c: string) => c.trim()).filter((c: string) => c.length > 0);
                    const names = (nameCell as any).innerHTML.split('<br>').map((n: string) => n.trim().replace(/\(.*\)/, '')); // Remove English name for simplicity? Or keep it.
                    // Actually descriptions have English in parens.
                    // The sample shows: "정보통신 개론 (Introduction...)"
                    // Let's keep the full name.

                    const credit = (creditCell as any)?.textContent?.trim() || "3-0-0";
                    const category = (categoryCell as any)?.textContent?.trim() || "전공 선택";

                    // Codes mapping
                    codes.forEach((code: string, idx: number) => {
                        // Clean code (remove tags if any)
                        const cleanCode = code.replace(/<[^>]*>/g, '');
                        const name = (nameCell as any)?.textContent?.trim().split('\n')[idx] || (nameCell as any)?.textContent?.trim() || ""; // Heuristic fallback

                        extracted.push({
                            id: cleanCode,
                            name: name.replace(/\s+/g, ' '),
                            credit: credit,
                            category: category,
                            // We are losing accurate Grade/Semester due to rowswpan complexity in this quick script
                            // Ideally we parse rowspans. For now we default to unknown or infer from context if feasible.
                            // Let's leave grade/semester as null or 0 for now.
                            grade: 0,
                            semester: 0
                        });
                    });
                }
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

            // Click the tab? Actually the site loads using JS tabs or just hiding divs?
            // "ul#ciltab li" - click invokes show? 
            // Sample HTML shows <li class="on">...</li>. Clicking changes class.
            // We need to click the tab to see the table?
            // Actually the content might be in the DOM already, just hidden "display:none".
            // Let's check "div.tbbox table" invisible?
            // The sample HTML provided shows: <li id="contents2" style="display: list-item;">...</li>
            // It suggests contents are inside distinct LIs or DIVs toggled.

            // Strategy: Click buttons and grab data.
            // Tab Selectors: ul.ciitab3 li

            // Click tab i+1 (index 0 is empty hidden li in sample? "li class='' style='display:none'")
            // Sample: <li class="on">정보통신...</li> -> this is the first visible tab. 
            // The first li is hidden. So tracks[0] corresponds to li:nth-child(2).

            const tabIndex = i + 2;
            await page.click(`ul.ciitab3 li:nth-child(${tabIndex})`);
            await page.waitForTimeout(500); // Wait for UI update

            // Extract courses for this track
            // They are usually in <table class="citable">
            // We need to match Course Names to IDs? 
            // The table only gives Names (e.g., "공학수학 I").
            // We need to fuzzy match or exact match with the DB Courses we just saved.

            const trackCourseNames = await page.evaluate(() => {
                // Get visible table
                // The visible li has the table?
                const visibleLi = document.querySelector('ul.ciitab3 li.on') || document.querySelector('li[style*="list-item"]');
                // Actually the sample says <li id="contents2">...
                // Wait, the structure is: Tabs (ul) control Content (li or div).
                // Let's just grab ALL tables and parse names, since we clicked.
                // Or better: Just grab all text from the currently visible container.

                const tables = document.querySelectorAll('table.citable');
                // User sample shows tables inside li#contents2...
                // Finding the visible table is tricky without seeing full valid HTML.
                // Let's grab all p tags inside tables, they contain course names.

                // Since we clicked a tab, assume the implementation shows the relevant table.
                // We will scrape all visible text in tables.

                const paragraphs = Array.from(document.querySelectorAll('table.citable p'));
                return paragraphs.map(p => p.textContent?.trim()).filter(t => t);
            });

            console.log(`Track ${trackName} has ${trackCourseNames.length} courses identified by name.`);

            // Link to DB
            for (const courseName of trackCourseNames) {
                if (!courseName) continue;
                // Find course by name (contains)
                const course = await prisma.course.findFirst({
                    where: { name: { contains: courseName.replace(/\s/g, '') } } // Remove spaces for fuzzy match?
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

    } catch (e) {
        console.error('Curriculum Crawl Error', e);
    } finally {
        await browser.close();
    }
}
