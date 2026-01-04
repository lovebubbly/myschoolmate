
import axios from 'axios';
import * as cheerio from 'cheerio';

async function inspect() {
    const url = 'https://inform.chungbuk.ac.kr/index.php?mid=cisub5_1&category=407';
    console.log(`Fetching ${url}...`);
    try {
        const { data } = await axios.get(url);
        const $ = cheerio.load(data);

        // Dump the table structure
        const tables = $('table');
        console.log(`Found ${tables.length} tables.`);

        tables.each((i, table) => {
            console.log(`Table ${i} class: ${$(table).attr('class')}`);
            const headers = $(table).find('th').map((i, el) => $(el).text().trim()).get();
            console.log(`Headers: ${headers.join(' | ')}`);

            const firstRow = $(table).find('tbody tr').first();
            console.log('First Row HTML:', firstRow.html());
            console.log('First Row Text:', firstRow.text().trim().replace(/\s+/g, ' '));
        });

    } catch (e) {
        console.error(e);
    }
}

inspect();
