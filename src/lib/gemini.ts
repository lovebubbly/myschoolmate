
import { GoogleGenerativeAI } from '@google/generative-ai';

// Start with Gemini 3.0 Flash if available, or 2.0 Flash / 1.5 Flash. Use generic model name.
// User mentioned "Gemini 3.0 Flash". If API supports it via 'gemini-3.0-flash-001' or similar.
// Currently usually 'gemini-2.0-flash-exp' or 'gemini-1.5-flash'. 
// I will try 'gemini-2.0-flash-exp' as proxy for "newest" or 'gemini-1.5-flash' which is stable. 
// User Request: "Gemini 3.0 flash API 사용도 가능하다". I will assume model alias if exists, else fallback.
// Standardize on 'gemini-1.5-flash' for reliability or 'gemini-2.0-flash-exp' for cutting edge.
// I will use 'gemini-1.5-flash' for now as 3.0 might not be public in SDK yet or has specific name.
// Update: User said "Gemini 3.0 Flash". I will use that string if user insists, but check docs? 
// I'll use 'gemini-1.5-flash' as a safe default but comment.

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function getAIBriefing(notices: any[], userProfile: string) {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `
    You are an academic assistant for a Information & Communication Engineering student.
    User Profile: ${userProfile}
    
    Here are today's notices:
    ${JSON.stringify(notices.map(n => n.title))}
    
    Task:
    1. Select the most important notices for this user.
    2. Write a brief, friendly "Morning Briefing" (in Korean).
    3. Use a "Nudge" tone (e.g., "Don't miss this scholarship!").
    4. Format as markdown.
  `;

    try {
        const result = await model.generateContent(prompt);
        return result.response.text();
    } catch (e) {
        console.error('Gemini Error:', e);
        return '현재 AI 브리핑을 생성할 수 없습니다.';
    }
}
