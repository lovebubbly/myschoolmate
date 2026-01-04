
import { GoogleGenerativeAI } from '@google/generative-ai';

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
    // Using 1.5-flash as it is stable and cost-effective for high volume text generation
    const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });

    const prompt = `
    You are an academic assistant for a Information & Communication Engineering student.
    User Profile: ${userProfile}
    
    Here are the notices:
    ${JSON.stringify(notices.map(n => n.title))}
    
    Task:
    1. Select the top 3 most important notices specifically for this user.
    2. Write a brief, friendly "Morning Briefing" (in Korean).
    3. Use a "Nudge" tone (e.g., "Don't miss this scholarship!").
    4. Return ONLY the markdown text.
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
    const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview', generationConfig: { responseMimeType: "application/json" } });

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
            minGrade: regexData.minGrade ?? aiData.minGrade,
            maxIncome: regexData.maxIncome ?? aiData.maxIncome,
            applicationDeadline: regexData.applicationDeadline ?? aiData.applicationDeadline,
            minGpa: regexData.minGpa ?? aiData.minGpa
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
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const prompt = `You are a content formatter. Convert the following raw Korean notice text into clean, well-structured Markdown.

**Rules:**
1. Preserve ALL original information - do not summarize or remove content
2. Format tables using proper Markdown table syntax (| header | header |)
3. Use bullet lists (- or *) for list items
4. Use **bold** for important dates, deadlines, and key terms
5. Add proper line breaks between sections
6. Format links as [text](url) if URLs are present
7. Clean up excessive whitespace but keep logical paragraph breaks
8. Keep the language in Korean - do not translate
9. If there's a schedule/timeline, format it as a table
10. Output ONLY the formatted markdown, no explanations

Raw content:
${rawContent.slice(0, 8000)}`;

    try {
        const result = await model.generateContent(prompt);
        const formatted = result.response.text();
        return formatted || rawContent;
    } catch (e) {
        console.error('Content formatting error:', e);
        return rawContent; // Return original if formatting fails
    }
}
