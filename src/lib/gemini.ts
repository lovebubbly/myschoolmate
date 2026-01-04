
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

    const { greeting, emoji } = getTimeGreeting();

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
현재 인사: "${emoji} ${greeting}"

최근 공지사항 (JSON):
${JSON.stringify(noticeData, null, 2)}

Task:
1. **[중요] 사용자 프로필(학년, 소득분위, GPA, 트랙)을 철저히 분석하여 가장 연관성 높은 공지 3개를 선정하세요.**
   - 학년: 해당 학년이 지원 가능한지 확인 (예: 2학년).
   - 소득분위: 장학금 지원 자격 부합 여부 확인.
   - GPA: 성적 기준 만족 여부 확인 (예: 3.5 이상).
   - 트랙: 전공 트랙과 관련된 채용/교육 공지 우선.
2. 친근하고 간결한 브리핑을 작성하세요 (한국어).
3. "Nudge" 톤 사용 (예: "이 기회 놓치지 마세요!").
4. **개인화된 설명 추가:** 왜 이 공지가 사용자에게 적합한지 구체적으로 언급하세요. (예: "학우님의 소득분위 조건에 딱 맞아요", "관심 있는 임베디드 트랙 관련 소식이에요")
5. **링크 포맷 규칙 (매우 중요):**
   - **반드시 제목에 링크를 거세요.** 형식: **1. 이모지 [공지제목](URL)**
   - **주의:** 공지 제목 안에 대괄호 '[]'가 있다면 소괄호 '()'로 바꾸거나 제거하여 Markdown 링크가 깨지지 않게 하세요.
     - 나쁜 예: **[LIG넥스원] 공지...](url)** (깨짐)
     - 좋은 예: **[(LIG넥스원) 공지...](url)** (안전함)
   - **본문이나 끝부분에 URL을 따로 적지 마세요.** (URL 노출 금지 ❌)
   - 제공된 'url'이 없으면 링크를 걸지 마세요.
6. **줄바꿈을 충분히 사용**해서 가독성을 높이세요.
7. 오래된 공지보다 **최신 공지 우선**.
8. 시작은 "${emoji} ${greeting}!"로 시작하세요.

형식 예시:
${emoji} ${greeting}!

정보통신공학부 2학년 학우님께 딱 맞는 소식을 골라봤어요. GPA 3.5 이상이라 지원 가능한 장학금도 보이네요!

**1. 📢 [2025년 중앙일보 대학평가 결과](https://inform.chungbuk.ac.kr/...)**
우리 학부가 거점국립대 1위를 달성했대요! 학우님의 전공 자부심이 뿜뿜! 👍

**2. 💰 [국가장학금 신청 안내](https://inform.chungbuk.ac.kr/...)**
현재 소득분위 8구간이시라 신청 가능해요. 이번 학기 장학금 놓치면 안 되죠! 💸

**3. 🚀 [(LIG넥스원) 채용연계형 인턴](https://inform.chungbuk.ac.kr/...)**
선택하신 임베디드 SW 트랙과 관련된 최고의 기회예요. 마감이 얼마 안 남았으니 서두르세요!

마무리 멘트

Return ONLY the formatted markdown.
  `;

    try {
        const result = await model.generateContent(prompt);
        return result.response.text();
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
    Title: ${title}
    Body: ${body.slice(0, 5000)}

    Task:
    1. Summarize in Korean (1 sentence).
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
   - Escape pipe characters (|) within cell content as \\|
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
