
import { GoogleGenerativeAI } from '@google/generative-ai';

// Time-aware greeting helper
function getTimeGreeting(): { greeting: string; emoji: string } {
    const hour = new Date().toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: 'Asia/Seoul' });
    const h = parseInt(hour);
    if (h >= 5 && h < 12) return { greeting: '좋은 아침이에요', emoji: '☀️' };
    if (h >= 12 && h < 17) return { greeting: '좋은 오후예요', emoji: '🌤️' };
    if (h >= 17 && h < 21) return { greeting: '좋은 저녁이에요', emoji: '🌆' };
    return { greeting: '늦은 밤이네요', emoji: '🌙' };
}

// Regex Helpers
function extractByRegex(title: string, body: string) {
    const text = `${title} ${body}`;

    // Income: "8구간", "8분위"
    let maxIncome: number | null = null;
    const incomeMatch = text.match(/([0-9]+)\s*(구간|분위)/);
    if (incomeMatch) {
        maxIncome = parseInt(incomeMatch[1]);
    } else if (text.includes('기초생활') || text.includes('기초수급') || text.includes('차상위')) {
        maxIncome = 0;
    }

    // Grade: "3학년", "3~4학년" 
    let minGrade: number | null = null;
    const gradeMatch = text.match(/([1-4])\s*학년/);
    if (gradeMatch) {
        minGrade = parseInt(gradeMatch[1]);
    } else if (text.includes('신입생')) {
        minGrade = 1;
    }

    // Date: 2025. 12. 24 or 2025-12-24 or 2025/12/24
    const dateMatch = text.match(/20[2-3][0-9][.\-/]\s*[0-1]?[0-9][.\-/]\s*[0-3]?[0-9]/);
    let applicationDeadline = dateMatch ? dateMatch[0].replace(/[\s]/g, '') : null;
    // Standardize to YYYY.MM.DD
    if (applicationDeadline) {
        applicationDeadline = applicationDeadline.replace(/-/g, '.').replace(/\//g, '.');
    }

    // GPA: Handle 2.0~4.5 range, and various formats
    const gpaMatch = text.match(/(?:성적|평점|GPA).*?([2-4]\.[0-9][0-9]?)/i) ||
        text.match(/([2-4]\.[0-9][0-9]?)\s*(?:이상|\/|만점)/);
    const minGpa = gpaMatch ? parseFloat(gpaMatch[1]) : null;

    return { maxIncome, minGrade, applicationDeadline, minGpa };
}

export async function getAIBriefing(notices: any[], userProfile: string) {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
    // gemini-2.5-flash-lite: stable, cost-effective, 1M context
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

    const hour = parseInt(new Date().toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: 'Asia/Seoul' }));
    let timeContext = "Daytime";
    if (hour >= 5 && hour < 12) timeContext = "Morning";
    else if (hour >= 18 && hour < 22) timeContext = "Evening";
    else if (hour >= 22 || hour < 5) timeContext = "Late Night";

    // Sort by date (newest first) and take recent ones
    const recentNotices = notices
        .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime())
        .slice(0, 20);

    // Include title, summary, link, and date for better AI judgment
    const noticeData = recentNotices.map(n => ({
        title: n.title,
        summary: n.summary?.slice(0, 100) || '',
        url: n.url || '',
        date: n.date || ''
    }));

    const prompt = `
당신은 정보통신공학부 학생을 위한 학사 도우미입니다.

사용자 프로필: ${userProfile}

최근 공지사항 (JSON):
${JSON.stringify(noticeData, null, 2)}

---
**Instructions for AI Assistant:**

1.  **Goal**: Provide a personalized, concise briefing of relevant notices for the user.
2.  **Language**: Korean.
3.  **Current Context**: ${timeContext} (Hour: ${hour}).
4.  **Tone**: 
    -   **Opening**: Creative, witty, and casual greeting. **Avoid** cliché "Good morning/afternoon". Use something fresh like "Studying hard?", "Time for a break?", "Burning the midnight oil?", or "Ready to start the day?".
    -   **Body**: Warm, encouraging, concise. Like a helpful senior.
5.  **User Profile**:
    -   ${userProfile}
    -   **Income Bracket**: 0 (High Need) ~ 10 (High Income).
        -   **Income 0~8**: High financial need. Target for need-based scholarships.
        -   **Income 9~10**: High income. **NOT** eligible for need-based aid. Do NOT suggest need-based scholarships.
    -   **GPA**: 4.5 scale.

6.  **STRICT Grounding & Truthfulness**:
    -   ONLY use the provided notice data. Do NOT invent notices or mix details between different notices.
    -   Ensure the mapping between Title, Summary, and URL is 100% accurate.
    -   If you mention a specific notice, the details must match the JSON data provided above.

Generate a briefing that:
1.  **[Important] Select Top 3 Notices**: Analyze applicability.
    -   If user is Income 9-10, prioritize Career/Internship/Events over Scholarships.
2.  Friendly, "Nudge" tone.
4.  **Format Rules (STRICT)**:
    -   **Link Style**: You MUST link the title directly. 
        -   ✅ Correct: **1. 📢 [ [Source] Title ](https://...)**
    -   **Brackets**: You CAN use square brackets ONLY for starting source labels like [CBNU] or [Department]. 
    -   **Additional Info**: If you add any extra information at the bottom, format it clearly using bullet points and avoid redundant bolding.

5.  **Personalized Explanation**:
    -   "Since your GPA is 3.5..."
    -   "As a 4th year student..."

6.  **Start** with your creative greeting.

Format Example:
(Creative Greeting)

Information for 2nd year student (Income 9)!

**1. 📢 [ [CBNU] (LIG Nex1) Internship Recruitment ](https://inform.chungbuk.ac.kr/...)**
Great chance for your Embedded Track career!

**2. 🏆 [ [Scholarship] Capstone Design Fair ](https://inform.chungbuk.ac.kr/...)**
Show off your skills!

Return ONLY the formatted markdown.
  `;

    try {
        const result = await model.generateContent(prompt);
        let text = result.response.text();
        // Post-processing: Fix broken links (e.g. "[Title] (URL)" -> "[Title](URL)")
        text = text.replace(/\] \(/g, '](');
        return text;
    } catch (e) {
        console.error('Gemini Error:', e);
        return '현재 AI 브리핑을 생성할 수 없습니다.';
    }
}

export async function analyzeNotice(title: string, body: string): Promise<{
    summary: string;
    minGrade: number | null;
    maxIncome: number | null;
    scholarshipType: string;
    applicationDeadline: string | null;
    minGpa?: number | null;
}> {
    // 1. Regex Extraction (Cost-free, high precision for format)
    const regexData = extractByRegex(title, body);

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
    // gemini-2.5-flash-lite for structured extraction
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite', generationConfig: { responseMimeType: "application/json" } });

    const prompt = `
    Analyze this notice and extract information. 
    STRICT Grounding: Use ONLY the provided Title and Body. Do NOT use outside knowledge.

    Title: ${title}
    Body: ${body.slice(0, 5000)}

    Task:
    1. Summarize in Korean (1 sentence). The summary MUST be about this specific notice ONLY.
    2. Identify scholarship type (Tuition, LivingSupport, Program, Job, Other).
    3. Extract minGrade (1-4) and maxIncome (0-10) if mentioned.
    4. Extract deadline (YYYY.MM.DD).
    5. Extract minGpa (e.g. 3.0) if mentioned.

    Return JSON: { "summary", "scholarshipType", "minGrade", "maxIncome", "applicationDeadline", "minGpa" }
    `;

    try {
        const result = await model.generateContent(prompt);
        const aiData = JSON.parse(result.response.text());

        return {
            summary: aiData.summary || "요약 없음",
            scholarshipType: aiData.scholarshipType || "Other",
            minGrade: (() => {
                const val = regexData.minGrade ?? aiData.minGrade;
                if (!val) return null;
                const num = parseInt(String(val));
                return isNaN(num) ? null : num;
            })(),
            maxIncome: (() => {
                const val = regexData.maxIncome ?? aiData.maxIncome;
                // Treat 0 as valid (0 bracket/basic living)
                if (val === undefined || val === null) return null;
                const num = parseInt(String(val));
                return isNaN(num) ? null : num;
            })(),
            applicationDeadline: regexData.applicationDeadline ?? aiData.applicationDeadline,
            minGpa: (() => {
                const val = regexData.minGpa ?? aiData.minGpa;
                if (!val) return null;
                const num = parseFloat(String(val));
                if (isNaN(num) || num > 10) return null; // Filter out "87" etc.
                return num;
            })()
        };

    } catch (e) {
        console.error('Gemini Analysis Error:', e);
        // Fallback to purely regex data if AI fails
        return {
            summary: "AI 분석 실패 (키워드 추출)",
            minGrade: regexData.minGrade,
            maxIncome: regexData.maxIncome,
            scholarshipType: "Other",
            applicationDeadline: regexData.applicationDeadline,
            minGpa: regexData.minGpa
        };
    }
}

/**
 * Format raw notice content into clean, readable markdown.
 * Handles tables, lists, links, and proper spacing.
 */
export async function formatNoticeContent(rawContent: string): Promise<string> {
    if (!rawContent || rawContent.length < 50) return rawContent;

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

    const prompt = `You are a content formatter. Convert the following raw Korean notice text into clean, well-structured Markdown.

**Rules:**
1. Preserve ALL original information - do not summarize or remove content
2. Format tables using proper Markdown table syntax (| header | header |)
   - Ensure every row has the same number of columns as the header
   - Ensure EVERY cell has a value (use "-" if empty)
   - Escape pipe characters (|) within cell content as \\|
   - IMPORTANT: If a cell contains multiple lines, flatten them into a single line or use <br> tags. Markdown tables DO NOT support multi-line rows.
3. Use bullet lists (- or *) for list items
4. Use **bold** for important dates, deadlines, and key terms
5. Add proper line breaks between sections
6. Format links as [text](url) if URLs are present
7. Clean up excessive whitespace but keep logical paragraph breaks
8. Keep the language in Korean - do not translate
9. If there's a schedule/timeline, format it as a table
10. Escape tildes (~) used for ranges to prevent strikethrough (e.g., 10시\\~17시)
11. Output ONLY the formatted markdown, no explanations

Raw content:
${rawContent.slice(0, 8000)}`;

    try {
        const result = await model.generateContent(prompt);
        let formatted = result.response.text();

        // Post-processing fix for common table issues
        if (formatted) {
            // Ensure no "dotted" lists break tables? 
            // Actually usually Gemini handles this well, but we can double check.
        }

        return formatted || rawContent;
    } catch (e) {
        console.error('Content formatting error:', e);
        return rawContent; // Return original if formatting fails
    }
}
